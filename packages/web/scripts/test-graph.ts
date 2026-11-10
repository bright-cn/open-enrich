/**
 * E2E test for the enrichment graph.
 * Run with: npx tsx scripts/test-graph.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  buildEnrichmentGraph,
  type AgentProgressEvent,
  type Credentials,
} from "@brightdata/enrich-core";
import type { EnrichmentField } from "@brightdata/enrich-core";

const DIVIDER = "─".repeat(60);

async function main() {
  console.log("Enrichment Graph E2E Test");
  console.log(DIVIDER);

  const fields: EnrichmentField[] = [
    { name: "company_name", displayName: "Company Name", description: "Official company name", type: "string", required: true, category: "icp_qualification" },
    { name: "industry", displayName: "Industry", description: "Primary industry", type: "string", required: true, category: "icp_qualification" },
    { name: "headquarters", displayName: "HQ", description: "Headquarters location", type: "string", required: true, category: "icp_qualification" },
    { name: "employee_count", displayName: "Employees", description: "Number of employees", type: "number", required: false, category: "icp_qualification" },
    { name: "funding_stage", displayName: "Funding Stage", description: "Latest funding stage", type: "string", required: false, category: "icp_qualification" },
  ];

  const onProgress = (event: AgentProgressEvent) => {
    console.log(`  [${event.step}] ${event.message}${event.sourceUrl ? ` (${event.sourceUrl})` : ""}`);
  };

  const graph = buildEnrichmentGraph(onProgress);

  console.log(`\nInput: john@brightdata.com`);
  console.log(`Fields: ${fields.map((f) => f.name).join(", ")}`);
  console.log(`\n${DIVIDER}`);
  console.log("Running graph...\n");

  const startTime = Date.now();

  const credentials: Credentials = {
    brightDataApiKey: process.env.BRIGHT_DATA_API_KEY ?? "",
    brightDataSerpZone: process.env.BRIGHT_DATA_SERP_ZONE ?? "",
    brightDataUnlockerZone: process.env.BRIGHT_DATA_UNLOCKER_ZONE ?? "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  };

  const result = await graph.invoke(
    {
      email: "john@brightdata.com",
      domain: "brightdata.com",
      companyNameGuess: "Bright Data",
      requestedFields: fields,
      pendingFields: fields.map((f) => f.name),
    },
    { configurable: { credentials, mcpTools: [] } }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${DIVIDER}`);
  console.log(`Completed in ${elapsed}s\n`);

  console.log("Company Name:", result.companyName || "(not set)");
  console.log("Website:", result.companyWebsite || "(not set)");
  console.log("LinkedIn:", result.linkedinUrl || "(not set)");

  console.log(`\n${DIVIDER}`);
  console.log(`Enrichment Results (${result.completedFields.length} fields):`);
  console.log(DIVIDER);

  for (const field of result.completedFields) {
    const val = Array.isArray(field.value) ? field.value.join(", ") : field.value;
    const conf = (field.confidence * 100).toFixed(0);
    console.log(`  ${field.field}: ${val ?? "null"} (${conf}% confidence)`);
    if (field.sourceContext?.length) {
      for (const src of field.sourceContext.slice(0, 2)) {
        console.log(`    └ ${src.url}`);
        console.log(`      "${src.snippet.slice(0, 100)}..."`);
      }
    }
  }

  console.log(`\n${DIVIDER}`);
  console.log(`Agent Logs (${result.agentLogs.length} entries):`);
  console.log(DIVIDER);

  for (const log of result.agentLogs) {
    console.log(`  [${log.step}] ${log.message}`);
  }

  console.log(`\n${DIVIDER}`);
  console.log("Done.");
  console.log(DIVIDER);

  process.exit(0);
}

main().catch((err) => {
  console.error("Graph test failed:", err);
  process.exit(1);
});
