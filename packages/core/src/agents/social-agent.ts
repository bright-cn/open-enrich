import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";

import type { EnrichmentState, EnrichmentStateUpdate, AgentLog } from "./state";
import { SOCIAL_PROMPT, buildAgentPrompt } from "./prompts";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import { createLinkedInCompanyTool } from "../tools/linkedin-tool";
import { submitFieldTool } from "../tools/submit-tool";
import type { EnrichmentResult } from "../types/enrichment";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

const SOCIAL_FIELDS = ["linkedin_url", "twitter_url", "github_url", "blog_url"];

/**
 * Social presence agent: finds verified social media and web-presence URLs
 * for a target company. Skips execution if no social fields were requested.
 */
export async function runSocialAgent(
  state: EnrichmentState,
  credentials: Credentials,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  const fieldsToFind = state.requestedFields
    .map((f) => f.name)
    .filter((name) => SOCIAL_FIELDS.includes(name));

  // Skip if no social fields requested
  if (fieldsToFind.length === 0) {
    return {
      completedFields: [],
      agentLogs: [
        {
          step: "social",
          message: "Skipped — no social fields requested",
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

  const systemPrompt = buildAgentPrompt(
    SOCIAL_PROMPT,
    state.companyName || state.companyNameGuess || "",
    state.domain,
    fieldsToFind
  );

  const agent = createReactAgent({
    llm,
    tools,
    prompt: systemPrompt,
  });

  const result = await agent.invoke({
    messages: [
      new HumanMessage(
        `Find social media and web-presence URLs for this company.\n` +
          `Company: ${state.companyName || state.companyNameGuess || "unknown"}\n` +
          `Domain: ${state.domain}\n` +
          `Website: ${state.companyWebsite || `https://${state.domain}`}\n` +
          `LinkedIn: ${state.linkedinUrl || "not yet found"}\n\n` +
          `Find and submit these fields: ${fieldsToFind.join(", ")}`
      ),
    ],
  });

  // Parse submit_field tool call results from messages
  const completedFields: EnrichmentResult[] = [];
  const agentLogs: AgentLog[] = [];

  for (const msg of result.messages) {
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

    completedFields.push({
      field,
      value,
      confidence,
      source: sources?.[0]?.url,
      sourceContext: sources,
      sourceCount: sources?.length ?? 0,
    });

    agentLogs.push({
      step: "social",
      message: `Submitted ${field}: ${value ?? "null"} (confidence: ${confidence})`,
      sourceUrl: sources?.[0]?.url,
      timestamp: Date.now(),
    });
  }

  return {
    completedFields,
    agentLogs,
  };
}
