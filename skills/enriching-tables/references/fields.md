# 字段目录

可传给 `--fields` 的 36 个预设字段（以逗号分隔，使用精确名称），按类别分组。使用 `--describe "<text>"` 时无需输入精确名称，CLI 会将你的描述映射到这些预设字段，并在没有匹配项时创建自定义字段。需要确定性时使用 `--fields`；任何定制需求则使用 `--describe`。

如果传入不在此列表中的名称，CLI 会报错并输出有效名称，因此请准确复制此处的名称。

## 目录
- ICP 资格评估（公司规模/细分）
- 购买信号（时机）
- 个性化（外联切入点）
- 联系数据（人员 + 公司联系人）
- 社交与网页（链接）
- 快速入门组合

## ICP 资格评估

| 字段名称 | 返回内容 |
|---|---|
| `employee_count` | 员工人数（数字）：关键规模筛选条件 |
| `revenue` | 收入/预算信号 |
| `industry` | 主要行业/垂直领域 |
| `headquarters` | 总部位置 |
| `company_type` | 初创企业/中小企业/大型企业 |
| `funding_stage` | 种子轮、A/B/C 轮、上市等 |
| `founded_year` | 成立年份（数字） |

## 购买信号

| 字段名称 | 返回内容 |
|---|---|
| `recent_funding` | 近期融资（金额/日期） |
| `hiring_velocity` | 招聘速度 |
| `leadership_changes` | 新任副总裁/CxO |
| `job_postings` | 招聘职位（数组） |
| `tech_changes` | 正在改用/弃用的工具 |

## 个性化

| 字段名称 | 返回内容 |
|---|---|
| `description` | 公司自身描述 |
| `tech_stack` | 使用的工具/技术（数组） |
| `company_mission` | 公开使命 |
| `recent_news` | 近期新闻 |

## 联系数据

公司级联系人和人员级字段。将 `--first-name`/`--last-name`（以及电子邮件等标识符）指向正确的列时，`person_*` 字段效果最佳，这样智能体才能区分不同人员。

| 字段名称 | 返回内容 |
|---|---|
| `ceo_name` | CEO 姓名 |
| `founders` | 创始人姓名（数组） |
| `email_pattern` | 电子邮件格式，例如 `first@company.com` |
| `person_email` | 联系人的工作邮箱（SERP + LinkedIn/GitHub 回退） |
| `person_phone` | 直拨电话（仅在明确找到时提供） |
| `person_linkedin_url` | LinkedIn 个人资料 URL |
| `person_github_url` | GitHub 个人资料 URL |
| `person_twitter_url` | Twitter/X 个人资料 URL |
| `person_title` | 当前职位 |
| `person_seniority` | 高管/副总裁/总监/经理/个人贡献者 |
| `person_location` | 城市/地区 |
| `person_headline` | LinkedIn 标题 |
| `person_summary` | 简短职业简介 |

## 社交与网页

| 字段名称 | 返回内容 |
|---|---|
| `linkedin_url` | 公司 LinkedIn 页面 |
| `twitter_url` | 公司 Twitter/X |
| `github_url` | 公司 GitHub 组织 |
| `blog_url` | 公司博客 |
| `website` | 公司网站 |

## 快速入门组合

这些是引擎定义的命名字段集。没有可接收组合 ID 的单一 CLI 标志，因此要使用某个组合，请将其成员字段传给 `--fields`。组合及其用途如下：

| 组合 | 成员字段 |
|---|---|
| **快速 CRM 填充** | `industry,employee_count,revenue,headquarters,website` |
| **初创企业潜客开发** | `employee_count,revenue,industry,headquarters,company_type,funding_stage,recent_funding,hiring_velocity,leadership_changes,job_postings,description,tech_stack,company_mission,recent_news` |
| **企业研究** | `employee_count,revenue,industry,headquarters,company_type,funding_stage,founded_year,ceo_name,founders,tech_stack,description` |
| **竞争对手分析** | `tech_stack,employee_count,revenue,funding_stage,recent_news` |
| **人员查找** | `person_email,person_linkedin_url,person_github_url,person_title,person_seniority,person_location` |

示例：快速 CRM 填充：

```bash
npx @brightdata/enrich leads.csv --fields industry,employee_count,revenue,headquarters,website
```

> 注意：引擎还定义了一个“完整公司 + 人员”组合，其中列出了一个 `company_name` 键，但它不是独立的预设字段。建议使用上面的明确成员列表，或者直接通过 `--describe` 描述所需内容，让 CLI 进行解析。
