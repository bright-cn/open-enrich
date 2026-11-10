import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import { createLinkedInCompanyTool } from "../tools/linkedin-tool";
import { submitFieldTool } from "../tools/submit-tool";
import { PROFILE_PROMPT, buildAgentPrompt } from "./prompts";
import type { EnrichmentState, EnrichmentStateUpdate } from "./state";
import type { EnrichmentResult } from "../types/enrichment";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

const PROFILE_FIELDS = [
  "company_name",
  "description",
  "industry",
  "headquarters",
  "founded_year",
  "company_type",
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

export async function runProfileAgent(
  state: EnrichmentState,
  credentials: Credentials,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  const profileFields = state.requestedFields
    .filter((f) => PROFILE_FIELDS.includes(f.name as (typeof PROFILE_FIELDS)[number]))
    .map((f) => f.name);

  if (profileFields.length === 0) {
    return {
      agentLogs: [
        {
          step: "profile",
          message: "No profile fields requested — skipping.",
          timestamp: Date.now(),
        },
      ],
    };
  }

  const llm = createLLM(credentials, 0, costTracker);
  const searchTool = createSearchTool(credentials);
  const scrapeTool = createScrapeTool(credentials);
  const linkedinCompanyTool = createLinkedInCompanyTool(credentials);
  const tools = costTracker
    ? [
        withCostTracking(searchTool, costTracker),
        withCostTracking(scrapeTool, costTracker),
        withCostTracking(linkedinCompanyTool, costTracker),
        submitFieldTool,
      ]
    : [searchTool, scrapeTool, linkedinCompanyTool, submitFieldTool];

  const agent = createReactAgent({
    llm,
    tools,
    prompt: buildAgentPrompt(
      PROFILE_PROMPT,
      state.companyName,
      state.domain,
      profileFields
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
          ` Find these fields: ${profileFields.join(", ")}.`
      ),
    ],
  });

  const completedFields = parseSubmittedFields(result.messages);

  return {
    completedFields,
    agentLogs: [
      {
        step: "profile",
        message: `Profile agent completed — resolved ${completedFields.length}/${profileFields.length} fields.`,
        timestamp: Date.now(),
      },
    ],
  };
}
