import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import { submitFieldTool } from "../tools/submit-tool";
import { TECHSTACK_PROMPT, buildAgentPrompt } from "./prompts";
import type { EnrichmentState, EnrichmentStateUpdate } from "./state";
import type { EnrichmentResult } from "../types/enrichment";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

const TECH_FIELDS = [
  "tech_stack",
  "languages",
  "frameworks",
  "github_url",
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

export async function runTechStackAgent(
  state: EnrichmentState,
  credentials: Credentials,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  const techFields = state.requestedFields
    .filter((f) => TECH_FIELDS.includes(f.name as (typeof TECH_FIELDS)[number]))
    .map((f) => f.name);

  if (techFields.length === 0) {
    return {
      agentLogs: [
        {
          step: "techstack",
          message: "No tech stack fields requested — skipping.",
          timestamp: Date.now(),
        },
      ],
    };
  }

  const llm = createLLM(credentials, 0, costTracker);
  const searchTool = createSearchTool(credentials);
  const scrapeTool = createScrapeTool(credentials);
  const tools = costTracker
    ? [
        withCostTracking(searchTool, costTracker),
        withCostTracking(scrapeTool, costTracker),
        submitFieldTool,
      ]
    : [searchTool, scrapeTool, submitFieldTool];

  const agent = createReactAgent({
    llm,
    tools,
    prompt: buildAgentPrompt(
      TECHSTACK_PROMPT,
      state.companyName,
      state.domain,
      techFields
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
          ` Find these fields: ${techFields.join(", ")}.`
      ),
    ],
  });

  const completedFields = parseSubmittedFields(result.messages);

  return {
    completedFields,
    agentLogs: [
      {
        step: "techstack",
        message: `Tech stack agent completed — resolved ${completedFields.length}/${techFields.length} fields.`,
        timestamp: Date.now(),
      },
    ],
  };
}
