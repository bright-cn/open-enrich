/**
 * E2E test script for all LangChain tool wrappers.
 * Run with: npx tsx scripts/test-tools.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createSearchTool,
  createScrapeTool,
  createLinkedInCompanyTool,
  createLinkedInProfileTool,
  createCrunchbaseTool,
  submitFieldTool,
  type Credentials,
} from "@brightdata/enrich-core";
// Deep Lookup skipped — it's slow, expensive, and was validated at the service layer

const credentials: Credentials = {
  brightDataApiKey: process.env.BRIGHT_DATA_API_KEY ?? "",
  brightDataSerpZone: process.env.BRIGHT_DATA_SERP_ZONE ?? "",
  brightDataUnlockerZone: process.env.BRIGHT_DATA_UNLOCKER_ZONE ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
};

const searchTool = createSearchTool(credentials);
const scrapeTool = createScrapeTool(credentials);
const linkedinCompanyTool = createLinkedInCompanyTool(credentials);
const linkedinProfileTool = createLinkedInProfileTool(credentials);
const crunchbaseTool = createCrunchbaseTool(credentials);

const DIVIDER = "─".repeat(60);
let passed = 0;
let failed = 0;

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

function parse(result: string): Record<string, unknown> {
  const obj = JSON.parse(result);
  return obj as Record<string, unknown>;
}

async function main() {
  console.log("LangChain Tools E2E Tests\n");

  // ── 1. web_search ──
  await test("web_search: single query", async () => {
    const result = await searchTool.invoke({
      queries: ["Stripe company funding 2024"],
      numResults: 3,
    });
    const data = parse(result);
    console.log(`  Count: ${data.count}`);
    const results = data.results as Array<Record<string, string>>;
    for (const r of results.slice(0, 3)) {
      console.log(`  - ${r.title}`);
      console.log(`    ${r.url}`);
    }
    if ((data.count as number) === 0) throw new Error("No results");
  });

  await test("web_search: batch queries", async () => {
    const result = await searchTool.invoke({
      queries: [
        "OpenAI employee count",
        "Anthropic Series C funding",
        "Vercel revenue 2024",
      ],
      numResults: 2,
    });
    const data = parse(result);
    console.log(`  Deduplicated count: ${data.count}`);
    if ((data.count as number) === 0) throw new Error("No results");
  });

  // ── 2. scrape_webpage ──
  await test("scrape_webpage: simple page", async () => {
    const result = await scrapeTool.invoke({
      url: "https://example.com",
    });
    const data = parse(result);
    console.log(`  Success: ${data.success}`);
    console.log(`  Content length: ${data.contentLength}`);
    const content = data.content as string;
    console.log(`  Preview: ${content.slice(0, 150)}`);
    if (!data.success) throw new Error(data.error as string);
  });

  await test("scrape_webpage: real company about page", async () => {
    const result = await scrapeTool.invoke({
      url: "https://stripe.com/about",
    });
    const data = parse(result);
    console.log(`  Success: ${data.success}`);
    console.log(`  Content length: ${data.contentLength}`);
    if (data.success) {
      const content = data.content as string;
      console.log(`  Preview: ${content.slice(0, 200)}`);
    } else {
      console.log(`  Error: ${data.error}`);
    }
  });

  // ── 3. linkedin_company ──
  await test("linkedin_company: by URL", async () => {
    const result = await linkedinCompanyTool.invoke({
      linkedinUrl: "https://www.linkedin.com/company/bright-data/",
    });
    const data = parse(result);
    console.log(`  Success: ${data.success}`);
    if (data.success) {
      const company = data.data as Record<string, unknown>;
      console.log(`  Name: ${company.name}`);
      console.log(`  Industry: ${company.industry}`);
      console.log(`  HQ: ${company.headquarters}`);
      console.log(`  Employees: ${company.employeeCount}`);
      console.log(`  Website: ${company.website}`);
    } else {
      throw new Error(data.error as string);
    }
  });

  await test("linkedin_company: by name (search)", async () => {
    const result = await linkedinCompanyTool.invoke({
      companyName: "Stripe",
    });
    const data = parse(result);
    console.log(`  Success: ${data.success}`);
    console.log(`  LinkedIn URL: ${data.linkedinUrl}`);
    if (data.success) {
      const company = data.data as Record<string, unknown>;
      console.log(`  Name: ${company.name}`);
      console.log(`  Industry: ${company.industry}`);
    } else {
      console.log(`  Error: ${data.error}`);
    }
  });

  // ── 4. linkedin_profile ──
  await test("linkedin_profile: by URL", async () => {
    const result = await linkedinProfileTool.invoke({
      linkedinUrl: "https://www.linkedin.com/in/hello-agents/",
    });
    const data = parse(result);
    console.log(`  Success: ${data.success}`);
    if (data.success) {
      const profile = data.data as Record<string, unknown>;
      console.log(`  Name: ${profile.name}`);
      console.log(`  Headline: ${profile.headline}`);
      console.log(`  Company: ${profile.currentCompany}`);
      console.log(`  Location: ${profile.location}`);
    } else {
      throw new Error(data.error as string);
    }
  });

  // ── 5. crunchbase_lookup ──
  await test("crunchbase_lookup: by name", async () => {
    const result = await crunchbaseTool.invoke({
      companyName: "Stripe",
    });
    const data = parse(result);
    console.log(`  Success: ${data.success}`);
    console.log(`  Crunchbase URL: ${data.crunchbaseUrl}`);
    if (data.success) {
      const content = data.content as string;
      console.log(`  Content length: ${content.length}`);
      console.log(`  Preview: ${content.slice(0, 200)}`);
    } else {
      console.log(`  Error: ${data.error}`);
    }
  });

  // ── 6. submit_field ──
  await test("submit_field: submit a field", async () => {
    const result = await submitFieldTool.invoke({
      field: "employee_count",
      value: 8000,
      confidence: 0.9,
      sources: [
        {
          url: "https://linkedin.com/company/stripe",
          snippet: "Stripe has over 8,000 employees worldwide",
          confidence: 0.9,
        },
      ],
    });
    const data = parse(result);
    console.log(`  Submitted: ${data.submitted}`);
    console.log(`  Field: ${data.field}`);
    console.log(`  Value: ${data.value}`);
    console.log(`  Confidence: ${data.confidence}`);
    if (!data.submitted) throw new Error("Submit failed");
  });

  await test("submit_field: submit null (not found)", async () => {
    const result = await submitFieldTool.invoke({
      field: "valuation",
      value: null,
      confidence: 0,
      sources: [],
    });
    const data = parse(result);
    console.log(`  Submitted: ${data.submitted}`);
    console.log(`  Field: ${data.field}`);
    console.log(`  Value: ${data.value}`);
    console.log(`  Confidence: ${data.confidence}`);
    if (!data.submitted) throw new Error("Submit failed");
  });

  // ── Summary ──
  console.log(`\n${DIVIDER}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(DIVIDER);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
