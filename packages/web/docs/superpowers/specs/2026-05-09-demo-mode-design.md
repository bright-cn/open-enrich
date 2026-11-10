# DEMO_MODE：公共演示配额执行

## 摘要

添加一个可选启用的 `DEMO_MODE=1` 环境标志，将每位访问者（按 IP）的**终身数据丰富总量限制为 50 行**。达到或部分超过上限时，用户会看到一个可关闭的模态框，说明这是演示版，并引导他们前往 GitHub 仓库和 Bright Data 注册页面。限制在服务器端的 `/api/enrich` 中执行；使用 Turso（libSQL/SQLite）进行持久化。

## 动机

目前，open-enrich 托管演示版没有任何用量控制。任何人都可以调用 `/api/enrich`，消耗 Bright Data 和 OpenRouter 额度。我们希望发布一个公共演示版，在不开放无限付费 API 用量的同时，让访问者仍能充分体验产品。

## 目标

- 使用一个环境变量（`DEMO_MODE=1`）切换整个功能；默认关闭，自托管用户的行为不受影响。
- 按 IP 设置 **终身** 50 行数据丰富上限（不每日重置，符合“这只是体验版”的演示意图）。
- 部分满足：如果用户请求的行数超过剩余额度，则仅丰富剩余行，并通知用户。
- 配额归零后完全阻止，并显示可关闭的模态框，将用户引导至仓库和 Bright Data 注册页面。

## 非目标

- 管理员重置端点、申诉或宽限期。
- 除标准 `x-forwarded-for` IP 检测外，不提供验证码、浏览器指纹识别或其他防绕过措施。
- 基于成本或任务数的限制（成本已在其他位置跟踪；行数是唯一配额）。
- 达到上限前在 UI 中显示“剩余：X/50”指示器。
- 将现有基于文件的配置（`data/email-settings.json`、`data/mcp-servers.json`）替换或迁移到 Supabase。

## 架构

```
Browser ──► /api/enrich ──► [DEMO_MODE check]
                              │
                              ├─ flag off → existing flow (unchanged)
                              │
                              └─ flag on → Turso quota check (BEGIN IMMEDIATE txn)
                                            │
                                            ├─ remaining = 0      → 429 { code: "DEMO_LIMIT_REACHED" }
                                            ├─ remaining < rows.N → trim rows + emit quota_partial SSE event
                                            └─ remaining >= rows.N → run normally
```

一个功能标志、一张 Turso 表、`/api/enrich` 中的单一执行点，以及前端的一个新模态框组件。

## 组件

### 1. 配置辅助工具：`lib/demo-mode/config.ts`

```ts
export const DEMO_LIFETIME_ROW_LIMIT = 50;
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}
```

### 2. Turso 客户端：`lib/demo-mode/turso.ts`

- 首次使用时创建单例 `@libsql/client` 客户端。
- 使用 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`（仅限服务器端：绝不导入客户端组件或发送到浏览器）。
- 如果 `DEMO_MODE=1`，但任一环境变量缺失，则在首次使用时抛出清晰错误。
- 首次使用时，为 `demo_quota` 表运行 `CREATE TABLE IF NOT EXISTS`（延迟初始化架构，无需单独的设置脚本）。

### 3. 数据库架构（Turso / SQLite）

```sql
CREATE TABLE IF NOT EXISTS demo_quota (
  ip TEXT PRIMARY KEY,
  rows_used INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

此单条语句会在首次检查配额时延迟运行（幂等：`IF NOT EXISTS`）。不使用存储过程；预留逻辑使用 `BEGIN IMMEDIATE` 事务以 TypeScript 实现，确保原子性（参见 `quota.ts`）。

常量 `50` 位于 TypeScript 的 `DEMO_LIFETIME_ROW_LIMIT` 中，并由预留代码直接引用；架构中不会对其进行硬编码。

### 4. 配额辅助工具：`lib/demo-mode/quota.ts`

```ts
export type QuotaResult =
  | { status: "ok"; granted: number }
  | { status: "partial"; granted: number; requested: number }
  | { status: "blocked" };

export function getClientIp(req: Request): string;
export async function checkAndReserveQuota(
  ip: string,
  requestedRows: number
): Promise<QuotaResult>;
```

`getClientIp` 读取 `x-forwarded-for`（第一跳），回退到 `x-real-ip`，再回退到字面量字符串 `"unknown"`。所有无法检测到 IP 的请求共享 `"unknown"` 存储桶，因此移除标头无法绕过限制。

`checkAndReserveQuota` 使用 `BEGIN IMMEDIATE` 运行 libSQL 事务（该操作会立即获取数据库写入锁，使并发写入者串行执行）：

1. `BEGIN IMMEDIATE`
2. `INSERT INTO demo_quota (ip) VALUES (?) ON CONFLICT(ip) DO NOTHING`
3. `SELECT rows_used FROM demo_quota WHERE ip = ?`
4. 在 JS 中计算 `granted = min(requested, max(50 - rows_used, 0))`
5. 如果 `granted > 0`：`UPDATE demo_quota SET rows_used = rows_used + ?, last_used_at = unixepoch() WHERE ip = ?`
6. `COMMIT`

随后转换结果：
- `granted == requested` → `ok`
- `0 < granted < requested` → `partial`
- `granted == 0` → `blocked`

通过 `BEGIN IMMEDIATE` 启动的 SQLite/libSQL 事务会在事务期间持有独占写入锁，因此来自同一 IP 的两个并发预留请求会在数据库层串行执行，第二个请求将看到第一个请求更新后的 `rows_used` 值。

### 5. `/api/enrich` 路由变更（[app/api/enrich/route.ts](open-enrich/app/api/enrich/route.ts)）

在使用 zod 解析请求正文后、构建 SSE 流之前：

```ts
if (isDemoMode()) {
  const ip = getClientIp(req);
  const result = await checkAndReserveQuota(ip, body.rows.length);

  if (result.status === "blocked") {
    return new Response(
      JSON.stringify({ error: "demo_limit_reached", code: "DEMO_LIMIT_REACHED" }),
      { status: 429, headers: { "content-type": "application/json" } }
    );
  }

  if (result.status === "partial") {
    body.rows = body.rows.slice(0, result.granted);
    // Stash for the stream-construction step to emit as the first event.
    quotaPartialEvent = { type: "quota_partial", granted: result.granted, requested: result.requested };
  }
}
```

如果设置了 `quotaPartialEvent`，则在任何 `pending`/`processing` 事件之前，将其作为第一条消息加入 SSE 流队列。

计数时机：**预先预留**。我们扣除的是路由接受的行数（裁剪后），而非请求的行数。如果数据丰富任务中途崩溃，用户确实会损失这些行的额度，对演示版而言可以接受。

### 6. 新 SSE 事件类型：[open-enrich/lib/types/](open-enrich/lib/types/)

扩展 `EnrichmentEvent` 联合类型：

```ts
| { type: "quota_partial"; granted: number; requested: number }
```

### 7. `useEnrichment` hook 变更：[open-enrich/hooks/](open-enrich/hooks/)

- 收到 fetch 响应时：如果 `res.status === 429` 且解析后的正文为 `code === "DEMO_LIMIT_REACHED"`，则设置 `demoModal = { open: true, mode: "blocked" }` 并中止运行。
- 收到 `quota_partial` SSE 事件时：设置 `demoModal = { open: true, mode: "partial", granted, requested }`。继续对获批行进行数据丰富。
- 从 hook 暴露 `demoModal` 和 `closeDemoModal`。

### 8. `DemoLimitModal` 组件：`components/DemoLimitModal.tsx`

使用与 `DetailModal` 相同的 Framer Motion + 玻璃拟态叠加层模式构建。Props：

```ts
type Props = {
  open: boolean;
  onClose: () => void;
  mode: "blocked" | "partial";
  granted?: number;
  requested?: number;
};
```

文案：
- **`blocked`**：标题“你已达到演示版限制。”正文：“这只是一个演示版。要充分体验不受限制的数据丰富功能，请克隆仓库并注册 Bright Data。”
- **`partial`**：标题“已达到演示版限制。”正文：“你提交了 {requested} 行，我们丰富了其中的 {granted} 行，这就是此演示版配额的全部剩余额度。要丰富其余行（以及更多数据），请克隆仓库并注册 Bright Data。”

两种模式均包含两个 CTA：
- “克隆仓库”：打开 open-enrich GitHub 仓库 URL（设为常量；最终 URL 在实现期间填入）。
- “注册 Bright Data”：打开 `https://www.bright.cn/`。

模态框可关闭：右上角关闭按钮 `X`、Escape 键、单击叠加层背景。在 `blocked` 模式下，关闭模态框不会解除对用户的限制，演示版 UI 仍可浏览，但之后的任何数据丰富尝试都会收到 429，并重新打开模态框。达到上限后，我们不会禁用“开始数据丰富”按钮，而是让服务器作为事实来源，并在下一次收到 429 时重新打开模态框。

### 9. `app/page.tsx` 集成

渲染由 `useEnrichment` 中的 `demoModal` 状态驱动的 `<DemoLimitModal />`。不进行其他布局变更。

### 10. `/api/check-env`：[open-enrich/app/api/check-env/](open-enrich/app/api/check-env/)

在响应中添加 `demoMode: boolean` 字段，让前端知道该标志已启用。前端**不会**使用此字段执行任何限制，仅供以后可能添加的 UI 提示使用。服务器端执行才是事实来源。

## 数据流场景

**场景 1：新 IP，请求 30 行：**
1. 路由调用 `checkAndReserveQuota('1.2.3.4', 30)`。
2. 事务：插入新行（rows_used=0），查询 rows_used=0，计算 granted=30，将 rows_used 更新为 30，然后提交。
3. `QuotaResult` 为 `ok`；路由正常运行。

**场景 2：同一 IP 再请求 30 行（累计尝试 60 行）：**
1. 事务：查询 rows_used=30，计算 granted=min(30, 50-30)=20，将 rows_used 更新为 50，然后提交。
2. `QuotaResult` 为 `partial { granted: 20, requested: 30 }`；路由将行数裁剪为 20。
3. 流的第一个事件是 `{ type: "quota_partial", granted: 20, requested: 30 }`。
4. 前端以 `partial` 模式打开模态框；20 行结果正常流式传入。

**场景 3：同一 IP 再发起任何请求：**
1. 事务：查询 rows_used=50，计算 granted=0，不更新，然后提交。
2. `QuotaResult` 为 `blocked`；路由返回 `429 { code: "DEMO_LIMIT_REACHED" }`。
3. 前端以 `blocked` 模式打开模态框。

## 错误处理

- **Turso 无法访问**（网络/libSQL 错误）：采用失败关闭策略。路由返回 `503 { error: "demo_quota_unavailable" }`，并在服务器端记录底层错误。失败开放会让演示版被免费使用，因此失败关闭才是演示版防护的正确策略。
- **当 `DEMO_MODE=1` 时缺少 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`**：Turso 客户端在首次使用时抛出清晰错误。路由返回 `503`，服务器日志包含一行指出缺失变量的消息。这是运维配置错误，不面向用户。
- **缺少 IP**（`x-forwarded-for` 和 `x-real-ip` 均不存在）：IP 将设为字面量字符串 `"unknown"`。所有此类请求共享一个 50 行存储桶。这意味着恶意用户无法通过移除标头、伪装成没有 IP 来获得无限演示用量。
- **来自同一 IP 的并发请求**：`checkAndReserveQuota` 中的 `BEGIN IMMEDIATE` 事务会获取 libSQL 的独占写入锁，使并发预留请求串行执行。来自新 IP 的两个同时发起的 30 行请求，一个会获得 `granted=30`，另一个会获得 `granted=20`，绝不会同时获得两个 `granted=30`。（libSQL 会在整个数据库范围内而非按行串行化写入者，但对于单张低流量的 `demo_quota` 表而言没有问题。）

## 测试

- **针对 Turso 数据库的单元式测试**，涵盖：新 IP、刚好匹配的请求、部分裁剪、被阻止、恰好 50 行边界、超过 50 行、来自同一 IP 的并发请求。如果添加测试运行器，则位于 `lib/demo-mode/__tests__/` 下；否则在实现计划中记录为手动测试用例。
- **手动端到端测试**：使用 Turso 数据库在本地设置 `DEMO_MODE=1`，在浏览器中执行场景 1/2/3，并验证模态框文案和 CTA。
- 不提供自动化前端测试；项目目前没有此类测试，我们不会仅为此功能添加测试框架。

## 范围之外

- 管理员重置端点、按 IP 的宽限期或申诉。
- 验证码、指纹识别或标准 IP 检测之外的任何防绕过措施。
- 基于成本的限制（已由 `CostTracker` 单独跟踪）。
- 提交前显示“剩余 X/50”的 UI 指示器。
- 将其他基于文件的配置（`email-settings.json`、`mcp-servers.json`）迁移到 Turso。

## 运维人员设置检查清单（将在 README 的实现计划中展示）

1. 创建 Turso 数据库（`turso db create open-enrich-demo` 或通过 Turso 控制面板）。
2. 获取数据库 URL（`turso db show open-enrich-demo --url`）和身份验证令牌（`turso db tokens create open-enrich-demo`）。
3. 在部署环境中设置 `DEMO_MODE=1`、`TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`。
4. 首次检查配额时会自动创建 `demo_quota` 表（通过 `CREATE TABLE IF NOT EXISTS` 延迟初始化），无需手动执行架构步骤。
5. 确认部署位于能正确设置 `x-forwarded-for` 的代理之后（Vercel 默认如此）。
