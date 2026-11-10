/**
 * E2E test script for all Bright Data services.
 * Run with: npx tsx scripts/test-bright-data.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createBrightDataClient,
  searchGoogle,
  searchBatch,
  scrapeUrl,
  scrapeAsMarkdown,
  scrapeLinkedInCompany,
  scrapeLinkedInProfile,
} from "@brightdata/enrich-core";

const DIVIDER = "─".repeat(60);
let passed = 0;
let failed = 0;

function envCreds() {
  return {
    brightDataApiKey: process.env.BRIGHT_DATA_API_KEY ?? "",
    brightDataSerpZone: process.env.BRIGHT_DATA_SERP_ZONE ?? "",
    brightDataUnlockerZone: process.env.BRIGHT_DATA_UNLOCKER_ZONE ?? "",
  };
}

async function test(name: string, fn: () => Promise<void>) {
  console.log(`\n${DIVIDER}`);
  console.log(`TEST: ${name}`);
  console.log(DIVIDER);
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function main() {
  console.log("Bright Data E2E Service Tests");
  console.log(`API Key: ${process.env.BRIGHT_DATA_API_KEY?.slice(0, 8)}...`);
  console.log(`SERP Zone: ${process.env.BRIGHT_DATA_SERP_ZONE}`);
  console.log(`Unlocker Zone: ${process.env.BRIGHT_DATA_UNLOCKER_ZONE}`);

  const creds = envCreds();
  const client = createBrightDataClient(creds);

  // ── 1. SDK Client Init ──
  await test("SDK Client Init", async () => {
    console.log("  Client created:", !!client);
    console.log("  Has search router:", !!client.search);
    console.log("  Has scrape router:", !!client.scrape);
    console.log("  Has LinkedIn API:", !!client.scrape.linkedin);
  });

  // ── 2. SERP: Single Search ──
  await test("SERP: searchGoogle", async () => {
    const results = await searchGoogle("Bright Data company", creds, { numResults: 5 });
    console.log(`  Results: ${results.length}`);
    for (const r of results.slice(0, 3)) {
      console.log(`  [${r.position}] ${r.title} — ${r.url}`);
    }
    if (results.length === 0) throw new Error("No results");
  });

  // ── 3. SERP: Batch Search ──
  await test("SERP: searchBatch", async () => {
    const results = await searchBatch(
      ["Stripe company funding", "OpenAI company employees"],
      creds,
      { numResults: 3 }
    );
    console.log(`  Deduplicated results: ${results.length}`);
    for (const r of results.slice(0, 4)) {
      console.log(`  - ${r.title}`);
    }
    if (results.length === 0) throw new Error("No results");
  });

  // ── 4. Web Unlocker: scrapeUrl (HTML) ──
  await test("Web Unlocker: scrapeUrl", async () => {
    const result = await scrapeUrl("https://example.com", creds);
    if (!result) throw new Error("Scrape returned null");
    console.log(`  Status: ${result.statusCode}`);
    console.log(`  HTML length: ${result.html.length} chars`);
    console.log(`  Has <title>: ${result.html.includes("<title>")}`);
  });

  // ── 5. Web Unlocker: scrapeAsMarkdown ──
  await test("Web Unlocker: scrapeAsMarkdown", async () => {
    const md = await scrapeAsMarkdown("https://example.com", creds);
    if (!md) throw new Error("Markdown scrape returned null");
    console.log(`  Markdown length: ${md.length} chars`);
    console.log(`  Preview: ${md.slice(0, 150)}`);
  });

  // ── 6. LinkedIn Company (mapped) ──
  await test("LinkedIn Company", async () => {
    const data = await scrapeLinkedInCompany(
      "https://www.linkedin.com/company/bright-data/",
      creds
    );
    if (!data) throw new Error("Returned null");
    console.log(`  Name: ${data.name}`);
    console.log(`  Industry: ${data.industry}`);
    console.log(`  HQ: ${data.headquarters}`);
    console.log(`  Employees: ${data.employeeCount}`);
    console.log(`  Followers: ${data.followerCount}`);
    console.log(`  Website: ${data.website}`);
    console.log(`  Type: ${data.type}`);
    console.log(`  Founded: ${data.founded}`);
  });

  // ── 7. LinkedIn Profile (mapped) ──
  await test("LinkedIn Profile", async () => {
    const data = await scrapeLinkedInProfile(
      "https://www.linkedin.com/in/hello-agents/",
      creds
    );
    if (!data) throw new Error("Returned null");
    console.log(`  Name: ${data.name}`);
    console.log(`  Headline: ${data.headline}`);
    console.log(`  Company: ${data.currentCompany}`);
    console.log(`  Location: ${data.location}`);
    console.log(`  Connections: ${data.connections}`);
    if (data.education?.length) {
      console.log(`  Education: ${data.education[0].school}`);
    }
  });

  // ── Summary ──
  console.log(`\n${DIVIDER}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(DIVIDER);

  await client.close();
}

main().catch(console.error);
