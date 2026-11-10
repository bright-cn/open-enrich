import { StateGraph, START, END } from "@langchain/langgraph";
import {
  EnrichmentStateAnnotation,
  type EnrichmentState,
} from "./state";
import type { EnrichmentResult } from "../types/enrichment";
import type { AgentLog } from "./state";
import { runDeepDiscoveryAgent } from "./deep-discovery-agent";
import { runProfileAgent } from "./profile-agent";
import { runMetricsAgent } from "./metrics-agent";
import { runFundingAgent } from "./funding-agent";
import { runTechStackAgent } from "./techstack-agent";
import { runSocialAgent } from "./social-agent";
import { runDeepCustomAgent } from "./deep-custom-agent";
import { runPersonAgent } from "./person-agent";
import { runMCPAgent } from "./mcp-agent";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { ProgressCallback } from "./callbacks";
import type { CostTracker } from "../cost-tracker";
import type { Credentials } from "../credentials";

/**
 * Build the enrichment graph for a single row.
 *
 * Flow:
 *   START → discovery → enrich (parallel) → validate → custom → END
 */
export function buildEnrichmentGraph(onProgress?: ProgressCallback) {
  const graph = new StateGraph(EnrichmentStateAnnotation)
    .addNode("discovery", async (state: EnrichmentState, config) => {
      const credentials = config?.configurable?.credentials as Credentials;
      const costTracker = config?.configurable?.costTracker as CostTracker | undefined;
      onProgress?.({
        rowIndex: 0,
        step: "discovery",
        message: `Discovering company for ${state.domain}...`,
      });
      return runDeepDiscoveryAgent(
        state,
        credentials,
        onProgress ? (e) => onProgress({ ...e, rowIndex: 0 }) : undefined,
        costTracker
      );
    })
    .addNode("enrich", async (state: EnrichmentState, config) => {
      const credentials = config?.configurable?.credentials as Credentials;
      const costTracker = config?.configurable?.costTracker as CostTracker | undefined;
      onProgress?.({
        rowIndex: 0,
        step: "profile",
        message: `Enriching ${state.companyName || state.domain}...`,
      });
      return runParallelAgents(state, credentials, costTracker);
    })
    .addNode("person", async (state: EnrichmentState, config) => {
      const credentials = config?.configurable?.credentials as Credentials;
      const costTracker = config?.configurable?.costTracker as CostTracker | undefined;
      onProgress?.({
        rowIndex: 0,
        step: "person",
        message: `Finding person data for ${state.personFirstName} ${state.personLastName}...`,
      });
      return runPersonAgent(
        state,
        credentials,
        onProgress ? (e) => onProgress({ ...e, rowIndex: 0 }) : undefined,
        costTracker
      );
    })
    .addNode("mcp-sources", async (state: EnrichmentState, config) => {
      const credentials = config?.configurable?.credentials as Credentials;
      const mcpTools = (config?.configurable?.mcpTools ?? []) as StructuredToolInterface[];
      if (mcpTools.length === 0) return { agentLogs: [] };
      onProgress?.({
        rowIndex: 0,
        step: "mcp",
        message: `Querying external data sources (${mcpTools.length} tool(s))...`,
      });
      return runMCPAgent(state, credentials, mcpTools);
    })
    .addNode("validate", (state: EnrichmentState) => {
      return validateResults(state);
    })
    .addNode("custom", async (state: EnrichmentState, config) => {
      const credentials = config?.configurable?.credentials as Credentials;
      const costTracker = config?.configurable?.costTracker as CostTracker | undefined;
      onProgress?.({
        rowIndex: 0,
        step: "custom",
        message: `Processing custom fields for ${state.companyName || state.domain}...`,
      });
      return runDeepCustomAgent(state, credentials, undefined, costTracker);
    })
    .addEdge(START, "discovery")
    .addEdge("discovery", "enrich")
    .addEdge("discovery", "person")
    .addEdge("discovery", "mcp-sources")
    .addEdge("enrich", "validate")
    .addEdge("person", "validate")
    .addEdge("mcp-sources", "validate")
    .addEdge("validate", "custom")
    .addEdge("custom", END);

  return graph.compile();
}

// ── Validation layer ──────────────────────────────────────

/**
 * Post-processing node: drops fields that were never requested.
 */
function validateResults(state: EnrichmentState) {
  const requestedNames = new Set(state.requestedFields.map((f) => f.name));
  const alwaysAllow = new Set(["company_name", "domain", "description"]);

  const filtered = state.completedFields.filter(
    (f) => requestedNames.has(f.field) || alwaysAllow.has(f.field)
  );

  return { completedFields: filtered };
}

// ── Parallel agents ───────────────────────────────────────

/**
 * Run profile, metrics, funding, techstack, and social agents in parallel.
 * Failed agents are logged but don't break the pipeline.
 */
async function runParallelAgents(
  state: EnrichmentState,
  credentials: Credentials,
  costTracker?: CostTracker
) {
  const results = await Promise.allSettled([
    runProfileAgent(state, credentials, costTracker),
    runMetricsAgent(state, credentials, costTracker),
    runFundingAgent(state, credentials, costTracker),
    runTechStackAgent(state, credentials, costTracker),
    runSocialAgent(state, credentials, costTracker),
  ]);

  const completedFields: EnrichmentResult[] = [];
  const agentLogs: AgentLog[] = [];
  let companyName = "";
  let companyWebsite = "";
  let linkedinUrl = "";

  for (const result of results) {
    if (result.status === "fulfilled") {
      const update = result.value;
      if (Array.isArray(update.completedFields)) {
        completedFields.push(...update.completedFields);
      }
      if (Array.isArray(update.agentLogs)) {
        agentLogs.push(...update.agentLogs);
      }
      if (update.companyName) companyName = String(update.companyName);
      if (update.companyWebsite) companyWebsite = String(update.companyWebsite);
      if (update.linkedinUrl) linkedinUrl = String(update.linkedinUrl);
    } else {
      agentLogs.push({
        step: "profile",
        message: `Agent failed: ${result.reason}`,
        timestamp: Date.now(),
      });
    }
  }

  return {
    completedFields,
    agentLogs,
    ...(companyName && { companyName }),
    ...(companyWebsite && { companyWebsite }),
    ...(linkedinUrl && { linkedinUrl }),
  };
}
