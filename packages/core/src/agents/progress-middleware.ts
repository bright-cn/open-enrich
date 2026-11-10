import { createMiddleware } from "langchain";
import type { AgentStep } from "../types/enrichment";

export type ProgressEmitter = (event: {
  step: AgentStep;
  message: string;
  sourceUrl?: string;
}) => void;

/**
 * Deep Agents middleware that emits progress events on every tool call.
 * Wraps each tool execution and reports what's happening to the UI.
 */
export function createProgressMiddleware(
  step: AgentStep,
  emit: ProgressEmitter
) {
  return createMiddleware({
    name: "ProgressMiddleware",
    wrapToolCall: async (request, handler) => {
      const toolName = request.toolCall.name;
      const args = request.toolCall.args;

      // Emit a progress event before the tool runs
      let message = `Calling ${toolName}`;
      if (toolName === "web_search" && args?.queries) {
        const queries = Array.isArray(args.queries)
          ? args.queries.slice(0, 2).join(", ")
          : String(args.queries);
        message = `Searching: ${queries}`;
      } else if (toolName === "scrape_webpage" && args?.url) {
        message = `Scraping: ${String(args.url).slice(0, 60)}`;
      } else if (toolName === "linkedin_company") {
        message = `Looking up LinkedIn company: ${args?.companyName || args?.linkedinUrl || ""}`;
      } else if (toolName === "linkedin_profile") {
        message = `Looking up LinkedIn profile: ${args?.name || args?.linkedinUrl || ""}`;
      } else if (toolName === "crunchbase_lookup") {
        message = `Looking up Crunchbase: ${args?.companyName || args?.crunchbaseUrl || ""}`;
      } else if (toolName === "task") {
        message = `Delegating: ${args?.description?.slice(0, 80) || "subagent task"}`;
      }

      emit({ step, message });

      const result = await handler(request);

      return result;
    },
  });
}
