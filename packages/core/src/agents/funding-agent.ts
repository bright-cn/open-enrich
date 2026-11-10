import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import { createCrunchbaseTool } from "../tools/crunchbase-tool";
import { submitFieldTool } from "../tools/submit-tool";
import { FUNDING_PROMPT, buildAgentPrompt } from "./prompts";
import type { EnrichmentState, EnrichmentStateUpdate } from "./state";
import type { EnrichmentResult } from "../types/enrichment";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

const FUNDING_FIELDS = [
  "funding_stage",
  "last_funding_amount",
  "total_raised",
  "valuation",
  "investors",
] as const;

/**
 * Parse submit_field tool call results from agent messages.
 * Looks for ToolMessage instances whose JSON content contains `{ submitted: true }`.
 */
function parseSubmittedFields(
  messages: unknown[]
): EnrichmentResult[] {
  const results: EnrichmentResult[] = [];

  for (const msg of messages) {
    if (!(msg instanceof ToolMessage)) continue;

    try {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      const parsed = JSON.parse(content);

      if (parsed.submitted === true) {
        results.push({
          field: parsed.field,
          value: parsed.value,
          confidence: parsed.confidence,
          source: parsed.sources?.[0]?.url,
          sourceContext: parsed.sources,
          sourceCount: parsed.sources?.length ?? 0,
        });
      }
    } catch {
      // Not valid JSON or not a submit_field result — skip.
    }
  }

  return results;
}

export async function runFundingAgent(
  state: EnrichmentState,
  credentials: Credentials,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  const fundingFields = state.requestedFields
    .filter((f) => FUNDING_FIELDS.includes(f.name as (typeof FUNDING_FIELDS)[number]))
    .map((f) => f.name);

  if (fundingFields.length === 0) {
    return {
      agentLogs: [
        {
          step: "funding",
          message: "No funding fields requested — skipping.",
          timestamp: Date.now(),
        },
      ],
    };
  }

  const llm = createLLM(credentials, 0, costTracker);
  const searchTool = createSearchTool(credentials);
  const scrapeTool = createScrapeTool(credentials);
  const crunchbaseTool = createCrunchbaseTool(credentials);
  const tools = costTracker
    ? [
        withCostTracking(searchTool, costTracker),
        withCostTracking(scrapeTool, costTracker),
        withCostTracking(crunchbaseTool, costTracker),
        submitFieldTool,
      ]
    : [searchTool, scrapeTool, crunchbaseTool, submitFieldTool];

  const agent = createReactAgent({
    llm,
    tools,
    prompt: buildAgentPrompt(
      FUNDING_PROMPT,
      state.companyName,
      state.domain,
      fundingFields
    ),
  });

  const companyLabel = state.companyName || state.domain;
  const result = await agent.invoke({
    messages: [
      new HumanMessage(
        `Research the company "${companyLabel}" (domain: ${state.domain}).` +
          (state.companyWebsite
            ? ` Website: ${state.companyWebsite}.`
            : "") +
          (state.linkedinUrl
            ? ` LinkedIn: ${state.linkedinUrl}.`
            : "") +
          ` Find these fields: ${fundingFields.join(", ")}.`
      ),
    ],
  });

  const completedFields = parseSubmittedFields(result.messages);

  return {
    completedFields,
    agentLogs: [
      {
        step: "funding",
        message: `Funding agent completed — resolved ${completedFields.length}/${fundingFields.length} fields.`,
        timestamp: Date.now(),
      },
    ],
  };
}
