import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchGoogle } from "../services/serp";
import type { Credentials } from "../credentials";

const DATASET_ID = "gd_l1vijqt9jfj7olije";
const POLL_INTERVAL_MS = 1000;
const POLL_MAX_ATTEMPTS = 60;

function getApiHeaders(credentials: Credentials): Record<string, string> {
  if (!credentials.brightDataApiKey) {
    throw new Error("brightDataApiKey is required");
  }
  return {
    Authorization: `Bearer ${credentials.brightDataApiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Trigger a Crunchbase dataset collection and poll until results are ready.
 */
async function fetchCrunchbaseData(
  url: string,
  credentials: Credentials
): Promise<Record<string, unknown>[] | null> {
  const headers = getApiHeaders(credentials);

  // Trigger collection
  const triggerResp = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${DATASET_ID}&include_errors=true`,
    {
      method: "POST",
      headers,
      body: JSON.stringify([{ url }]),
    }
  );

  if (!triggerResp.ok) {
    console.error(`[crunchbase] Trigger failed: ${triggerResp.status}`);
    return null;
  }

  const triggerData = await triggerResp.json();
  const snapshotId = triggerData?.snapshot_id;
  if (!snapshotId) {
    console.error("[crunchbase] No snapshot_id returned");
    return null;
  }

  console.log(`[crunchbase] Triggered collection, snapshot: ${snapshotId}`);

  // Poll for results
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const pollResp = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
        { headers }
      );

      if (pollResp.status === 400) {
        console.error("[crunchbase] Polling returned 400 — aborting");
        return null;
      }

      const pollData = await pollResp.json();

      if (
        typeof pollData === "object" &&
        pollData !== null &&
        "status" in pollData &&
        ["running", "building", "starting"].includes(pollData.status as string)
      ) {
        console.log(
          `[crunchbase] Snapshot not ready (attempt ${attempt + 1}/${POLL_MAX_ATTEMPTS})`
        );
        await delay(POLL_INTERVAL_MS);
        continue;
      }

      console.log(
        `[crunchbase] Data received after ${attempt + 1} attempts`
      );

      // Strip nulls from the response
      const cleaned = JSON.parse(
        JSON.stringify(pollData, (_k, v) => (v == null ? undefined : v))
      );

      return Array.isArray(cleaned) ? cleaned : [cleaned];
    } catch (err) {
      console.error(
        `[crunchbase] Poll error (attempt ${attempt + 1}):`,
        err instanceof Error ? err.message : err
      );
      await delay(POLL_INTERVAL_MS);
    }
  }

  console.error("[crunchbase] Timed out waiting for data");
  return null;
}

export function createCrunchbaseTool(credentials: Credentials) {
  return tool(
    async (input) => {
      let url = input.crunchbaseUrl;

      // If no URL, search for the Crunchbase page
      if (!url && input.companyName) {
        const results = await searchGoogle(
          `"${input.companyName}" site:crunchbase.com/organization`,
          credentials,
          { numResults: 3 }
        );
        const match = results.find((r) =>
          r.url.includes("crunchbase.com/organization/")
        );
        if (!match) {
          return JSON.stringify({
            success: false,
            error: `Could not find Crunchbase page for "${input.companyName}"`,
          });
        }
        url = match.url;
      }

      if (!url) {
        return JSON.stringify({
          success: false,
          error: "Provide either companyName or crunchbaseUrl",
        });
      }

      // Normalize URL to ensure it's a full Crunchbase organization URL
      if (!url.startsWith("http")) {
        url = `https://www.crunchbase.com/organization/${url}`;
      }

      const data = await fetchCrunchbaseData(url, credentials);
      if (!data || data.length === 0) {
        return JSON.stringify({
          success: false,
          error: `Failed to fetch Crunchbase data for: ${url}`,
        });
      }

      return JSON.stringify({
        success: true,
        crunchbaseUrl: url,
        data: data[0],
      });
    },
    {
      name: "crunchbase_lookup",
      description:
        "Look up structured company data on Crunchbase: funding rounds, investors, " +
        "valuation, revenue, employee count, and acquisition info. " +
        "Returns pre-parsed JSON data (not raw HTML). " +
        "Provide either a company name (will search for the Crunchbase page) or a direct URL.",
      schema: z.object({
        companyName: z
          .string()
          .optional()
          .describe("Company name to search for on Crunchbase"),
        crunchbaseUrl: z
          .string()
          .optional()
          .describe(
            "Direct Crunchbase URL (e.g. https://www.crunchbase.com/organization/stripe)"
          ),
      }),
    }
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
