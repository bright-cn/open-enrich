import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createLLM } from "../config/llm";
import type {
  EnrichmentState,
  EnrichmentStateUpdate,
} from "./state";
import { submitFieldTool } from "../tools/submit-tool";
import { BASE_EXTRACTION_PROMPT } from "./prompts";
import type { EnrichmentResult } from "../types/enrichment";
import type { Credentials } from "../credentials";

function parseSubmittedFields(messages: unknown[]): EnrichmentResult[] {
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
      // skip unparseable messages
    }
  }

  return results;
}

const MCP_PROMPT = `${BASE_EXTRACTION_PROMPT}

You are the EXTERNAL DATA SOURCES agent. You have access to external data tools connected via MCP servers.
These tools may provide CRM data, company databases, contact directories, or other structured data sources.

STRATEGY:
1. Review the available tools and their descriptions to understand what data each can provide.
2. Call the most relevant tools for the requested fields.
3. Cross-reference data from external sources — if multiple tools return the same field, prefer the one with more detail.
4. Submit each field using submit_field with appropriate confidence based on source reliability.
5. If a tool returns no useful data for a field, do NOT submit that field — let other agents handle it.

IMPORTANT: These are external data sources the user has connected. Treat their data as high-confidence (0.8-1.0) when the data is specific and clearly matches the target company/person.`;

/**
 * MCP enrichment agent: queries user-connected MCP servers for data.
 * Runs in parallel with other enrichment agents.
 * No cost tracking — MCP tools are user-provided.
 */
export async function runMCPAgent(
  state: EnrichmentState,
  credentials: Credentials,
  mcpTools: StructuredToolInterface[]
): Promise<EnrichmentStateUpdate> {
  if (mcpTools.length === 0) {
    return {
      agentLogs: [],
    };
  }

  const fieldNames = state.requestedFields.map((f) => f.name);

  const llm = createLLM(credentials, 0);
  const tools = [...mcpTools, submitFieldTool];

  const prompt = MCP_PROMPT +
    `\n\nTARGET COMPANY: ${state.companyName || state.companyNameGuess || "Unknown"}` +
    `\nDOMAIN: ${state.domain || "Unknown"}` +
    (state.companyWebsite ? `\nWEBSITE: ${state.companyWebsite}` : "") +
    (state.personFirstName ? `\nTARGET PERSON: ${state.personFirstName} ${state.personLastName}` : "") +
    `\n\nFIELDS TO FIND: ${fieldNames.join(", ")}` +
    `\n\nWhen you have enough information, use submit_field for EACH field you found data for.`;

  const agent = createReactAgent({
    llm,
    tools,
    prompt,
  });

  try {
    const companyLabel = state.companyName || state.domain || "target";
    const result = await agent.invoke({
      messages: [
        new HumanMessage(
          `Query external data sources for information about "${companyLabel}"` +
            (state.domain ? ` (domain: ${state.domain})` : "") +
            (state.personFirstName ? `. Also look up person: ${state.personFirstName} ${state.personLastName}` : "") +
            `. Find these fields: ${fieldNames.join(", ")}.`
        ),
      ],
    });

    const completedFields = parseSubmittedFields(result.messages);

    return {
      completedFields,
      agentLogs: [
        {
          step: "mcp" as const,
          message: `MCP agent completed — resolved ${completedFields.length} field(s) from external sources.`,
          timestamp: Date.now(),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[mcp-agent] Error:`, message);
    return {
      agentLogs: [
        {
          step: "mcp" as const,
          message: `MCP agent failed: ${message}`,
          timestamp: Date.now(),
        },
      ],
    };
  }
}
