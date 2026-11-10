import { createDeepAgent } from "deepagents";
import { toolStrategy } from "langchain";
import { createLLM } from "../config/llm";
import { withCostTracking } from "../cost-tracker";
import type {
  EnrichmentState,
  EnrichmentStateUpdate,
  AgentLog,
} from "./state";
import { DISCOVERY_PROMPT } from "./prompts";
import { createSearchTool } from "../tools/search-tool";
import { createScrapeTool } from "../tools/scrape-tool";
import { createLinkedInCompanyTool } from "../tools/linkedin-tool";
import type { EnrichmentResult } from "../types/enrichment";
import { createProgressMiddleware, type ProgressEmitter } from "./progress-middleware";
import { z } from "zod";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

const discoveryResponseSchema = z.object({
  company_name: z.string().nullable(),
  company_name_confidence: z.number().min(0).max(1),
  company_name_source: z.string().nullable(),
  domain: z.string().nullable(),
  domain_confidence: z.number().min(0).max(1),
  description: z.string().nullable(),
  description_confidence: z.number().min(0).max(1),
  description_source: z.string().nullable(),
  linkedin_url: z.string().nullable(),
});

/**
 * Deep Agent discovery: identifies the company behind an email/domain.
 *
 * Uses createDeepAgent for parallel tool execution — search, scrape, and
 * LinkedIn lookup can run in a single LLM turn. Returns typed output via
 * responseFormat instead of parsing submit_field tool calls.
 */
export async function runDeepDiscoveryAgent(
  state: EnrichmentState,
  credentials: Credentials,
  onProgress?: ProgressEmitter,
  costTracker?: CostTracker
): Promise<EnrichmentStateUpdate> {
  const hasName = !!state.companyName;
  const hasWebsite = !!state.companyWebsite;
  const hasLinkedin = !!state.linkedinUrl;

  // Short-circuit: all 3 fields already populated from CSV
  if (hasName && hasWebsite && hasLinkedin) {
    console.log(
      `[deep-discovery] Pre-populated: "${state.companyName}" — skipping`
    );
    return {
      companyName: state.companyName,
      companyWebsite: state.companyWebsite,
      linkedinUrl: state.linkedinUrl,
      completedFields: [
        makeField("company_name", state.companyName, 0.9, state.companyWebsite),
        makeField("domain", state.domain, 0.95, state.companyWebsite),
      ],
      agentLogs: [
        log(`Pre-populated from CSV: ${state.companyName} (${state.companyWebsite})`),
      ],
    };
  }

  // Build context for the agent
  const knownParts: string[] = [];
  if (hasName) knownParts.push(`Company name: ${state.companyName}`);
  if (hasWebsite) knownParts.push(`Website: ${state.companyWebsite}`);
  if (hasLinkedin) knownParts.push(`LinkedIn: ${state.linkedinUrl}`);

  const knownContext =
    knownParts.length > 0
      ? `\n\nWe already know:\n${knownParts.join("\n")}\nOnly research what is MISSING. Do not re-verify known facts.`
      : "";

  const systemPrompt =
    DISCOVERY_PROMPT +
    `\n\nTARGET: ${state.companyNameGuess || state.companyName || "Unknown"}` +
    `\nDOMAIN: ${state.domain}` +
    `\nFIELDS TO FIND: company_name, domain, description` +
    knownContext +
    `\n\nIMPORTANT: Call multiple tools in a single turn when possible to maximize speed.` +
    ` For example, search Google AND look up LinkedIn in the same turn.`;

  const middleware = onProgress
    ? [createProgressMiddleware("discovery", onProgress)]
    : [];

  const llm = createLLM(credentials, 0, costTracker);
  const searchTool = createSearchTool(credentials);
  const scrapeTool = createScrapeTool(credentials);
  const linkedinCompanyTool = createLinkedInCompanyTool(credentials);
  const tools = costTracker
    ? [
        withCostTracking(searchTool, costTracker),
        withCostTracking(scrapeTool, costTracker),
        withCostTracking(linkedinCompanyTool, costTracker),
      ]
    : [searchTool, scrapeTool, linkedinCompanyTool];

  const agent = createDeepAgent({
    model: llm,
    tools,
    systemPrompt,
    responseFormat: toolStrategy(discoveryResponseSchema),
    middleware,
  });

  const result = await agent.invoke({
    messages: [
      {
        role: "user" as const,
        content:
          `Discover the company behind this email/domain.\n` +
          `Email: ${state.email}\n` +
          `Domain: ${state.domain}\n` +
          `Company name guess: ${state.companyNameGuess || "unknown"}\n\n` +
          `Research the company and return structured results.`,
      },
    ],
  });

  const response = result.structuredResponse;

  if (!response) {
    console.warn("[deep-discovery] No structured response — falling back");
    return {
      agentLogs: [log("Discovery returned no structured response")],
    };
  }

  const completedFields: EnrichmentResult[] = [];
  const agentLogs: AgentLog[] = [];
  const companyName = response.company_name || state.companyName || "";
  const domain = response.domain || state.domain || "";
  const linkedinUrl = response.linkedin_url || state.linkedinUrl || "";

  if (response.company_name) {
    completedFields.push(
      makeField(
        "company_name",
        response.company_name,
        response.company_name_confidence,
        response.company_name_source
      )
    );
    agentLogs.push(
      log(`Found company: ${response.company_name} (${(response.company_name_confidence * 100).toFixed(0)}%)`)
    );
  }

  if (response.domain) {
    completedFields.push(
      makeField("domain", response.domain, response.domain_confidence, null)
    );
  }

  if (response.description) {
    completedFields.push(
      makeField(
        "description",
        response.description,
        response.description_confidence,
        response.description_source
      )
    );
    agentLogs.push(log(`Found description (${(response.description_confidence * 100).toFixed(0)}%)`));
  }

  const companyWebsite = domain
    ? domain.startsWith("http") ? domain : `https://${domain}`
    : state.companyWebsite || "";

  return {
    companyName,
    companyWebsite,
    linkedinUrl,
    completedFields,
    agentLogs,
  };
}

function makeField(
  field: string,
  value: string | null,
  confidence: number,
  source: string | null
): EnrichmentResult {
  return {
    field,
    value,
    confidence,
    source: source ?? undefined,
    sourceContext: source
      ? [{ url: source, snippet: `${field}: ${value}`, confidence }]
      : [],
    sourceCount: source ? 1 : 0,
  };
}

function log(message: string): AgentLog {
  return { step: "discovery", message, timestamp: Date.now() };
}
