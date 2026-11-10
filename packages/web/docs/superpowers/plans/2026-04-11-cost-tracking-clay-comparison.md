# 成本跟踪与 Clay 对比：实施计划

> <strong>面向智能体式工作进程：</strong>必需的子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，逐项实施此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

<strong>目标：</strong>实时跟踪数据丰富成本（OpenRouter LLM + Bright Data 工具），并直观展示与 Clay.com 定价的对比。

<strong>架构：</strong>一个 `CostTracker` 类通过 LangChain 回调（LLM）和工具封装计数（Bright Data）累计每行成本。成本通过新的 `cost_update` SSE 事件流式传输至客户端。UI 在数据丰富期间显示实时计数器，并在完成后显示醒目的摘要卡片和报告部分。

<strong>技术栈：</strong>TypeScript、LangChain 回调、Next.js SSE、React、Tailwind CSS、Framer Motion

---

### 任务 1：成本类型与 Clay 定价映射

**文件：**
- 创建：`lib/cost-tracker.ts`
- 创建：`lib/clay-pricing.ts`
- 修改：`lib/types/enrichment.ts`

- [ ] **步骤 1：向 `lib/types/enrichment.ts` 添加成本类型**

在文件末尾添加 `RowCost` 接口和 `cost_update` 事件类型：

```typescript
// After the existing EnrichmentEvent type (line 103), add:

export interface RowCost {
  llmCost: number;
  llmTokensIn: number;
  llmTokensOut: number;
  toolCalls: number;
  toolCost: number;
  totalCost: number;
}

// Update EnrichmentEvent union — add cost_update and add cost to result:
```

将 `EnrichmentEvent` 类型（第 90-103 行）替换为：

```typescript
export type EnrichmentEvent =
  | { type: "session"; sessionId: string }
  | { type: "pending"; rowIndex: number; totalRows: number }
  | { type: "processing"; rowIndex: number; totalRows: number }
  | {
      type: "agent_progress";
      rowIndex: number;
      step: AgentStep;
      message: string;
      sourceUrl?: string;
    }
  | { type: "cost_update"; rowIndex: number; cost: RowCost }
  | { type: "result"; result: RowEnrichmentResult; cost?: RowCost }
  | { type: "error"; rowIndex: number; error: string }
  | { type: "complete"; totalRows: number; successCount: number };
```

- [ ] **步骤 2：创建 `lib/cost-tracker.ts`**

```typescript
import type { RowCost } from "@/lib/types/enrichment";

const BRIGHT_DATA_COST_PER_CALL = 0.0015;

export class CostTracker {
  private llmCost = 0;
  private llmTokensIn = 0;
  private llmTokensOut = 0;
  private toolCalls = 0;
  private onChange?: (cost: RowCost) => void;

  constructor(onChange?: (cost: RowCost) => void) {
    this.onChange = onChange;
  }

  addLLMCost(cost: number, tokensIn: number, tokensOut: number) {
    this.llmCost += cost;
    this.llmTokensIn += tokensIn;
    this.llmTokensOut += tokensOut;
    this.onChange?.(this.snapshot());
  }

  addToolCall() {
    this.toolCalls += 1;
    this.onChange?.(this.snapshot());
  }

  snapshot(): RowCost {
    const toolCost = this.toolCalls * BRIGHT_DATA_COST_PER_CALL;
    return {
      llmCost: this.llmCost,
      llmTokensIn: this.llmTokensIn,
      llmTokensOut: this.llmTokensOut,
      toolCalls: this.toolCalls,
      toolCost,
      totalCost: this.llmCost + toolCost,
    };
  }

  reset() {
    this.llmCost = 0;
    this.llmTokensIn = 0;
    this.llmTokensOut = 0;
    this.toolCalls = 0;
  }
}
```

- [ ] **步骤 3：创建 `lib/clay-pricing.ts`**

```typescript
/**
 * Clay.com Growth plan pricing estimates per enriched field.
 * Based on ~$0.05/credit at Growth plan rates.
 * Source: clay.com/pricing, March 2026 pricing overhaul.
 */
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
  technologies: 0.25,

  // Funding
  recent_funding: 0.20,
  total_funding: 0.20,
  funding_stage: 0.20,
  investors: 0.20,

  // Social/web
  linkedin_url: 0.15,
  twitter_url: 0.10,
  github_url: 0.10,

  // Metrics/signals
  hiring_velocity: 0.20,
  leadership_changes: 0.20,
  revenue_estimate: 0.25,
  growth_signals: 0.20,
};

const DEFAULT_FIELD_COST = 0.20;
const CLAY_MONTHLY_PLATFORM_COST = 495;

/**
 * Estimate Clay cost for a single enriched field.
 */
export function getClayFieldCost(fieldName: string): number {
  return CLAY_COST_MAP[fieldName] ?? DEFAULT_FIELD_COST;
}

/**
 * Estimate total Clay cost for a set of successfully enriched fields.
 * Only counts fields that have actual data (non-null value, confidence > 0).
 */
export function calculateClayCost(
  enrichedFieldNames: string[]
): { perFieldCosts: Record<string, number>; totalDataCost: number } {
  const perFieldCosts: Record<string, number> = {};
  let totalDataCost = 0;

  for (const field of enrichedFieldNames) {
    const cost = getClayFieldCost(field);
    perFieldCosts[field] = cost;
    totalDataCost += cost;
  }

  return { perFieldCosts, totalDataCost };
}

/**
 * Calculate full Clay comparison including platform amortization.
 */
export function calculateClayComparison(
  totalRows: number,
  enrichedFieldNames: string[][]
) {
  let totalDataCost = 0;
  const fieldTotals: Record<string, number> = {};

  for (const fields of enrichedFieldNames) {
    const { perFieldCosts, totalDataCost: rowCost } = calculateClayCost(fields);
    totalDataCost += rowCost;
    for (const [field, cost] of Object.entries(perFieldCosts)) {
      fieldTotals[field] = (fieldTotals[field] ?? 0) + cost;
    }
  }

  // Amortize platform cost assuming ~1000 contacts/month usage
  const estimatedMonthlyVolume = Math.max(totalRows, 100);
  const platformCostPerRow = CLAY_MONTHLY_PLATFORM_COST / estimatedMonthlyVolume;
  const totalPlatformCost = platformCostPerRow * totalRows;

  return {
    totalDataCost,
    totalPlatformCost,
    totalCost: totalDataCost + totalPlatformCost,
    perRowAverage: (totalDataCost + totalPlatformCost) / totalRows,
    fieldTotals,
    monthlyPlatformCost: CLAY_MONTHLY_PLATFORM_COST,
  };
}
```

- [ ] **步骤 4：提交**

```bash
git add lib/cost-tracker.ts lib/clay-pricing.ts lib/types/enrichment.ts
git commit -m "feat: add cost tracking types, CostTracker class, and Clay pricing map"
```

---

### 任务 2：将成本跟踪接入 LLM 和工具调用

**文件：**
- 修改：`lib/config/llm.ts`
- 修改：`lib/tools/search-tool.ts`
- 修改：`lib/tools/scrape-tool.ts`
- 修改：`lib/tools/linkedin-tool.ts`
- 修改：`lib/tools/crunchbase-tool.ts`
- 修改：`lib/tools/deep-lookup-tool.ts`

- [ ] **步骤 1：更新 `lib/config/llm.ts` 以接受 CostTracker**

替换整个文件：

```typescript
import { ChatOpenAI } from "@langchain/openai";
import type { CostTracker } from "@/lib/cost-tracker";

const MODEL = "google/gemini-3-flash-preview";
const BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Create a ChatOpenAI instance configured for OpenRouter.
 * Optionally accepts a CostTracker to capture per-call costs.
 */
export function createLLM(temperature = 0, costTracker?: CostTracker) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const llm = new ChatOpenAI({
    model: MODEL,
    temperature,
    configuration: {
      baseURL: BASE_URL,
    },
    apiKey,
  });

  if (costTracker) {
    const originalInvoke = llm.invoke.bind(llm);
    llm.invoke = async (...args: Parameters<typeof llm.invoke>) => {
      const result = await originalInvoke(...args);
      const usage = result.usage_metadata;
      if (usage) {
        // OpenRouter includes cost in additional_kwargs or usage_metadata
        const cost =
          (result.additional_kwargs as Record<string, unknown>)?.cost ??
          (usage as Record<string, unknown>).cost ??
          0;
        costTracker.addLLMCost(
          Number(cost),
          usage.input_tokens ?? 0,
          usage.output_tokens ?? 0
        );
      }
      return result;
    };
  }

  return llm;
}
```

- [ ] **步骤 2：为 Bright Data 工具调用计数创建工具封装工厂**

添加到 `lib/cost-tracker.ts` 底部：

```typescript
import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";

/**
 * Wrap a LangChain tool to count invocations on a CostTracker.
 */
export function withCostTracking<T extends StructuredToolInterface>(
  originalTool: T,
  tracker: CostTracker
): T {
  const originalFunc = originalTool.invoke.bind(originalTool);
  const wrapped = Object.create(originalTool);
  wrapped.invoke = async (...args: Parameters<typeof originalTool.invoke>) => {
    tracker.addToolCall();
    return originalFunc(...args);
  };
  return wrapped as T;
}
```

- [ ] **步骤 3：提交**

```bash
git add lib/config/llm.ts lib/cost-tracker.ts
git commit -m "feat: wire CostTracker into LLM invoke and add tool wrapping utility"
```

---

### 任务 3：在数据丰富管道中传递 CostTracker

**文件：**
- 修改：`lib/agents/graph.ts`
- 修改：`lib/agents/deep-discovery-agent.ts`
- 修改：`lib/agents/profile-agent.ts`
- 修改：`lib/agents/metrics-agent.ts`
- 修改：`lib/agents/funding-agent.ts`
- 修改：`lib/agents/techstack-agent.ts`
- 修改：`lib/agents/social-agent.ts`
- 修改：`lib/agents/person-agent.ts`
- 修改：`lib/agents/deep-custom-agent.ts`
- 修改：`app/api/enrich/route.ts`

- [ ] **步骤 1：更新 `buildEnrichmentGraph` 以接受并传递 `CostTracker`**

在 `lib/agents/graph.ts` 中添加 `CostTracker` 导入，并将其传递给所有智能体运行函数：

```typescript
import type { CostTracker } from "@/lib/cost-tracker";

export function buildEnrichmentGraph(onProgress?: ProgressCallback, costTracker?: CostTracker) {
```

在图节点内的每次 `run*Agent()` 调用中，将 `costTracker` 作为最后一个参数传入。每个智能体已接受可选的尾随参数：将 `costTracker?: CostTracker` 添加到每个智能体的函数签名中。

- [ ] **步骤 2：更新每个智能体以接受 `CostTracker`，并将其传递给 `createLLM` 和工具封装**

在每个智能体文件（`deep-discovery-agent.ts`、`profile-agent.ts`、`metrics-agent.ts`、`funding-agent.ts`、`techstack-agent.ts`、`social-agent.ts`、`person-agent.ts`、`deep-custom-agent.ts`）中：

1. 向 `run*Agent` 函数添加 `costTracker?: CostTracker` 参数
2. 将 `createLLM()` 调用改为 `createLLM(0, costTracker)`
3. 提供跟踪器时，使用 `withCostTracking(searchTool, tracker)` 封装 Bright Data 工具

每个智能体的示例模式：

```typescript
import type { CostTracker } from "@/lib/cost-tracker";
import { withCostTracking } from "@/lib/cost-tracker";

export async function runExampleAgent(
  state: EnrichmentState,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  const llm = createLLM(0, costTracker);
  const tools = costTracker
    ? [withCostTracking(searchTool, costTracker), withCostTracking(scrapeTool, costTracker)]
    : [searchTool, scrapeTool];
  // ... rest of agent logic using llm and tools
}
```

- [ ] **步骤 3：更新 `app/api/enrich/route.ts`，为每行创建 CostTracker 并发出成本事件**

在 `processRow` 函数中，为每行创建一个 `CostTracker` 并传递下去：

```typescript
import { CostTracker } from "@/lib/cost-tracker";

// Inside processRow, before graph.invoke:
const costTracker = new CostTracker((cost) => {
  send({ type: "cost_update", rowIndex, cost });
});
```

更新 `buildEnrichmentGraph` 调用（第 91 行），传入 `costTracker`：

```typescript
const graph = buildEnrichmentGraph(onProgress);
```

由于图只编译一次，而成本跟踪器按行创建，因此需要在每次调用时传入成本跟踪器。重构，使 `buildEnrichmentGraph` 接受 `costTrackerFactory`：

```typescript
// In route.ts — change graph building:
const graph = buildEnrichmentGraph(onProgress);

// In processRow — pass costTracker through graph.invoke config:
const costTracker = new CostTracker((cost) => {
  send({ type: "cost_update", rowIndex, cost });
});

const state = await graph.invoke(
  { /* existing state */ },
  { configurable: { costTracker } }
);
```

然后在 `graph.ts` 中，于每个节点从 config 提取 costTracker：

```typescript
.addNode("discovery", async (state: EnrichmentState, config) => {
  const costTracker = config?.configurable?.costTracker as CostTracker | undefined;
  // pass to runDeepDiscoveryAgent(state, costTracker)
})
```

`graph.invoke` 完成后，将成本附加到结果事件：

```typescript
send({ type: "result", result, cost: costTracker.snapshot() });
```

- [ ] **步骤 4：提交**

```bash
git add lib/agents/ app/api/enrich/route.ts
git commit -m "feat: thread CostTracker through enrichment pipeline"
```

---

### 任务 4：在客户端 Hook 中处理成本事件

**文件：**
- 修改：`hooks/use-enrichment.ts`

- [ ] **步骤 1：向 `useEnrichment` Hook 添加成本状态**

向状态接口和处理程序添加成本跟踪：

```typescript
import type { RowCost } from "@/lib/types/enrichment";

interface EnrichmentState {
  results: Map<number, RowEnrichmentResult>;
  agentLogs: AgentLogEntry[];
  progress: { completed: number; total: number };
  isRunning: boolean;
  sessionId: string | null;
  error: string | null;
  // New: cost tracking
  costs: Map<number, RowCost>;       // per-row costs
  totalCost: RowCost;                // running aggregate
}
```

使用空成本初始化：

```typescript
const emptyCost: RowCost = { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 };

// In useState initial value:
costs: new Map(),
totalCost: { ...emptyCost },
```

- [ ] **步骤 2：在 `handleEvent` 中处理 `cost_update` 事件**

在 switch 语句中添加一个新 case：

```typescript
case "cost_update":
  setState((prev) => {
    const costs = new Map(prev.costs);
    costs.set(event.rowIndex, event.cost);
    // Recalculate aggregate
    const totalCost = { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 };
    for (const c of costs.values()) {
      totalCost.llmCost += c.llmCost;
      totalCost.llmTokensIn += c.llmTokensIn;
      totalCost.llmTokensOut += c.llmTokensOut;
      totalCost.toolCalls += c.toolCalls;
      totalCost.toolCost += c.toolCost;
      totalCost.totalCost += c.totalCost;
    }
    return { ...prev, costs, totalCost };
  });
  break;
```

如果结果事件中存在成本，也更新 `"result"` case 以存储成本：

```typescript
case "result":
  setState((prev) => {
    const results = new Map(prev.results);
    results.set(event.result.rowIndex, event.result);
    const completed = Array.from(results.values()).filter(
      (r) => r.status === "completed" || r.status === "error" || r.status === "skipped"
    ).length;

    // Update cost if included in result
    const costs = new Map(prev.costs);
    if (event.cost) {
      costs.set(event.result.rowIndex, event.cost);
    }
    const totalCost = { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 };
    for (const c of costs.values()) {
      totalCost.llmCost += c.llmCost;
      totalCost.llmTokensIn += c.llmTokensIn;
      totalCost.llmTokensOut += c.llmTokensOut;
      totalCost.toolCalls += c.toolCalls;
      totalCost.toolCost += c.toolCost;
      totalCost.totalCost += c.totalCost;
    }

    return { ...prev, results, costs, totalCost, progress: { ...prev.progress, completed } };
  });
  break;
```

- [ ] **步骤 3：在返回对象中公开成本数据**

```typescript
return {
  // ... existing returns
  costs: Array.from(state.costs.entries()),
  totalCost: state.totalCost,
};
```

- [ ] **步骤 4：提交**

```bash
git add hooks/use-enrichment.ts
git commit -m "feat: handle cost_update SSE events in useEnrichment hook"
```

---

### 任务 5：实时成本计数器组件

**文件：**
- 创建：`components/cost-ticker.tsx`
- 修改：`components/enrichment-progress.tsx`

- [ ] **步骤 1：创建 `components/cost-ticker.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import type { RowCost, RowEnrichmentResult } from "@/lib/types/enrichment";
import { calculateClayCost } from "@/lib/clay-pricing";

interface CostTickerProps {
  totalCost: RowCost;
  results: RowEnrichmentResult[];
  isRunning: boolean;
}

export default function CostTicker({ totalCost, results, isRunning }: CostTickerProps) {
  const clayCost = useMemo(() => {
    let total = 0;
    for (const result of results) {
      if (result.status !== "completed") continue;
      const enrichedFields = Object.entries(result.enrichments)
        .filter(([, v]) => v.value != null && v.confidence > 0)
        .map(([k]) => k);
      total += calculateClayCost(enrichedFields).totalDataCost;
    }
    return total;
  }, [results]);

  const savings = clayCost > 0
    ? Math.round((1 - totalCost.totalCost / clayCost) * 100)
    : 0;

  const formatCost = (n: number) =>
    n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[rgba(165,180,220,0.1)] bg-[rgba(11,16,34,0.65)] backdrop-blur-sm mb-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)]">
          Your cost
        </span>
        <span className="text-lg font-mono font-bold text-[#34D399]">
          {formatCost(totalCost.totalCost)}
        </span>
        {isRunning && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
        )}
      </div>

      {savings > 0 && (
        <span className="px-2.5 py-1 rounded-md bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.2)] text-[#34D399] text-xs font-semibold">
          {savings}% less
        </span>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)]">
          Clay equivalent
        </span>
        <span className="text-lg font-mono font-bold text-[rgba(240,242,248,0.35)]">
          {formatCost(clayCost)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：在 `components/enrichment-progress.tsx` 中将 CostTicker 添加到 EnrichmentProgress 上方**

此组件不导入 CostTicker：它会在 `app/page.tsx` 中渲染于进度面板上方。无需修改 `enrichment-progress.tsx`。

在 `app/page.tsx` 的结果部分左栏（约第 517 行），将 CostTicker 添加到 EnrichmentProgress 上方：

```tsx
import CostTicker from "@/components/cost-ticker";

// Inside the sticky sidebar div (line 517):
<div className="lg:sticky lg:top-24 lg:self-start">
  <CostTicker
    totalCost={enrichment.totalCost}
    results={enrichment.results}
    isRunning={enrichment.isRunning}
  />
  <EnrichmentProgress
    completed={enrichment.progress.completed}
    total={enrichment.progress.total}
    isRunning={enrichment.isRunning}
    agentLogs={enrichment.agentLogs}
    onCancel={enrichment.cancel}
  />
</div>
```

- [ ] **步骤 3：提交**

```bash
git add components/cost-ticker.tsx app/page.tsx
git commit -m "feat: add live cost ticker during enrichment"
```

---

### 任务 6：数据丰富后的成本摘要卡片

**文件：**
- 创建：`components/cost-summary-card.tsx`
- 修改：`app/page.tsx`

- [ ] **步骤 1：创建 `components/cost-summary-card.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import type { RowCost, RowEnrichmentResult } from "@/lib/types/enrichment";
import { calculateClayComparison } from "@/lib/clay-pricing";

interface CostSummaryCardProps {
  totalCost: RowCost;
  results: RowEnrichmentResult[];
}

export default function CostSummaryCard({ totalCost, results }: CostSummaryCardProps) {
  const completedResults = results.filter((r) => r.status === "completed");

  const clay = useMemo(() => {
    const enrichedFieldNames = completedResults.map((r) =>
      Object.entries(r.enrichments)
        .filter(([, v]) => v.value != null && v.confidence > 0)
        .map(([k]) => k)
    );
    return calculateClayComparison(results.length, enrichedFieldNames);
  }, [completedResults, results.length]);

  const savings = clay.totalCost > 0
    ? Math.round((1 - totalCost.totalCost / clay.totalCost) * 100)
    : 0;

  const formatCost = (n: number) =>
    n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;

  const perRow = results.length > 0 ? totalCost.totalCost / results.length : 0;
  const barWidth = clay.totalCost > 0
    ? Math.max(1, (totalCost.totalCost / clay.totalCost) * 100)
    : 1;

  if (totalCost.totalCost === 0 && clay.totalCost === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[rgba(165,180,220,0.1)] bg-[rgba(11,16,34,0.65)] backdrop-blur-sm p-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
        {/* Your cost */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1">
            Your total cost
          </p>
          <p className="text-3xl font-mono font-bold text-[#34D399]">
            {formatCost(totalCost.totalCost)}
          </p>
          <p className="text-xs text-[rgba(240,242,248,0.35)] mt-1 font-mono">
            LLM: {formatCost(totalCost.llmCost)} &middot; Tools: {formatCost(totalCost.toolCost)}
          </p>
        </div>

        {/* Cost ratio bar */}
        <div className="flex flex-col items-center gap-2 px-6">
          <span className="px-3 py-1.5 rounded-lg bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.25)] text-[#34D399] text-sm font-bold">
            {savings}% savings
          </span>
          <div className="w-48 h-3 rounded-full bg-[rgba(240,242,248,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#34D399]"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="text-[10px] text-[rgba(240,242,248,0.3)] font-mono">
            {formatCost(perRow)}/row vs {formatCost(clay.perRowAverage)}/row on Clay
          </p>
        </div>

        {/* Clay cost */}
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1">
            Clay equivalent
          </p>
          <p className="text-3xl font-mono font-bold text-[rgba(240,242,248,0.3)]">
            {formatCost(clay.totalCost)}
          </p>
          <p className="text-xs text-[rgba(240,242,248,0.25)] mt-1 font-mono">
            Data: {formatCost(clay.totalDataCost)} &middot; Platform: {formatCost(clay.totalPlatformCost)}/mo amortized
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：在 `app/page.tsx` 中将 CostSummaryCard 添加到 OutboundSummaryCards 上方**

在结果部分导入并渲染卡片，位置在标题和外联卡片之间（第 493 行之后、第 495 行之前）：

```tsx
import CostSummaryCard from "@/components/cost-summary-card";

// After the header div closing (line 493), before OutboundSummaryCards:
{isComplete && (
  <CostSummaryCard
    totalCost={enrichment.totalCost}
    results={enrichment.results}
  />
)}
```

- [ ] **步骤 3：提交**

```bash
git add components/cost-summary-card.tsx app/page.tsx
git commit -m "feat: add post-enrichment cost summary card with Clay comparison"
```

---

### 任务 7：报告面板中的成本分析部分

**文件：**
- 修改：`components/enrichment-report.tsx`
- 修改：`lib/report-generator.ts`

- [ ] **步骤 1：向 `lib/report-generator.ts` 中的 `EnrichmentReport` 类型添加成本数据**

向 `EnrichmentReport` 接口添加 `costAnalysis` 字段（第 27 行之后）：

```typescript
export interface EnrichmentReport {
  summary: { /* existing */ };
  fieldCoverage: Array<{ /* existing */ }>;
  sourceAttribution: Array<{ /* existing */ }>;
  qualityFlags: Array<{ /* existing */ }>;
  costAnalysis?: {
    totalCost: RowCost;
    clayCost: {
      totalDataCost: number;
      totalPlatformCost: number;
      totalCost: number;
      perRowAverage: number;
      monthlyPlatformCost: number;
      fieldTotals: Record<string, number>;
    };
    savings: number; // percentage
    perRowCost: number;
  };
}
```

更新 `generateReport` 以接受可选成本数据并计算对比：

```typescript
import type { RowCost } from "@/lib/types/enrichment";
import { calculateClayComparison } from "@/lib/clay-pricing";

export function generateReport(
  rows: RowEnrichmentResult[],
  requestedFieldNames: string[],
  totalCost?: RowCost
): EnrichmentReport {
  // ... existing logic ...

  // At the end, before return:
  let costAnalysis: EnrichmentReport["costAnalysis"];
  if (totalCost) {
    const enrichedFieldNames = rows
      .filter((r) => r.status === "completed")
      .map((r) =>
        Object.entries(r.enrichments)
          .filter(([, v]) => v.value != null && v.confidence > 0)
          .map(([k]) => k)
      );
    const clayCost = calculateClayComparison(rows.length, enrichedFieldNames);
    const savings = clayCost.totalCost > 0
      ? Math.round((1 - totalCost.totalCost / clayCost.totalCost) * 100)
      : 0;
    costAnalysis = {
      totalCost,
      clayCost,
      savings,
      perRowCost: rows.length > 0 ? totalCost.totalCost / rows.length : 0,
    };
  }

  return {
    summary,
    fieldCoverage,
    sourceAttribution,
    qualityFlags,
    costAnalysis,
  };
}
```

- [ ] **步骤 2：向 `components/enrichment-report.tsx` 添加“成本分析”部分**

在“质量标记”部分之后（约第 186 行）添加新部分：

```tsx
{/* Cost Analysis */}
{report.costAnalysis && (
  <section>
    <h3 className="text-sm font-semibold text-[#f0f2f8] mb-3 tracking-tight">
      Cost analysis
    </h3>

    {/* Cost breakdown */}
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="p-3 rounded-xl bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)]">
        <p className="text-[10px] uppercase tracking-wider text-[rgba(240,242,248,0.4)]">LLM cost</p>
        <p className="text-lg font-mono font-bold text-[#34D399]">
          ${report.costAnalysis.totalCost.llmCost.toFixed(4)}
        </p>
        <p className="text-[10px] text-[rgba(240,242,248,0.3)] font-mono">
          {report.costAnalysis.totalCost.llmTokensIn.toLocaleString()} in / {report.costAnalysis.totalCost.llmTokensOut.toLocaleString()} out
        </p>
      </div>
      <div className="p-3 rounded-xl bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)]">
        <p className="text-[10px] uppercase tracking-wider text-[rgba(240,242,248,0.4)]">Bright Data tools</p>
        <p className="text-lg font-mono font-bold text-[#34D399]">
          ${report.costAnalysis.totalCost.toolCost.toFixed(4)}
        </p>
        <p className="text-[10px] text-[rgba(240,242,248,0.3)] font-mono">
          {report.costAnalysis.totalCost.toolCalls} API calls
        </p>
      </div>
    </div>

    {/* Clay comparison table */}
    <div className="rounded-xl border border-[rgba(165,180,220,0.06)] overflow-hidden mb-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[rgba(11,16,34,0.5)]">
            <th className="text-left px-3 py-2 text-[rgba(240,242,248,0.4)] font-medium">Component</th>
            <th className="text-right px-3 py-2 text-[#34D399] font-medium">Open Enrich</th>
            <th className="text-right px-3 py-2 text-[rgba(240,242,248,0.35)] font-medium">Clay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(165,180,220,0.06)]">
          <tr>
            <td className="px-3 py-2 text-[rgba(240,242,248,0.6)]">Data enrichment</td>
            <td className="px-3 py-2 text-right font-mono text-[#34D399]">${report.costAnalysis.totalCost.totalCost.toFixed(4)}</td>
            <td className="px-3 py-2 text-right font-mono text-[rgba(240,242,248,0.35)]">${report.costAnalysis.clayCost.totalDataCost.toFixed(2)}</td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-[rgba(240,242,248,0.6)]">Platform subscription</td>
            <td className="px-3 py-2 text-right font-mono text-[#34D399]">$0.00</td>
            <td className="px-3 py-2 text-right font-mono text-[rgba(240,242,248,0.35)]">${report.costAnalysis.clayCost.monthlyPlatformCost}/mo</td>
          </tr>
          <tr className="bg-[rgba(11,16,34,0.3)]">
            <td className="px-3 py-2 text-[#f0f2f8] font-semibold">Per row average</td>
            <td className="px-3 py-2 text-right font-mono font-bold text-[#34D399]">${report.costAnalysis.perRowCost.toFixed(4)}</td>
            <td className="px-3 py-2 text-right font-mono font-bold text-[rgba(240,242,248,0.35)]">${report.costAnalysis.clayCost.perRowAverage.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Bottom line */}
    <div className="p-3 rounded-xl bg-[rgba(52,211,153,0.06)] border border-[rgba(52,211,153,0.15)]">
      <p className="text-sm text-[#34D399] font-semibold">
        {report.costAnalysis.savings}% cost reduction vs Clay
      </p>
      <p className="text-[11px] text-[rgba(240,242,248,0.35)] mt-1">
        Clay Growth plan requires ${report.costAnalysis.clayCost.monthlyPlatformCost}/mo subscription. Open Enrich is free and open source.
      </p>
    </div>
  </section>
)}
```

- [ ] **步骤 3：更新 `app/page.tsx` 中的 `generateReport` 调用以传递成本数据**

找到调用 `generateReport` 的位置（约第 114-117 行），并添加 `enrichment.totalCost`：

```typescript
const enrichmentReport = useMemo(() => {
  if (enrichment.results.length === 0) return null;
  return generateReport(
    enrichment.results,
    fields.allFields.map((f) => f.name),
    enrichment.totalCost
  );
}, [enrichment.results, fields.allFields, enrichment.totalCost]);
```

- [ ] **步骤 4：提交**

```bash
git add lib/report-generator.ts components/enrichment-report.tsx app/page.tsx
git commit -m "feat: add cost analysis section to enrichment report panel"
```

---

### 任务 8：验证与完善

**文件：**
- 所有修改过的文件

- [ ] **步骤 1：运行 TypeScript 编译检查**

运行：`cd open-enrich && npx tsc --noEmit` 预期结果：无类型错误

- [ ] **步骤 2：运行开发服务器并验证**

运行：`cd open-enrich && npm run dev`

手动测试清单：
1. 上传一个小型 CSV（2-3 行）
2. 选择字段并开始数据丰富
3. 确认成本计数器显示在进度面板上方并实时更新
4. 确认数字在数据丰富期间递增（绿色 = 你的成本，灰色 = Clay）
5. 完成后，确认成本摘要卡片显示在外联卡片上方
6. 打开“报告”面板，确认显示“成本分析”部分
7. 确认 Clay 对比表显示合理的数字

- [ ] **步骤 3：修复测试中发现的所有问题**

- [ ] **步骤 4：最终提交**

```bash
git add -A
git commit -m "fix: polish cost tracking UI and fix any issues from testing"
```
