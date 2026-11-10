# 成本跟踪与 Clay 对比：设计规范

## 概述

为 Open Enrich 的数据丰富流程添加实时成本跟踪，并直观展示与 Clay.com 定价的对比。目标是让用户立即看到开源数据丰富方案（OpenRouter + Bright Data）的巨大成本优势。

## 成本组成

每次数据丰富包含三种成本来源：

| 来源 | 费率 | 跟踪方式 |
|--------|------|-------------|
| OpenRouter LLM | 响应中的 `usage.cost` | LangChain 回调处理程序 |
| Bright Data 工具 | 每次调用 0.0015 美元（所有工具） | 工具封装中的计数器 |
| 基础设施 | 0 美元（自行托管） | N/A |

## 架构

### 成本跟踪器

一个位于 LangGraph 状态之外、作为旁路通道的 `CostTracker` 类。每行一个实例。

```typescript
interface RowCost {
  llmCost: number;        // USD from OpenRouter usage.cost
  llmTokensIn: number;    // prompt tokens
  llmTokensOut: number;   // completion tokens
  toolCalls: number;      // Bright Data invocations
  toolCost: number;       // toolCalls * 0.0015
  totalCost: number;      // llmCost + toolCost
}
```

### LLM 成本捕获

附加到每个 `createLLM()` 实例的自定义 LangChain 回调处理程序。在 `handleLLMEnd` 时提取：
- `response.usage_metadata.input_tokens`
- `response.usage_metadata.output_tokens`
- `response.usage_metadata.total_cost`，或根据 OpenRouter 的 `usage.cost` 字段计算

通过闭包累计到每行的 `CostTracker`。

### Bright Data 工具成本捕获

现有工具封装（search_engine、scrape_as_markdown 等）增加轻量级计数器。每次调用都会将每行 `CostTracker` 上的 `toolCalls` 加 1。成本计算方式：`toolCalls * 0.0015`。

### SSE 事件

每行内每次 LLM 调用完成后流式传输的新事件类型：

```
data: {"type": "cost_update", "rowIndex": 0, "cost": {"totalCost": 0.0043, "llmCost": 0.0028, "toolCost": 0.0015, "toolCalls": 1}}
```

每行的最终 `result` 事件也包含完整成本对象。

## Clay 成本对比引擎

基于动态类别的定价映射，用于估算 Clay Growth 套餐成本（约 0.05 美元/credit）：

```typescript
const CLAY_COST_MAP: Record<string, number> = {
  // Contact data
  person_email: 0.40,
  person_phone: 0.25,
  person_linkedin_url: 0.20,
  person_github_url: 0.15,
  person_twitter_url: 0.10,
  person_title: 0.15,
  person_seniority: 0.15,
  person_location: 0.15,
  person_headline: 0.10,
  person_summary: 0.10,

  // Company enrichment
  company_name: 0.10,
  domain: 0.05,
  description: 0.10,
  industry: 0.10,
  employee_count: 0.15,
  year_founded: 0.10,
  headquarters: 0.10,

  // Technographics
  tech_stack: 0.25,

  // Funding
  recent_funding: 0.20,
  total_funding: 0.20,
  investors: 0.20,

  // Social/web
  linkedin_url: 0.15,
  twitter_url: 0.10,
  github_url: 0.10,

  // Metrics/signals
  hiring_velocity: 0.20,
  leadership_changes: 0.20,
  revenue_estimate: 0.25,

  // Default for custom fields
  _default: 0.20,
};
```

**每行 Clay 估算成本** = 对成功丰富的每个字段（非 null，置信度 > 0）的 `CLAY_COST_MAP[field]` 求和。只统计实际有数据的字段：确保公平对比。

**汇总对比**还包含 Clay 隐含的平台成本，按每行摊销：`$495 / estimated_monthly_volume` 作为单独的行项目显示。

## UI 组件

### 1. 实时成本计数器（数据丰富期间）

位于数据丰富进度组件上方的紧凑栏。在整个数据丰富过程中保持可见。

**布局：**
- **左侧：**“你的成本”，绿色文本，根据 `cost_update` SSE 事件实时递增
- <strong>中间：</strong>节省百分比徽章（例如“低 96%”）
- **右侧：**“Clay 等效成本”，使用弱化/暗淡文本，根据已完成字段计算，递增速度更快

简洁的双数字显示。数据丰富期间不使用图表。极小的绿色数字与较大的灰色数字形成视觉对比，直观呈现差异。

<strong>更新：</strong>每次收到 `cost_update` 事件时，递增“你的成本”。每次收到 `result` 事件（行完成）时，根据成功丰富的字段重新计算 Clay 等效成本。

### 2. 数据丰富后的摘要卡片（结果页面）

一个宽大醒目的卡片，位于外联摘要卡片**上方**。

**布局：**
- <strong>左侧区块：</strong>以大号文字显示你的总成本（例如 `$0.12`），并提供显示 LLM 与 Bright Data 成本明细的工具提示
- <strong>中间区块：</strong>显示成本比例的水平条形图，你的成本为极小的一段，Clay 为完整条形
- <strong>右侧区块：</strong>Clay 等效成本（例如 `$14.70`）、“你节省的金额”及百分比

<strong>主数字下方：</strong>每行平均成本对比行（例如 `$0.006/row vs $0.74/row on Clay`）。

### 3. 报告面板中的成本分析部分

`EnrichmentReportPanel` 中的新部分，位于“摘要统计”之后。

**内容：**
- <strong>成本明细表：</strong>LLM 成本、Bright Data 工具成本、总成本，包含 token 数量（输入/输出）
- <strong>Clay 对比表：</strong>按类别（联系数据、公司统计信息、技术信息、融资、社交信息）显示你的成本与 Clay 每类成本
- <strong>最终结果：</strong>总节省金额、节省百分比、每行成本对比
- **平台成本说明：**“Clay Growth 套餐要求每月支付 495 美元订阅费。Open Enrich 免费且开源。”

### 设计系统合规性

所有组件均使用现有设计 token：
- 深色表面（`surface-card`、border-default）
- “你的成本”数字使用绿色强调色（`--color-bd-success`）
- Clay 数字使用弱化文本（`--text-tertiary`）
- 现有排版（显示文本使用 `Outfit`，数字使用 `JetBrains Mono`）
- 与 `enrichment-report.tsx` 模式保持一致

## 数据流

```
LLM Call
  → LangChain callback captures usage.cost + tokens
  → CostTracker.addLLMCost(cost, tokensIn, tokensOut)

Tool Call (Bright Data)
  → Tool wrapper increments counter
  → CostTracker.addToolCall()

Per-row processing
  → After each LLM call: emit SSE cost_update event
  → After row complete: attach RowCost to result event

Client
  → useEnrichment hook accumulates costs per row
  → Live ticker reads running totals
  → On complete: summary card + report section render final numbers
  → Clay comparison calculated client-side from enriched field names + CLAY_COST_MAP
```

## 要创建/修改的文件

**新文件：**
- `lib/cost-tracker.ts`：CostTracker 类 + LangChain 回调处理程序
- `lib/clay-pricing.ts`：Clay 成本映射 + 对比计算器
- `components/cost-ticker.tsx`：数据丰富期间的实时成本显示
- `components/cost-summary-card.tsx`：数据丰富后的摘要卡片
- `components/cost-report-section.tsx`：报告面板部分

**修改的文件：**
- `lib/config/llm.ts`：接受 CostTracker，将回调附加到 ChatOpenAI
- `lib/agents/graph.ts`：在智能体执行期间传递 CostTracker
- `app/api/enrich/route.ts`：为每行创建 CostTracker，发出 cost_update 事件，将成本附加到结果
- `hooks/useEnrichment.ts`：处理 cost_update 事件，累计总成本
- `components/enrichment-progress.tsx`：在进度上方渲染 CostTicker
- `components/enrichment-report.tsx`：添加 CostReportSection
- `app/page.tsx`：在外联卡片上方渲染 CostSummaryCard
- 工具封装文件：添加工具调用计数

## 范围之外

- 按智能体划分的成本明细（仅按行跟踪）
- 跨会话的历史成本跟踪
- 模型选择 / 成本优化建议
- 与 Clay 以外工具的比较
