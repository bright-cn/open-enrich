"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import type { CSVRow } from "@brightdata/enrich-core";
import { detectCsvFormat } from "@/lib/csv-format-detector";
import type { CsvFormat } from "@/lib/csv-format-detector";
import { mapExistingColumns } from "@/lib/column-mapper";
import { withBasePath } from "@/lib/base-path";

export type IdentifierType =
  | "email"
  | "domain"
  | "website"
  | "linkedin_url"
  | "company_name"
  | "unknown";

export type { CsvFormat };

interface CSVParseResult {
  rows: CSVRow[];
  headers: string[];
  identifierColumn: string | null;
  identifierType: IdentifierType;
  identifierConfidence: number;
  identifierCoverage: number;
  identifierReasoning: string;
  detectedFormat: {
    format: CsvFormat;
    confidence: number;
    matchedHeaders: string[];
  };
  existingFields: Map<
    string,
    {
      internalField: string;
      coverage: number;
      quality: "good" | "low" | "empty";
    }
  >;
  error: string | null;
}

export function useCSVParser() {
  const [result, setResult] = useState<CSVParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const parseFile = useCallback((file: File) => {
    setIsParsing(true);
    setIsDetecting(false);
    setResult(null);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete(parsed) {
        const rows = parsed.data.filter((row) =>
          Object.values(row).some((v) => v && v.trim().length > 0)
        );

        if (rows.length === 0) {
          setResult({
            rows: [],
            headers: [],
            identifierColumn: null,
            identifierType: "unknown",
            identifierConfidence: 0,
            identifierCoverage: 0,
            identifierReasoning: "",
            detectedFormat: { format: "generic", confidence: 0, matchedHeaders: [] },
            existingFields: new Map(),
            error: "CSV file is empty or contains no valid rows.",
          });
          setIsParsing(false);
          return;
        }

        const headers = Object.keys(rows[0]);
        const detectedFormat = detectCsvFormat(headers);
        const columnMapping = mapExistingColumns(headers, rows);

        const existingFields = new Map<
          string,
          { internalField: string; coverage: number; quality: "good" | "low" | "empty" }
        >();
        for (const [key, value] of columnMapping) {
          existingFields.set(key, {
            internalField: value.internalField,
            coverage: value.coverage,
            quality: value.quality,
          });
        }

        // Set initial result with no identifier (LLM will detect it)
        setResult({
          rows,
          headers,
          identifierColumn: null,
          identifierType: "unknown",
          identifierConfidence: 0,
          identifierCoverage: 0,
          identifierReasoning: "",
          detectedFormat,
          existingFields,
          error: null,
        });
        setIsParsing(false);

        // Fire LLM detection async
        setIsDetecting(true);
        detectIdentifierWithLLM(headers, rows)
          .then((detection) => {
            setResult((prev) => {
              if (!prev) return prev;
              // Compute coverage for the detected column
              const coverage = detection.column
                ? computeCoverage(rows, detection.column)
                : 0;
              return {
                ...prev,
                identifierColumn: detection.column,
                identifierType: detection.type as IdentifierType,
                identifierConfidence: detection.confidence,
                identifierCoverage: coverage,
                identifierReasoning: detection.reasoning,
              };
            });
          })
          .catch((err) => {
            console.error("[use-csv-parser] LLM detection failed, using fallback:", err);
            // Fallback to simple heuristic
            const fallback = fallbackDetect(headers, rows);
            setResult((prev) => {
              if (!prev) return prev;
              return { ...prev, ...fallback };
            });
          })
          .finally(() => {
            setIsDetecting(false);
          });
      },
      error(err) {
        setResult({
          rows: [],
          headers: [],
          identifierColumn: null,
          identifierType: "unknown",
          identifierConfidence: 0,
          identifierCoverage: 0,
          identifierReasoning: "",
          detectedFormat: { format: "generic", confidence: 0, matchedHeaders: [] },
          existingFields: new Map(),
          error: `Failed to parse CSV: ${err.message}`,
        });
        setIsParsing(false);
      },
    });
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setIsDetecting(false);
  }, []);

  return { result, isParsing, isDetecting, parseFile, reset };
}

// ── LLM detection ─────────────────────────────────────────

async function detectIdentifierWithLLM(
  headers: string[],
  rows: CSVRow[]
): Promise<{ column: string | null; type: string; confidence: number; reasoning: string }> {
  const sampleRows = rows.slice(0, 5);

  const resp = await fetch(withBasePath("/api/detect-identifier"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headers, sampleRows }),
  });

  if (!resp.ok) {
    throw new Error(`Detection API returned ${resp.status}`);
  }

  return resp.json();
}

// ── Fallback heuristic (no LLM) ──────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_REGEX = /^[a-z0-9-]+\.(com|io|org|net|co|ai|dev|app|xyz)$/i;
const LINKEDIN_REGEX = /linkedin\.com\/(in|company)\//i;
const WEBSITE_REGEX = /^https?:\/\//;

function fallbackDetect(headers: string[], rows: CSVRow[]) {
  const sample = rows.slice(0, 50);
  let bestCol: string | null = null;
  let bestType: IdentifierType = "unknown";
  let bestScore = 0;

  for (const header of headers) {
    const lower = header.toLowerCase();
    let score = 0;
    let type: IdentifierType = "unknown";

    // Check sample values
    let matches = 0;
    let nonEmpty = 0;
    for (const row of sample) {
      const v = (row[header] ?? "").trim();
      if (!v) continue;
      nonEmpty++;
      if (EMAIL_REGEX.test(v)) { matches++; type = "email"; }
      else if (LINKEDIN_REGEX.test(v)) { matches++; type = "linkedin_url"; }
      else if (DOMAIN_REGEX.test(v)) { matches++; type = "domain"; }
      else if (WEBSITE_REGEX.test(v)) { matches++; type = "website"; }
    }

    if (nonEmpty === 0) continue;
    const coverage = nonEmpty / sample.length;
    const matchRate = matches / nonEmpty;

    // Header hint bonus
    const hintBonus =
      /email/i.test(lower) ? 1.3 :
      /domain/i.test(lower) ? 1.2 :
      /linkedin/i.test(lower) ? 1.2 :
      /website|url/i.test(lower) ? 1.1 :
      /company/i.test(lower) ? 0.8 : 1.0;

    score = matchRate * coverage * hintBonus;

    // If no pattern matched but header suggests company name
    if (type === "unknown" && /company|account|organization/i.test(lower) && coverage > 0.5) {
      type = "company_name";
      score = 0.4 * coverage;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCol = header;
      bestType = type;
    }
  }

  return {
    identifierColumn: bestCol,
    identifierType: bestType,
    identifierConfidence: bestScore,
    identifierCoverage: bestCol ? computeCoverage(rows, bestCol) : 0,
    identifierReasoning: "Detected via pattern matching (LLM unavailable)",
  };
}

function computeCoverage(rows: CSVRow[], column: string): number {
  const sample = rows.slice(0, 200);
  let nonEmpty = 0;
  for (const row of sample) {
    if ((row[column] ?? "").trim().length > 0) nonEmpty++;
  }
  return sample.length > 0 ? nonEmpty / sample.length : 0;
}
