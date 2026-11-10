---
name: enriching-tables
description: Enrich any CSV of companies or people with web-sourced data (employee count, revenue, funding, tech stack, work emails, LinkedIn, and custom fields) using the @brightdata/enrich CLI. Use this skill whenever the user wants to enrich, augment, fill in, or research rows of a spreadsheet or CSV — leads, prospects, accounts, contacts, a CRM export, or any table of companies/domains/emails — or mentions Bright Data enrichment, the `enrich` command, lead enrichment, data enrichment, or "add a column with X" to a list. Covers first-time onboarding (Bright Data + OpenRouter setup), running enrichments, and publishing this skill on skills.sh.
---

# 使用 @brightdata/enrich 丰富表格

`@brightdata/enrich`（CLI 命令：`enrich`）可将扁平 CSV 转换为丰富后的 CSV。每一行都会通过 Bright Data 基础设施和 LLM 智能体集群在实时网页上进行研究，并追加新列，例如公司规模、融资情况、技术栈、工作邮箱、LinkedIn URL，或你能用自然语言描述的任何内容。每次运行均可恢复、流式显示进度并报告成本。

此技能可帮助用户从零开始（没有账户）获得丰富完成的 CSV，并且不要求用户具备任何 Bright Data 使用经验。

## 何时使用此工具

只要用户有一张表，并希望添加来自网页的更多列，就可以使用：例如，需要员工人数和融资阶段的公司域名列表、缺少行业信息的 Salesforce 导出文件、需要已验证工作邮箱的联系人列表，或模糊的“能否为每条记录查找 X”。如果用户向你提供 CSV，并描述其中尚未包含的数据，这就是应使用的工具。

## 工作流程

流程始终包含相同的四个步骤。请按顺序执行，不要跳过试运行。

```
Enrichment Progress:
- [ ] 1. Confirm prerequisites (Node ≥20, four credentials resolve)
- [ ] 2. Inspect the input CSV (identifier column, what's already filled)
- [ ] 3. Dry-run to lock config + estimate cost, then get the user's OK
- [ ] 4. Run the real enrichment, report output path + cost
```

将该检查清单复制到工作笔记中，并逐项勾选，这可以避免在用户批准计划前就花费他们的资金。

## 第 1 步：前提条件

CLI 需要 **Node.js ≥ 20** 和**四项凭据**。如果用户从未进行过此设置，请引导他们完成 `references/onboarding.md`，其中涵盖创建 Bright Data 账户、配置两个必需区域、获取 LLM 密钥，以及具体点击位置。不要凭记忆转述这些步骤；请阅读该文件并按其说明操作。

四项凭据：

| 变量 | 用途 | 来源 |
|---|---|---|
| `BRIGHT_DATA_API_KEY` | Bright Data 账户 API 令牌 | Bright Data 控制面板 → 设置 → API 密钥 |
| `BRIGHT_DATA_SERP_ZONE` | **搜索引擎 API** 区域的名称 | Bright Data 控制面板 → 代理与抓取 → 你的 SERP 区域 |
| `BRIGHT_DATA_UNLOCKER_ZONE` | **网络解锁器**区域的名称 | Bright Data 控制面板 → 代理与抓取 → 你的 Unlocker 区域 |
| `OPENROUTER_API_KEY` | LLM 提供商密钥 | openrouter.ai/keys（或改用 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`） |

有两种提供方式。**环境变量**（或工作目录中的 `.env` 文件）始终优先，适合脚本化/非交互式运行：

```bash
export BRIGHT_DATA_API_KEY=...
export BRIGHT_DATA_SERP_ZONE=...
export BRIGHT_DATA_UNLOCKER_ZONE=...
export OPENROUTER_API_KEY=...
```

或者，用户可以通过交互式设置将其保存一次（保存至操作系统配置目录中的 `0600` 配置文件）：

```bash
npx @brightdata/enrich login
```

`login` 会在保存前通过实时 API 验证每项凭据，因此错误密钥会在此处快速失败，而不是运行到一半才失败。要清除已存储的凭据，请运行 `enrich logout`。

<strong>执行任何其他操作前先验证。</strong>运行内置的预检，它会检查 Node 版本并确认所有四项凭据均可解析（通过试运行，因此不会产生费用）：

```bash
bash scripts/preflight.sh path/to/input.csv
```

如果报告缺少凭据，请针对缺少的凭据将用户引导至 `references/onboarding.md`，不要猜测。

## 第 2 步：检查 CSV

配置运行前先查看文件。你需要了解两件事：

- **标识符列**：智能体用于在网页上查找每个实体的列。公司**域名**或**网站**最理想；公司**名称**也可以；对于个人，则使用**电子邮件**以及名字/姓氏列。CLI 会自动检测该列，但你仍应目视检查，以便在猜测错误时使用 `--column` 覆盖（例如，同时包含 `domain` 和 `personal_domain` 的文件）。
- **已填充的内容**：没必要重新获取文件中已有的列，也无需为此花费资金。只丰富缺失内容。

快速对文件执行一次 `head` 即可。对于此仓库中的示例文件：

```bash
head -5 examples/companies.csv
# company,domain,hq_country
# Stripe,stripe.com,United States
# ...
```

此处 `domain` 是自然标识符。

## 第 3 步：试运行，然后获取批准

**绝不要在未先试运行的情况下启动付费运行。**`--dry-run` 会解析完整配置，包括标识符列、将添加的确切字段、输出路径和成本估算，然后在不调用任何 API 的情况下退出。

```bash
npx @brightdata/enrich examples/companies.csv \
  --describe "employee count, total funding raised, primary tech stack" \
  --dry-run
```

返回内容会包括将添加的列、检测到的标识符和 `Estimated: ~$X.XX (Bright Data) + ~$Y.YY (LLM)`。**向用户展示此估算和字段列表，并等待用户明确批准**后再实际运行，尤其是文件超过几十行时。成本会随行数 × 字段数增长；5,000 行文件会产生真实费用。

决定**如何指定字段**（完整目录请参见 `references/fields.md`）：

- `--describe "<plain english>"`：自然语言。CLI 首先尝试将你的描述映射到预设字段；如果无法映射，LLM 会根据描述设计自定义字段。适用于任何定制需求（“其 B 轮融资的领投方”“是否使用 Kubernetes”）。
- `--fields a,b,c`：以逗号分隔的精确预设字段名称。速度更快且结果确定。知道名称时使用。`--describe` 与 `--fields` 互斥。

## 第 4 步：运行

获得批准后，移除 `--dry-run`：

```bash
npx @brightdata/enrich examples/companies.csv \
  --describe "employee count, total funding raised, primary tech stack"
```

默认情况下，丰富后的文件会写入 `<input>.enriched.csv`（可使用 `-o` 覆盖）。进度会流式输出到 stderr，并显示实时成本计量和预计完成时间；最终摘要会输出完成/跳过/出错的行数、按 LLM 与 Bright Data 拆分的总成本，以及输出路径。**将该摘要和输出路径反馈给用户。**

### 最重要的选项

| 选项 | 适用场景 | 默认值 |
|---|---|---|
| `--describe "<text>"` | 你想用自然语言描述字段（包括自定义字段） | — |
| `--fields a,b,c` | 你知道确切的预设名称 | — |
| `--column <name>` | 自动检测选择了错误的标识符 | 自动 |
| `--first-name <col>` / `--last-name <col>` | 丰富**人员**数据：让智能体能够区分同一公司的联系人 | — |
| `-o, --output <path>` | 你需要特定的输出文件名 | `<input>.enriched.csv` |
| `--concurrency <n>` | 调整并行处理的行数（受到速率限制时调低，需要加速时调高） | 30 |
| `--dry-run` | 始终在实际运行前使用 | 关闭 |
| `--json` | 你需要机器可读的 NDJSON 而非 CSV（通过管道传给 `jq`） | 关闭 |
| `--no-resume` | 你想覆盖而不是继续之前的运行 | 默认恢复 |
| `-q` / `-v` | 安静模式（仅摘要）/详细模式（每个智能体步骤） | 普通 |

### 自动恢复

如果运行被中断（Ctrl-C、崩溃或你手动停止），请**重新运行完全相同的命令**，它会从中断处继续。它会检查现有输出的标头并跳过已写入的行。仅当字段集一致时才能恢复，因此请保持 `--describe`/`--fields` 完全相同。如需重新开始，请传入 `--no-resume` 或删除输出文件。这使大型文件可以安全地分批运行。

### 不仅丰富公司，还可丰富人员

对于联系人级数据（工作邮箱、LinkedIn、职位、资历），请让 CLI 使用姓名列，以便区分同一公司的不同人员：

```bash
npx @brightdata/enrich contacts.csv \
  --first-name first_name --last-name last_name --column work_email \
  --fields person_email,person_linkedin_url,person_title,person_seniority
```

## 成本：如实管理预期

Bright Data 的费用约为**每次工具调用 $0.0015**；典型的一行会调用 5–15 次，具体取决于你请求的数据量。LLM 成本单独计算，并支付给你的提供商。一般来说，填充 5 个字段的 CRM 数据，每行 Bright Data 花费远低于一美分；深度人员+公司数据丰富每行则需要几美分。`--dry-run` 估算是你的事实来源，请始终向用户展示。与每行收费 $0.50：$2.00 的商业数据丰富供应商相比，这便宜一到两个数量级，但它**并非免费**，因此在大规模运行前必须确认。

## 出现问题时

有关凭据错误、恢复时标头不匹配、字段结果为空、速率限制及其他故障模式，请参阅 `references/troubleshooting.md`，将错误消息与对应行匹配并遵循修复方法。不要原样重试失败的命令，应先诊断问题。

## 字段目录

`references/fields.md` 中列出了 36 个内置预设字段和 6 个快速入门组合（初创企业潜客开发、企业研究、快速 CRM 填充、竞争对手分析、人员查找、完整公司 + 人员），并附有说明。当用户需要特定命名字段，或你需要将请求转换为正确的 `--fields` 列表时，请阅读该文件。

## 安装/发布此技能

此技能位于 `brightdata/open-enrich` 仓库的 `skills/enriching-tables/SKILL.md` 中，其布局会由技能.sh 自动索引，因此用户可使用 `npx skills add brightdata/open-enrich/skills/enriching-tables` 安装。列表详情和 README 徽章记录在仓库的主 README（“或通过你的编码智能体驱动”）中；发布是作者的一次性任务，不属于执行数据丰富的流程。
