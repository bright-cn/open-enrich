import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { lookupCompany } from "../services/deep-lookup";
import type { Credentials } from "../credentials";

export function createDeepLookupTool(credentials: Credentials) {
  return tool(
    async (input) => {
      try {
        const results = await lookupCompany(input.query, credentials, input.limit ?? 5);

        if (!results || results.length === 0) {
          return JSON.stringify({
            success: false,
            error: `No results found for "${input.query}"`,
          });
        }

        return JSON.stringify({
          success: true,
          query: input.query,
          resultCount: results.length,
          data: results,
        });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: `Deep Lookup failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
    {
      name: "deep_lookup",
      description:
        "AI-powered research across 1000+ public sources. Use this as a last resort " +
        "when other tools (LinkedIn, Crunchbase, web search) don't find what you need. " +
        "Best for finding hard-to-locate companies, niche data, or comprehensive profiles. " +
        "Note: this is slower and more expensive than other tools.",
      schema: z.object({
        query: z
          .string()
          .describe(
            'Natural language research query (e.g. "Find SaaS companies in fintech with Series B funding")'
          ),
        limit: z
          .number()
          .optional()
          .describe("Max results to return (default 5)"),
      }),
    }
  );
}
