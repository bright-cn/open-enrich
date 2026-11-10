import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { scrapeAsMarkdown } from "../services/web-unlocker";
import type { Credentials } from "../credentials";

const MAX_CONTENT_LENGTH = 20_000;

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function createScrapeTool(credentials: Credentials) {
  return tool(
    async (input) => {
      const url = input.url?.trim();

      if (!url || !isValidUrl(url)) {
        return JSON.stringify({
          success: false,
          error: `Invalid URL: "${url}". Provide a complete URL like https://example.com`,
        });
      }

      try {
        const markdown = await scrapeAsMarkdown(url, credentials);

        if (!markdown) {
          return JSON.stringify({
            success: false,
            error: `Failed to scrape ${url}`,
          });
        }

        const content =
          markdown.length > MAX_CONTENT_LENGTH
            ? markdown.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated]"
            : markdown;

        return JSON.stringify({
          success: true,
          url,
          contentLength: markdown.length,
          content,
        });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: `Scrape failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
    {
      name: "scrape_webpage",
      description:
        "Scrape a webpage and return its content as clean markdown. " +
        "Bypasses anti-bot protections automatically. " +
        "Use this to read company websites, about pages, blog posts, job listings, etc. " +
        "Requires a complete, valid URL with a real hostname (e.g. https://example.com).",
      schema: z.object({
        url: z.string().describe("The full URL to scrape (e.g. https://example.com/about)"),
      }),
    }
  );
}
