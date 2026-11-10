import { createDeepAgent } from "deepagents";
import { toolStrategy } from "langchain";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";
import type {
  EnrichmentState,
  EnrichmentStateUpdate,
  AgentLog,
} from "./state";
import { PERSON_PROMPT } from "./prompts";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import { createLinkedInProfileTool } from "../tools/linkedin-tool";
import { createProgressMiddleware, type ProgressEmitter } from "./progress-middleware";
import type { EnrichmentResult } from "../types/enrichment";
import { z } from "zod";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

const personResponseSchema = z.object({
  person_email: z.string().nullable(),
  person_email_confidence: z.number().min(0).max(1),
  person_email_source: z.string().nullable(),
  person_phone: z.string().nullable(),
  person_phone_confidence: z.number().min(0).max(1),
  person_phone_source: z.string().nullable(),
  person_linkedin_url: z.string().nullable(),
  person_linkedin_url_confidence: z.number().min(0).max(1),
  person_linkedin_url_source: z.string().nullable(),
  person_github_url: z.string().nullable(),
  person_github_url_confidence: z.number().min(0).max(1),
  person_github_url_source: z.string().nullable(),
  person_twitter_url: z.string().nullable(),
  person_twitter_url_confidence: z.number().min(0).max(1),
  person_twitter_url_source: z.string().nullable(),
  person_title: z.string().nullable(),
  person_title_confidence: z.number().min(0).max(1),
  person_title_source: z.string().nullable(),
  person_seniority: z.string().nullable(),
  person_seniority_confidence: z.number().min(0).max(1),
  person_seniority_source: z.string().nullable(),
  person_location: z.string().nullable(),
  person_location_confidence: z.number().min(0).max(1),
  person_location_source: z.string().nullable(),
  person_headline: z.string().nullable(),
  person_headline_confidence: z.number().min(0).max(1),
  person_headline_source: z.string().nullable(),
  person_summary: z.string().nullable(),
  person_summary_confidence: z.number().min(0).max(1),
  person_summary_source: z.string().nullable(),
});

const PERSON_FIELDS = [
  "person_email",
  "person_phone",
  "person_linkedin_url",
  "person_github_url",
  "person_twitter_url",
  "person_title",
  "person_seniority",
  "person_location",
  "person_headline",
  "person_summary",
] as const;

/**
 * Deep Agent for person enrichment: finds contact info and professional
 * details via SERP-first strategy with LinkedIn/GitHub fallback.
 *
 * Uses createDeepAgent for parallel tool execution — search, scrape, and
 * LinkedIn profile lookup can run in a single LLM turn.
 */
export async function runPersonAgent(
  state: EnrichmentState,
  credentials: Credentials,
  onProgress?: ProgressEmitter,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  if (!state.personFirstName && !state.personLastName) {
    return {
      agentLogs: [log("No person name provided — skipping person enrichment")],
    };
  }

  const firstName = state.personFirstName || "";
  const lastName = state.personLastName || "";
  const companyName = state.companyName || state.personCompany || state.companyNameGuess || "";

  const systemPrompt =
    PERSON_PROMPT +
    `\n\nTARGET PERSON: ${firstName} ${lastName}` +
    `\nCOMPANY: ${companyName}` +
    `\nDOMAIN: ${state.domain}` +
    (state.companyWebsite ? `\nCOMPANY WEBSITE: ${state.companyWebsite}` : "") +
    `\n\nFIELDS TO FIND: person_email, person_phone, person_linkedin_url, person_github_url, person_twitter_url, person_title, person_seniority, person_location, person_headline, person_summary` +
    `\n\nIMPORTANT: Call multiple tools in a single turn when possible to maximize speed.` +
    ` For example, search for email AND LinkedIn AND GitHub in the same turn.`;

  const middleware = onProgress
    ? [createProgressMiddleware("person", onProgress)]
    : [];

  const llm = createLLM(credentials, 0, costTracker);
  const searchTool = createSearchTool(credentials);
  const scrapeTool = createScrapeTool(credentials);
  const linkedinProfileTool = createLinkedInProfileTool(credentials);
  const tools = costTracker
    ? [
        withCostTracking(searchTool, costTracker),
        withCostTracking(scrapeTool, costTracker),
        withCostTracking(linkedinProfileTool, costTracker),
      ]
    : [searchTool, scrapeTool, linkedinProfileTool];

  const agent = createDeepAgent({
    model: llm,
    tools,
    systemPrompt,
    responseFormat: toolStrategy(personResponseSchema),
    middleware,
  });

  const result = await agent.invoke({
    messages: [
      {
        role: "user" as const,
        content:
          `Find contact information and professional details for ${firstName} ${lastName}` +
          ` at ${companyName}. Domain: ${state.domain}.` +
          ` Search for their email, LinkedIn, GitHub, and professional background.`,
      },
    ],
  });

  const response = result.structuredResponse;

  if (!response) {
    console.warn("[person-agent] No structured response — falling back");
    return {
      agentLogs: [log("Person agent returned no structured response")],
    };
  }

  const completedFields: EnrichmentResult[] = [];
  const agentLogs: AgentLog[] = [];

  for (const field of PERSON_FIELDS) {
    const value = response[field];
    if (value) {
      const confidence = response[`${field}_confidence` as keyof typeof response] as number;
      const source = response[`${field}_source` as keyof typeof response] as string | null;
      completedFields.push(makeField(field, value, confidence, source));
      agentLogs.push(
        log(`Found ${field}: ${value} (${(confidence * 100).toFixed(0)}%)`)
      );
    }
  }

  return {
    completedFields,
    agentLogs,
  };
}

function isUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function makeField(
  field: string,
  value: string | null,
  confidence: number,
  source: string | null
): EnrichmentResult {
  // Source might be a URL or descriptive text from the LLM.
  // Only use it as a clickable URL if it's actually a valid URL.
  // Fallback: if the enriched value itself is a URL (e.g. linkedin_url), use that.
  const sourceUrl = source && isUrl(source)
    ? source
    : typeof value === "string" && isUrl(value)
      ? value
      : undefined;
  const snippet = source || `${field}: ${value}`;

  return {
    field,
    value,
    confidence,
    source: sourceUrl,
    sourceContext: sourceUrl
      ? [{ url: sourceUrl, snippet, confidence }]
      : [],
    sourceCount: sourceUrl ? 1 : 0,
  };
}

function log(message: string): AgentLog {
  return { step: "person", message, timestamp: Date.now() };
}
