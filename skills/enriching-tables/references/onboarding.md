# 首次使用引导

适用于从未使用过 Bright Data 或 `@brightdata/enrich` 的用户。请按顺序引导他们完成这些步骤。整个过程约需 10 分钟，唯一可能导致延迟的是新 Bright Data 账户的 KYC。

## 目录
- 1. 安装 Node.js（≥ 20）
- 2. 创建 Bright Data 账户
- 3. 配置两个区域（搜索引擎 API + 网络解锁器）
- 4. 获取 Bright Data API 密钥
- 5. 获取 LLM 密钥（OpenRouter 或 OpenAI/Anthropic）
- 6. 使用 `enrich login` 存储凭据
- 7. 验证

## 1. 安装 Node.js（≥ 20）

CLI 需要 Node 20 或更高版本。检查：

```bash
node -v
```

如果未安装或版本低于 v20，请从 https://nodejs.org 安装当前 LTS 版本（或通过 `nvm install 20` 安装）。无需全局安装 CLI，`npx @brightdata/enrich` 会按需获取它。如需锁定版本，请使用 `npm install -g @brightdata/enrich`。

## 2. 创建 Bright Data 账户

在 https://www.bright.cn/ 注册。新账户可能需要完成简短的 KYC/验证步骤才能创建区域；如果无法创建区域，通常就是这个原因，请先完成验证。

## 3. 配置两个区域

该引擎使用两种不同的 Bright Data 产品，每种产品都以**区域**形式提供。在控制面板中，前往**代理与抓取**（产品目录），如果尚未创建，请分别创建一个：

- **搜索引擎 API** 区域：执行用于查找每个实体的网页搜索。记下你为其设置的**区域名称**；该字符串即为 `BRIGHT_DATA_SERP_ZONE`。
- **网络解锁器**区域：获取并解锁找到的页面。其**区域名称**为 `BRIGHT_DATA_UNLOCKER_ZONE`。

这些值是区域的**名称**（例如 `serp_api1`、`unblocker1`），而不是 URL 或密码。

## 4. 获取 Bright Data API 密钥

控制面板 → **设置** → **API 密钥** → 创建/复制密钥（https://www.bright.cn/cp/setting/users）。这就是 `BRIGHT_DATA_API_KEY`。它是账户级令牌，请妥善保密。

## 5. 获取 LLM 密钥

智能体需要 LLM。默认使用 **OpenRouter**（不限定模型，只需一个密钥）：

- 在 https://openrouter.ai/keys 创建密钥，这就是 `OPENROUTER_API_KEY`。

你也可以改用 OpenAI 或 Anthropic，设置 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`，引擎会选择正确的适配器。请在提供商处充值几美元；每行的 LLM 费用不到一美分，但余额耗尽会导致运行失败。

## 6. 存储凭据

有两种方式。**环境变量 / `.env`** 优先，最适合脚本：

```bash
export BRIGHT_DATA_API_KEY=...
export BRIGHT_DATA_SERP_ZONE=...        # the SERP zone *name*
export BRIGHT_DATA_UNLOCKER_ZONE=...    # the Web Unlocker zone *name*
export OPENROUTER_API_KEY=...
```

或者通过交互方式存储一次，`login` 会在保存前通过实时 API 验证每项凭据，并将 `0600` 配置文件写入操作系统配置目录：

```bash
npx @brightdata/enrich login
```

它会跳过已通过环境变量设置的字段。之后如需移除已存储的配置，请运行 `enrich logout`。

## 7. 验证

在包含 CSV 的目录中（可使用仓库的 `examples/companies.csv`）运行预检，它会检查 Node，并通过不产生费用的试运行确认所有四项凭据均可解析：

```bash
bash scripts/preflight.sh examples/companies.csv
```

成功运行后以 `✓ Preflight passed` 结束。如果某项凭据显示 `✗`，说明该变量无法从环境、`.env` 或已存储配置中解析，请进行设置并重新运行。现在你可以继续执行 SKILL.md 中的第 2 步（检查 CSV）。
