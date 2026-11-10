import type { CSVRow } from "../types/enrichment";
import type { Credentials } from "../credentials";
import { createLLM } from "../config/llm";

export type IdentifierType =
  | "email"
  | "domain"
  | "website"
  | "linkedin_url"
  | "company_name"
  | "unknown";

export interface IdentifierDetection {
  column: string | null;
  type: IdentifierType;
  confidence: number;
  reasoning?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
const URL_REGEX = /^https?:\/\/.+/;
const LINKEDIN_REGEX = /linkedin\.com\/(company|in)\//i;

const LLM_FALLBACK_THRESHOLD = 0.7;

const SYSTEM_PROMPT = `You are a data analyst helping users enrich company data. Given CSV column headers and sample rows, determine which column best identifies companies for web enrichment.

We need to look up each row on the web to enrich it with company data (industry, employee count, funding, tech stack, etc.). To do that, we need a column that identifies the company — an email address, domain, website URL, LinkedIn URL, or company name.

Analyze the headers and sample data, then return a JSON object with:
- "column": the exact header name of the best identifier column
- "type": one of "email", "domain", "website", "linkedin_url", "company_name"
- "confidence": 0-1 how confident you are this is the right column
- "reasoning": one sentence explaining your choice

Prefer columns in this order (best to worst):
1. Email addresses (user@company.com) — we can extract the domain
2. Company domains (company.com) — direct web lookup
3. Website URLs (https://company.com) — direct web lookup
4. LinkedIn URLs (linkedin.com/company/x) — structured data via API
5. Company names (Acme Corp) — requires search, least reliable

Only pick a column that has actual data in it. If a column header looks right but the values are mostly empty, pick a different one with better coverage.

Respond with ONLY the JSON object, no markdown, no explanation outside the JSON.`;

/**
 * Detect the identifier type for a single column's values using regex patterns.
 * Returns the detected type and a confidence score (0-1).
 */
function scoreColumnValues(values: string[]): { type: IdentifierType; confidence: number } {
  const nonEmpty = values.filter((v) => v && v.trim().length > 0);
  if (nonEmpty.length === 0) return { type: "unknown", confidence: 0 };

  let emailCount = 0;
  let domainCount = 0;
  let linkedinCount = 0;
  let urlCount = 0;

  for (const v of nonEmpty) {
    const trimmed = v.trim();
    if (EMAIL_REGEX.test(trimmed)) emailCount++;
    if (LINKEDIN_REGEX.test(trimmed)) linkedinCount++;
    else if (URL_REGEX.test(trimmed)) urlCount++;
    else if (DOMAIN_REGEX.test(trimmed)) domainCount++;
  }

  const total = nonEmpty.length;
  if (emailCount / total > 0.5) return { type: "email", confidence: emailCount / total };
  if (linkedinCount / total > 0.5) return { type: "linkedin_url", confidence: linkedinCount / total };
  if (urlCount / total > 0.5) return { type: "website", confidence: urlCount / total };
  if (domainCount / total > 0.5) return { type: "domain", confidence: domainCount / total };

  // Heuristic: if we have non-empty values but no pattern match, assume company names
  // with low confidence
  return { type: "company_name", confidence: 0.3 };
}

/**
 * Score each column in the CSV rows and return the best scoring column.
 */
function detectBestColumnByRegex(rows: CSVRow[]): { column: string | null; type: IdentifierType; confidence: number } {
  if (rows.length === 0) return { column: null, type: "unknown", confidence: 0 };

  const headers = Object.keys(rows[0]);
  if (headers.length === 0) return { column: null, type: "unknown", confidence: 0 };

  let bestColumn: string | null = null;
  let bestType: IdentifierType = "unknown";
  let bestConfidence = 0;

  for (const header of headers) {
    const values = rows.map((r) => r[header] ?? "");
    const { type, confidence } = scoreColumnValues(values);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestColumn = header;
      bestType = type;
    }
  }

  return { column: bestColumn, type: bestType, confidence: bestConfidence };
}

/**
 * Detect the best identifier column using LLM analysis.
 */
async function detectByLLM(
  rows: CSVRow[],
  credentials: Pick<Credentials, "openRouterApiKey">,
): Promise<IdentifierDetection> {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const headerList = headers.join(", ");
  const sampleRows = rows.slice(0, 5);
  const sampleTable = sampleRows
    .map((row, i) => {
      const cells = headers.map((h) => `${h}: "${(row[h] || "").slice(0, 60)}"`);
      return `Row ${i + 1}: { ${cells.join(", ")} }`;
    })
    .join("\n");

  const llm = createLLM({ openRouterApiKey: credentials.openRouterApiKey } as Credentials, 0);
  const response = await llm.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `CSV Headers: [${headerList}]\n\nSample data (${rows.length} rows total, showing first 5):\n${sampleTable}\n\nWhich column should we use to identify companies for enrichment?`,
    },
  ]);

  const text =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = (jsonMatch[1] ?? text).trim();

  const result = JSON.parse(jsonStr) as {
    column?: unknown;
    type?: unknown;
    confidence?: unknown;
    reasoning?: unknown;
  };

  return {
    column: typeof result.column === "string" ? result.column : null,
    type: (result.type as IdentifierType) || "unknown",
    confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
    reasoning: typeof result.reasoning === "string" ? result.reasoning : undefined,
  };
}

/**
 * Detect the best identifier column from CSV rows.
 *
 * 1. Uses regex-based scoring on all columns to find the best match.
 * 2. If confidence is below LLM_FALLBACK_THRESHOLD and useLLMFallback is true
 *    with credentials provided, falls back to LLM-based detection.
 * 3. Returns the detection result with column, type, confidence, and optional reasoning.
 */
export async function detectIdentifierColumn(
  rows: CSVRow[],
  options?: { credentials?: Pick<Credentials, "openRouterApiKey">; useLLMFallback?: boolean },
): Promise<IdentifierDetection> {
  const regexResult = detectBestColumnByRegex(rows);

  if (
    regexResult.confidence >= LLM_FALLBACK_THRESHOLD ||
    !options?.useLLMFallback ||
    !options?.credentials
  ) {
    return {
      column: regexResult.column,
      type: regexResult.type,
      confidence: regexResult.confidence,
    };
  }

  // Fall back to LLM
  try {
    return await detectByLLM(rows, options.credentials);
  } catch {
    // LLM failed — return what we have from regex
    return {
      column: regexResult.column,
      type: regexResult.type,
      confidence: regexResult.confidence,
    };
  }
}
