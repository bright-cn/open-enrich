import type {
  DeepLookupPreview,
  DeepLookupResult,
} from "../types/bright-data";
import type { Credentials } from "../credentials";

const BASE_URL = "https://api.brightdata.com/datasets/deep_lookup/v1";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100; // ~5 minutes max

function getHeaders(apiKey: string): Record<string, string> {
  if (!apiKey) throw new Error("brightDataApiKey is required");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Create a preview query (returns 10 free sample results).
 */
export async function preview(
  query: string,
  credentials: Pick<Credentials, "brightDataApiKey">
): Promise<DeepLookupPreview> {
  const headers = getHeaders(credentials.brightDataApiKey);
  const resp = await fetch(`${BASE_URL}/preview`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });

  if (!resp.ok) {
    throw new Error(`Deep Lookup preview failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const previewId: string = data.preview_id;

  // Poll until preview is ready
  return pollPreview(previewId, credentials);
}

/**
 * Trigger a full Deep Lookup request from a completed preview.
 */
export async function triggerFull(
  previewId: string,
  credentials: Pick<Credentials, "brightDataApiKey">,
  limit: number = 100
): Promise<DeepLookupResult> {
  const headers = getHeaders(credentials.brightDataApiKey);
  const resp = await fetch(`${BASE_URL}/trigger`, {
    method: "POST",
    headers,
    body: JSON.stringify({ preview_id: previewId, result_limit: limit }),
  });

  if (!resp.ok) {
    throw new Error(`Deep Lookup trigger failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  return pollRequest(data.request_id, credentials);
}

/**
 * Add an enrichment column to existing results.
 */
export async function enrichColumn(
  requestId: string,
  columnName: string,
  columnQuery: string,
  credentials: Pick<Credentials, "brightDataApiKey">
): Promise<Record<string, unknown>> {
  const headers = getHeaders(credentials.brightDataApiKey);
  const resp = await fetch(`${BASE_URL}/request/${requestId}/enrich`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      column_name: columnName,
      query: columnQuery,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Deep Lookup enrich failed: ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}

/**
 * Get current status of a request.
 */
export async function getStatus(
  requestId: string,
  credentials: Pick<Credentials, "brightDataApiKey">
): Promise<DeepLookupResult> {
  const headers = getHeaders(credentials.brightDataApiKey);
  const resp = await fetch(`${BASE_URL}/request/${requestId}`, {
    headers,
  });

  if (!resp.ok) {
    throw new Error(`Deep Lookup status check failed: ${resp.status}`);
  }

  return resp.json();
}

/**
 * Convenience: run a company lookup end-to-end (preview → trigger → poll → return).
 */
export async function lookupCompany(
  query: string,
  credentials: Pick<Credentials, "brightDataApiKey">,
  limit: number = 10
): Promise<Record<string, unknown>[] | null> {
  try {
    const prev = await preview(query, credentials);
    if (!prev.sampleResults?.length) return null;
    const result = await triggerFull(prev.previewId, credentials, limit);
    return result.data ?? null;
  } catch (err) {
    console.error(`[deep-lookup] Company lookup failed:`, err);
    return null;
  }
}

// ── Internal polling helpers ──

async function pollPreview(
  previewId: string,
  credentials: Pick<Credentials, "brightDataApiKey">
): Promise<DeepLookupPreview> {
  const headers = getHeaders(credentials.brightDataApiKey);
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const resp = await fetch(`${BASE_URL}/preview/${previewId}`, { headers });
    if (!resp.ok) throw new Error(`Preview poll failed: ${resp.status}`);

    const data = await resp.json();
    if (data.status === "completed" || data.status === "done") {
      return {
        previewId,
        status: "done",
        sampleResults: data.results ?? data.sample_results,
        columns: data.columns,
      };
    }
    if (data.status === "failed") {
      throw new Error(`Deep Lookup preview failed: ${JSON.stringify(data)}`);
    }

    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("Deep Lookup preview timed out");
}

async function pollRequest(
  requestId: string,
  credentials: Pick<Credentials, "brightDataApiKey">
): Promise<DeepLookupResult> {
  const headers = getHeaders(credentials.brightDataApiKey);
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const resp = await fetch(`${BASE_URL}/request/${requestId}`, { headers });
    if (!resp.ok) throw new Error(`Request poll failed: ${resp.status}`);

    const data = await resp.json();
    if (data.step === "done" || data.status === "done") {
      return {
        requestId,
        status: "done",
        step: "done",
        resultCount: data.result_count,
        data: data.results ?? data.data,
      };
    }
    if (data.status === "failed") {
      throw new Error(`Deep Lookup request failed: ${JSON.stringify(data)}`);
    }

    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("Deep Lookup request timed out");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
