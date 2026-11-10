import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";

import type { EnrichmentState, EnrichmentStateUpdate, AgentLog } from "./state";
import { METRICS_PROMPT, buildAgentPrompt } from "./prompts";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import { createLinkedInCompanyTool } from "../tools/linkedin-tool";
import { createCrunchbaseTool } from "../tools/crunchbase-tool";
import { submitFieldTool } from "../tools/submit-tool";
import type { EnrichmentResult } from "../types/enrichment";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

/** Metrics-related enrichment fields handled by this agent. */
const METRICS_FIELDS = ["employee_count", "revenue", "growth_rate"];

/**
 * Parse submit_field tool results from agent messages.
 * Finds ToolMessage instances whose JSON content has `submitted: true`
 * and maps them to EnrichmentResult objects.
 */
function parseSubmitResults(
  messages: readonly unknown[]
): EnrichmentResult[] {
  const results: EnrichmentResult[] = [];

  for (const msg of messages) {
    if (!(msg instanceof ToolMessage)) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(typeof msg.content === "string" ? msg.content : "");
    } catch {
      continue;
    }

    if (!parsed.submitted) continue;

    const field = parsed.field as string;
    const value = parsed.value as EnrichmentResult["value"];
    const confidence = parsed.confidence as number;
    const sources = parsed.sources as EnrichmentResult["sourceContext"];

    results.push({
      field,
      value,
      confidence,
      source: sources?.[0]?.url,
      sourceContext: sources,
      sourceCount: sources?.length ?? 0,
    });
  }

  return results;
}

/**
 * Metrics agent: finds company size and financial data
 * (employee_count, revenue, growth_rate).
 *
 * Skips execution if none of the metrics fields were requested.
 */
export async function runMetricsAgent(
  state: EnrichmentState,
  credentials: Credentials,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  // Filter to only the metrics fields that were requested
  const requestedMetrics = state.requestedFields
    .map((f) => f.name)
    .filter((name) => METRICS_FIELDS.includes(name));

  // Skip if no metrics fields were requested
  if (requestedMetrics.length === 0) {
    return {
      completedFields: [],
      agentLogs: [
        {
          step: "metrics",
          message: "Skipped — no metrics fields requested",
          timestamp: Date.now(),
        },
      ],
    };
  }

  const llm = createLLM(credentials, 0, costTracker);
  const searchTool = createSearchTool(credentials);
  const scrapeTool = createScrapeTool(credentials);
  const linkedinCompanyTool = createLinkedInCompanyTool(credentials);
  const crunchbaseTool = createCrunchbaseTool(credentials);
  const tools = costTracker
    ? [
        withCostTracking(searchTool, costTracker),
        withCostTracking(scrapeTool, costTracker),
        withCostTracking(linkedinCompanyTool, costTracker),
        withCostTracking(crunchbaseTool, costTracker),
        submitFieldTool,
      ]
    : [
        searchTool,
        scrapeTool,
        linkedinCompanyTool,
        crunchbaseTool,
        submitFieldTool,
      ];

  const systemPrompt = buildAgentPrompt(
    METRICS_PROMPT,
    state.companyName || state.companyNameGuess || "",
    state.domain,
    requestedMetrics
  );

  const agent = createReactAgent({
    llm,
    tools,
    prompt: systemPrompt,
  });

  const result = await agent.invoke({
    messages: [
      new HumanMessage(
        `Find metrics for this company.\n` +
          `Company: ${state.companyName || state.companyNameGuess || "unknown"}\n` +
          `Domain: ${state.domain}\n` +
          `Website: ${state.companyWebsite || "unknown"}\n` +
          `LinkedIn: ${state.linkedinUrl || "unknown"}\n\n` +
          `Find and submit these fields: ${requestedMetrics.join(", ")}`
      ),
    ],
  });

  // Parse submitted fields from tool messages
  const completedFields = parseSubmitResults(result.messages);

  // Build agent logs from completed fields
  const agentLogs: AgentLog[] = completedFields.map((r) => ({
    step: "metrics" as const,
    message: `Submitted ${r.field}: ${r.value ?? "null"} (confidence: ${r.confidence})`,
    sourceUrl: r.source,
    timestamp: Date.now(),
  }));

  return {
    completedFields,
    agentLogs,
  };
}
