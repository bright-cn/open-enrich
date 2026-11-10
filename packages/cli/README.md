# @brightdata/enrich

Open Enrich 引擎的无头 CLI。利用 Bright Data 网络基础设施 + LLM 智能体，以公司和个人数据丰富任意 CSV。

## 安装

```bash
npx @brightdata/enrich --version
# or
npm install -g @brightdata/enrich
```

## 首次运行设置

你需要一个 Bright Data 账户（包含两个区域：搜索引擎 API + 网络解锁器）和一个 OpenRouter API 密钥。

```bash
enrich login
```

也可以改为设置环境变量：

```
BRIGHT_DATA_API_KEY=...
BRIGHT_DATA_SERP_ZONE=...
BRIGHT_DATA_UNLOCKER_ZONE=...
OPENROUTER_API_KEY=...
```

环境变量的优先级始终高于已存储的配置。

## 用法

```bash
# Describe what you want in natural language
enrich leads.csv --describe "company size, recent funding, tech stack"

# Or pick specific preset fields
enrich leads.csv --fields employee_count,industry,funding_stage

# See what would happen without making API calls
enrich leads.csv --describe "..." --dry-run

# Specify the identifier column explicitly
enrich leads.csv --describe "..." --column email_address

# Write to a specific output path
enrich leads.csv --describe "..." --output enriched.csv

# Stream NDJSON events for programmatic use
enrich leads.csv --describe "..." --json | jq .
```

### 命令

| 命令 | 说明 |
|---|---|
| `enrich <input.csv>` | 丰富指定的 CSV（默认命令）。 |
| `enrich login` | 以交互方式配置并存储凭据。 |
| `enrich logout` | 删除已存储的凭据。 |

### 选项

| 选项 | 说明 | 默认值 |
|---|---|---|
| `-o, --output <path>` | 输出 CSV 路径。 | `<input>.enriched.csv` |
| `--column <name>` | 标识符列。 | 自动检测 |
| `--first-name <name>` | 包含人员名字的列。 | — |
| `--last-name <name>` | 包含人员姓氏的列。 | — |
| `--describe <text>` | 以自然语言描述你需要的字段。 | — |
| `--fields <names>` | 以逗号分隔的预设字段名称（`--describe` 的替代方式）。 | — |
| `--concurrency <n>` | 并行丰富的行数。 | `30` |
| `--no-resume` | 覆盖输出，而不是自动恢复。 | 默认恢复 |
| `--dry-run` | 解析配置并退出，不执行 API 调用。 | 关闭 |
| `--json` | 将 NDJSON 事件流式输出至 stdout；不写入 CSV。 | 关闭 |
| `-q, --quiet` | 隐藏进度；仅输出最终摘要。 | 关闭 |
| `-v, --verbose` | 显示每个 `agent_progress` 事件。 | 关闭 |

> 请提供 `--describe`（自然语言）或 `--fields`（预设名称）**其中之一**。不带参数运行 `enrich` 可输出完整帮助。

### 标识符与姓名列

CLI 会自动检测用于标识每一行的列（例如公司域名、网站或电子邮件）。如果检测结果错误，请使用 `--column` 覆盖。对于个人级信息丰富，请将 `--first-name`/`--last-name` 指向相关列，以便智能体区分同一公司的不同人员。

## 恢复机制

如果使用相同的 `--describe`/`--fields` 重新运行，且输出文件已存在，CLI 会检查表头并跳过已有输出的行。中断的运行（Ctrl-C）会在下次运行时自动恢复。传入 `--no-resume` 可覆盖。

## 成本

Bright Data 按工具调用收费（约 0.0015 美元）。OpenRouter 按 LLM token 收费。开始大型运行前，使用 `--dry-run` 获取粗略估算。

## 许可证

MIT
