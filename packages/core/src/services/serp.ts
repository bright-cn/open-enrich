import { createBrightDataClient } from "./bright-data";
import type { SerpResult } from "../types/bright-data";
import type { Credentials } from "../credentials";

export interface SearchOptions {
  numResults?: number;
  country?: string;
  language?: string;
}

/**
 * Search Google via Bright Data SERP API and return parsed organic results.
 */
export async function searchGoogle(
  query: string,
  credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">,
  options: SearchOptions = {}
): Promise<SerpResult[]> {
  const client = createBrightDataClient(credentials);

  const raw = (await client.search.google(query, {
    format: "json",
    numResults: options.numResults ?? 10,
    country: options.country,
  })) as unknown as { status_code: number; body: string };

  return parseGoogleResults(raw.body);
}

/**
 * Run up to 10 Google searches in parallel and return deduplicated results.
 */
export async function searchBatch(
  queries: string[],
  credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">,
  options: SearchOptions = {}
): Promise<SerpResult[]> {
  const client = createBrightDataClient(credentials);
  const batch = queries.slice(0, 10);

  const responses = (await client.search.google(batch, {
    format: "json",
    numResults: options.numResults ?? 5,
    country: options.country,
  })) as unknown as Array<{ status_code: number; body: string } | Error>;

  const allResults: SerpResult[] = [];
  const seenUrls = new Set<string>();

  for (const resp of responses) {
    if (resp instanceof Error) continue;
    const results = parseGoogleResults(resp.body);
    for (const r of results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        allResults.push(r);
      }
    }
  }

  return allResults;
}

function parseGoogleResults(body: string): SerpResult[] {
  try {
    const data = typeof body === "string" ? JSON.parse(body) : body;

    // Handle SERP API's parsed JSON format
    const organic: Array<Record<string, unknown>> =
      data.organic || data.results || [];

    return organic.map(
      (item: Record<string, unknown>, idx: number): SerpResult => ({
        title: String(item.title ?? ""),
        url: String(item.url ?? item.link ?? ""),
        snippet: String(item.description ?? item.snippet ?? ""),
        position: typeof item.position === "number" ? item.position : idx + 1,
      })
    );
  } catch {
    return [];
  }
}
