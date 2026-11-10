import { createDeepAgent, type SubAgent } from "deepagents";
import { toolStrategy } from "langchain";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";
import type {
  EnrichmentState,
  EnrichmentStateUpdate,
  AgentLog,
} from "./state";
import { CUSTOM_PROMPT } from "./prompts";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import type { EnrichmentResult } from "../types/enrichment";
import { createProgressMiddleware, type ProgressEmitter } from "./progress-middleware";
import { z } from "zod";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

/** Fields handled by specialist ReAct agents — custom agent skips these. */
const STANDARD_FIELDS = new Set([
  "company_name", "description", "industry", "headquarters",
  "founded_year", "company_type", "employee_count", "revenue",
  "growth_rate", "funding_stage", "last_funding_amount", "total_raised",
  "valuation", "investors", "tech_stack", "languages", "frameworks",
  "github_url", "linkedin_url", "twitter_url", "blog_url", "domain",
  "recent_funding", "hiring_velocity", "leadership_changes",
  "job_postings", "company_mission", "tech_changes",
  "person_email", "person_phone", "person_linkedin_url",
  "person_github_url", "person_twitter_url", "person_title",
  "person_seniority", "person_location", "person_headline",
  "person_summary",
]);

const fieldResultSchema = z.object({
  results: z.array(
    z.object({
      field: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
      confidence: z.number().min(0).max(1),
      source_url: z.string().nullable(),
      source_snippet: z.string().nullable(),
    })
  ),
});

/**
 * Deep Agent custom: researches user-defined fields using parallel subagents.
 *
 * Each custom field is delegated to a `field-researcher` subagent via the
 * built-in `task` tool. The LLM spawns all field tasks in a single turn,
 * so they execute concurrently.
 */
export async function runDeepCustomAgent(
  state: EnrichmentState,
  credentials: Credentials,
  onProgress?: ProgressEmitter,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  const customFields = state.requestedFields
    .filter((f) => !STANDARD_FIELDS.has(f.name))
    .map((f) => f.name);

  if (customFields.length === 0) {
    return {
      agentLogs: [log("No custom fields requested — skipping.")],
    };
  }

  const companyLabel = state.companyName || state.domain;

  const searchTool = createSearchTool(credentials);
  const scrapeTool = createScrapeTool(credentials);

  const fieldResearcher: SubAgent = {
    name: "field-researcher",
    description:
      "Research a single enrichment field for a company. " +
      "You will be given a company name and a specific field to find. " +
      "Search the web, scrape relevant pages, and return the field value with confidence.",
    systemPrompt:
      CUSTOM_PROMPT +
      `\n\nYou are researching "${companyLabel}" (domain: ${state.domain}).` +
      (state.companyWebsite ? ` Website: ${state.companyWebsite}.` : "") +
      (state.linkedinUrl ? ` LinkedIn: ${state.linkedinUrl}.` : "") +
      `\n\nReturn your findings as a structured response.`,
    tools: [searchTool, scrapeTool],
  };

  const systemPrompt =
    `You are a research coordinator. You have ${customFields.length} fields to find for "${companyLabel}".` +
    `\n\nFields to research: ${customFields.join(", ")}` +
    `\n\nIMPORTANT: Launch a separate "field-researcher" task for EACH field in a SINGLE message.` +
    ` This runs all research in parallel. After all tasks complete, compile the results.` +
    `\n\nCompany context:` +
    `\n- Name: ${state.companyName || "Unknown"}` +
    `\n- Domain: ${state.domain}` +
    (state.companyWebsite ? `\n- Website: ${state.companyWebsite}` : "") +
    (state.linkedinUrl ? `\n- LinkedIn: ${state.linkedinUrl}` : "");

  const middleware = onProgress
    ? [createProgressMiddleware("custom", onProgress)]
    : [];

  const llm = createLLM(credentials, 0, costTracker);
  const trackedSearchTool = costTracker ? withCostTracking(searchTool, costTracker) : searchTool;
  const trackedScrapeTool = costTracker ? withCostTracking(scrapeTool, costTracker) : scrapeTool;

  const agent = createDeepAgent({
    model: llm,
    tools: [trackedSearchTool, trackedScrapeTool],
    subagents: [fieldResearcher],
    systemPrompt,
    responseFormat: toolStrategy(fieldResultSchema),
    middleware,
  });

  const result = await agent.invoke({
    messages: [
      {
        role: "user" as const,
        content:
          `Research these ${customFields.length} fields for "${companyLabel}":\n` +
          customFields.map((f, i) => `${i + 1}. ${f}`).join("\n") +
          `\n\nLaunch a field-researcher task for each field in parallel, then compile all results.`,
      },
    ],
  });

  const response = result.structuredResponse;

  if (!response) {
    console.warn("[deep-custom] No structured response — returning empty");
    return {
      agentLogs: [log("Custom agent returned no structured response")],
    };
  }

  const completedFields: EnrichmentResult[] = response.results.map((r) => ({
    field: r.field,
    value: r.value,
    confidence: r.confidence,
    source: r.source_url ?? undefined,
    sourceContext: r.source_url
      ? [{ url: r.source_url, snippet: r.source_snippet ?? "", confidence: r.confidence }]
      : [],
    sourceCount: r.source_url ? 1 : 0,
  }));

  const resolved = completedFields.filter((f) => f.value !== null).length;

  return {
    completedFields,
    agentLogs: [
      log(`Custom agent completed — resolved ${resolved}/${customFields.length} fields via parallel research.`),
    ],
  };
}

function log(message: string): AgentLog {
  return { step: "custom", message, timestamp: Date.now() };
}
