import { createBrightDataClient } from "./bright-data";
import type { Credentials } from "../credentials";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface ScrapeOptions {
  country?: string;
  timeout?: number;
}

/**
 * Scrape a URL and return raw HTML via Web Unlocker.
 */
export async function scrapeUrl(
  url: string,
  credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">,
  options: ScrapeOptions = {}
): Promise<{ html: string; statusCode: number } | null> {
  const client = createBrightDataClient(credentials);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = (await client.scrapeUrl(url, {
        format: "json",
        country: options.country,
        timeout: options.timeout ?? 30000,
      })) as unknown as { status_code: number; body: string };

      if (resp.status_code >= 200 && resp.status_code < 300) {
        return { html: resp.body, statusCode: resp.status_code };
      }

      if (shouldRetry(resp.status_code)) {
        await delay(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      return null;
    } catch (err: unknown) {
      console.error(`[web-unlocker] scrapeUrl attempt ${attempt + 1}/${MAX_RETRIES} failed for ${url}:`, err);
      if (attempt === MAX_RETRIES - 1) return null;
      await delay(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }
  return null;
}

/**
 * Scrape a URL and return clean markdown content.
 */
export async function scrapeAsMarkdown(
  url: string,
  credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">,
  options: ScrapeOptions = {}
): Promise<string | null> {
  const client = createBrightDataClient(credentials);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = (await client.scrapeUrl(url, {
        format: "raw",
        dataFormat: "markdown",
        country: options.country,
        timeout: options.timeout ?? 30000,
      })) as string;

      if (resp && resp.length > 0) return resp;
      return null;
    } catch (err: unknown) {
      console.error(`[web-unlocker] markdown attempt ${attempt + 1}/${MAX_RETRIES} failed for ${url}:`, err);
      if (attempt === MAX_RETRIES - 1) return null;
      await delay(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }
  return null;
}

/**
 * Scrape up to 10 URLs in parallel and return markdown for each.
 */
export async function scrapeBatch(
  urls: string[],
  credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">,
  options: ScrapeOptions = {}
): Promise<Array<{ url: string; markdown: string | null }>> {
  const batch = urls.slice(0, 10);
  const results = await Promise.allSettled(
    batch.map((url) => scrapeAsMarkdown(url, credentials, options))
  );

  return batch.map((url, i) => ({
    url,
    markdown:
      results[i].status === "fulfilled" ? results[i].value : null,
  }));
}

function shouldRetry(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
