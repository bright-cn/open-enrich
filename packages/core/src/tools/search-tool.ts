import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchBatch } from "../services/serp";
import type { Credentials } from "../credentials";

export function createSearchTool(credentials: Credentials) {
  return tool(
    async (input) => {
      const results = await searchBatch(input.queries, credentials, {
        numResults: input.numResults ?? 5,
      });

      if (results.length === 0) {
        return JSON.stringify({ results: [], message: "No results found" });
      }

      const formatted = results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        position: r.position,
      }));

      return JSON.stringify({ results: formatted, count: formatted.length });
    },
    {
      name: "web_search",
      description:
        "Search Google for information using multiple queries. " +
        "Returns ranked, deduplicated results with title, URL, and snippet. " +
        "Use this to find company websites, news articles, funding announcements, etc.",
      schema: z.object({
        queries: z
          .array(z.string())
          .min(1)
          .max(10)
          .describe("Search queries to run (up to 10 in parallel)"),
        numResults: z
          .number()
          .optional()
          .describe("Number of results per query (default 5)"),
      }),
    }
  );
}
