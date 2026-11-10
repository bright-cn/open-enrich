import type { StructuredToolInterface } from "@langchain/core/tools";
import type { Credentials } from "./credentials";
import type {
  CSVRow,
  EnrichmentField,
  RowEnrichmentResult,
  AgentStep,
  RowCost,
} from "./types/enrichment";
import { buildEnrichmentGraph } from "./agents/graph";
import { CostTracker } from "./cost-tracker";
import {
  shouldSkipEmail,
  getSkipReason,
  CONCURRENT_ROWS,
  AGENT_TIMEOUT_MS,
} from "./identifier/skip-domains";

export interface RunEnrichmentOptions {
  rows: CSVRow[];
  fields: EnrichmentField[];
  identifierColumn: string;
  firstNameColumn?: string;
  lastNameColumn?: string;
  credentials: Credentials;
  concurrency?: number;
  maxRows?: number;
  maxFields?: number;
  agentTimeoutMs?: number;
  mcpTools?: StructuredToolInterface[];
  signal?: AbortSignal;
}

export type RunEnrichmentEvent =
  | { type: "session"; sessionId: string }
  | { type: "pending"; rowIndex: number; totalRows: number }
  | { type: "processing"; rowIndex: number; totalRows: number }
  | {
      type: "agent_progress";
      rowIndex: number;
      step: AgentStep;
      message: string;
      sourceUrl?: string;
    }
  | { type: "cost_update"; rowIndex: number; cost: RowCost }
  | { type: "result"; result: RowEnrichmentResult; cost?: RowCost }
  | { type: "error"; rowIndex: number; error: string }
  | { type: "complete"; totalRows: number; successCount: number };

export function runEnrichment(
  options: RunEnrichmentOptions,
): AsyncIterable<RunEnrichmentEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      const {
        rows,
        fields,
        identifierColumn,
        firstNameColumn,
        lastNameColumn,
        credentials,
        concurrency = CONCURRENT_ROWS,
        maxRows = Infinity,
        maxFields = Infinity,
        mcpTools = [],
        signal,
      } = options;

      // Reference unused timeout default so it remains part of the public
      // contract; agent-level timeout handling lives inside the graph.
      void AGENT_TIMEOUT_MS;

      if (rows.length > maxRows) {
        throw new Error(`Max ${maxRows} rows allowed, got ${rows.length}`);
      }
      if (fields.length > maxFields) {
        throw new Error(`Max ${maxFields} fields allowed, got ${fields.length}`);
      }

      const sessionId = crypto.randomUUID();
      yield { type: "session", sessionId };

      for (let i = 0; i < rows.length; i++) {
        yield { type: "pending", rowIndex: i, totalRows: rows.length };
      }

      // Event queue used to bridge the parallel row processing into a
      // single async iterator. Each processRow pushes events; the
      // generator drains the queue between batches.
      type QueuedEvent = RunEnrichmentEvent;
      const queue: QueuedEvent[] = [];
      let waiting: ((e: QueuedEvent | null) => void) | null = null;

      const push = (e: QueuedEvent) => {
        if (waiting) {
          const w = waiting;
          waiting = null;
          w(e);
        } else {
          queue.push(e);
        }
      };

      const onProgress = (event: {
        rowIndex: number;
        step: AgentStep;
        message: string;
        sourceUrl?: string;
      }) => {
        push({ type: "agent_progress", ...event });
      };

      const graph = buildEnrichmentGraph(onProgress);

      let successCount = 0;
      let done = false;

      const runAllRows = async () => {
        for (
          let batchStart = 0;
          batchStart < rows.length;
          batchStart += concurrency
        ) {
          if (signal?.aborted) break;
          const batchEnd = Math.min(batchStart + concurrency, rows.length);
          const promises = [];
          for (let i = batchStart; i < batchEnd; i++) {
            promises.push(
              processRow(
                rows[i],
                i,
                fields,
                identifierColumn,
                graph,
                push,
                credentials,
                firstNameColumn,
                lastNameColumn,
                mcpTools,
              ).then((ok) => {
                if (ok) successCount++;
              }),
            );
          }
          await Promise.allSettled(promises);
        }
        push({ type: "complete", totalRows: rows.length, successCount });
        done = true;
        if (waiting) {
          const w = waiting;
          waiting = null;
          w(null);
        }
      };

      // Kick off processing in the background. Wrap in catch to surface
      // unexpected errors as a row-less error event rather than producing
      // an unhandled rejection.
      runAllRows().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        push({ type: "error", rowIndex: -1, error: message });
        done = true;
        if (waiting) {
          const w = waiting;
          waiting = null;
          w(null);
        }
      });

      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        if (done) return;
        const next = await new Promise<QueuedEvent | null>((resolve) => {
          waiting = resolve;
        });
        if (next === null) return;
        yield next;
      }
    },
  };
}

async function processRow(
  row: CSVRow,
  rowIndex: number,
  fields: EnrichmentField[],
  identifierColumn: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph: any,
  push: (e: RunEnrichmentEvent) => void,
  credentials: Credentials,
  firstNameColumn?: string,
  lastNameColumn?: string,
  mcpTools?: StructuredToolInterface[],
): Promise<boolean> {
  // Resolve identifier from selected column with fallback chain.
  const rawValue = row[identifierColumn]?.trim();
  const identifier =
    rawValue ||
    row["companywebsite"]?.trim() ||
    row["companyname"]?.trim() ||
    row["linkedincompanypageurl"]?.trim() ||
    findFirstNonEmpty(row);

  if (!identifier) {
    push({
      type: "result",
      result: makeResult(rowIndex, row, "skipped", "No identifier found in any column"),
    });
    return false;
  }

  // Parse any format (email, URL, domain, company name).
  const { email, domain, companyGuess } = parseIdentifier(identifier);

  if (domain && shouldSkipEmail(`check@${domain}`)) {
    const reason = getSkipReason(`check@${domain}`);
    push({
      type: "result",
      result: makeResult(rowIndex, row, "skipped", reason),
    });
    return false;
  }

  push({ type: "processing", rowIndex, totalRows: 0 });

  // Case-insensitive column lookup helper.
  const col = (key: string): string => {
    if (row[key] !== undefined) return row[key].trim();
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === lower) return v?.trim() || "";
    }
    return "";
  };

  // Pre-populate state from CSV columns to accelerate discovery.
  const csvCompanyName = col("companyname") || col("company name") || col("company");
  const csvWebsite = col("companywebsite") || col("company website") || col("website");
  const csvLinkedin =
    col("linkedincompanypageurl") || col("linkedin company page url") || col("linkedin");

  // Person context from CSV (prefer caller-selected columns, fallback to common variants).
  const personFirstName =
    (firstNameColumn && col(firstNameColumn)) ||
    col("first name") ||
    col("firstname") ||
    col("first_name") ||
    col("fname") ||
    "";
  const personLastName =
    (lastNameColumn && col(lastNameColumn)) ||
    col("last name") ||
    col("lastname") ||
    col("last_name") ||
    col("lname") ||
    "";

  const costTracker = new CostTracker((cost) => {
    push({ type: "cost_update", rowIndex, cost });
  });

  try {
    const state = await graph.invoke(
      {
        email: email || `info@${domain}`,
        domain: domain || extractDomainFromUrl(csvWebsite) || "",
        companyNameGuess: companyGuess || csvCompanyName,
        requestedFields: fields,
        pendingFields: fields.map((f) => f.name),
        // Pre-seed discovered context from CSV.
        companyName: csvCompanyName,
        companyWebsite: csvWebsite.startsWith("http")
          ? csvWebsite
          : csvWebsite
            ? `https://${csvWebsite}`
            : "",
        linkedinUrl: csvLinkedin,
        personFirstName,
        personLastName,
        personCompany: csvCompanyName,
      },
      { configurable: { costTracker, mcpTools: mcpTools ?? [], credentials } },
    );

    const result: RowEnrichmentResult = {
      rowIndex,
      originalData: row,
      enrichments: {},
      status: "completed",
    };

    for (const field of state.completedFields) {
      result.enrichments[field.field] = field;
    }

    push({ type: "result", result, cost: costTracker.snapshot() });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] Row ${rowIndex}: ERROR — ${message}`);
    push({ type: "error", rowIndex, error: message });
    push({ type: "result", result: makeResult(rowIndex, row, "error", message) });
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────

function makeResult(
  rowIndex: number,
  originalData: CSVRow,
  status: "skipped" | "error",
  error: string,
): RowEnrichmentResult {
  return { rowIndex, originalData, enrichments: {}, status, error };
}

function domainToCompanyName(domain: string): string {
  if (!domain) return "";
  return domain
    .replace(/^(www\.)?/, "")
    .replace(/\.(com|io|co|org|net|ai|dev|app|xyz|co\.\w+)$/, "")
    .split(".")
    .pop()!
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractDomainFromUrl(url: string): string {
  if (!url) return "";
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseIdentifier(value: string): {
  email: string;
  domain: string;
  companyGuess: string;
} {
  const trimmed = value.trim();

  // Full email: user@domain.com
  if (trimmed.includes("@")) {
    const domain = trimmed.split("@")[1]!.toLowerCase();
    return { email: trimmed, domain, companyGuess: domainToCompanyName(domain) };
  }

  // URL: https://example.com/... or www.example.com
  if (trimmed.includes("://") || trimmed.startsWith("www.")) {
    try {
      const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return {
        email: "",
        domain: hostname,
        companyGuess: domainToCompanyName(hostname),
      };
    } catch {
      // fall through
    }
  }

  // LinkedIn URL: linkedin.com/company/something
  if (trimmed.includes("linkedin.com")) {
    try {
      const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      const slug = url.match(/company\/([^/?]+)/)?.[1] || "";
      return {
        email: "",
        domain: hostname,
        companyGuess: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      };
    } catch {
      // fall through
    }
  }

  // Bare domain: example.com (contains a dot, no spaces)
  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    const domain = trimmed.toLowerCase().replace(/^www\./, "");
    return { email: "", domain, companyGuess: domainToCompanyName(domain) };
  }

  // Company name (no dot, no @)
  return { email: "", domain: "", companyGuess: trimmed };
}

function findFirstNonEmpty(row: CSVRow): string {
  for (const v of Object.values(row)) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
}
