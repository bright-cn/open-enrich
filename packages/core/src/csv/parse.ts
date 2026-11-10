import Papa from "papaparse";
import type { CSVRow } from "../types/enrichment";

export interface ParsedCSV {
  headers: string[];
  rows: CSVRow[];
}

export function parseCSV(input: string): ParsedCSV {
  const result = Papa.parse<CSVRow>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return {
    headers: result.meta.fields ?? [],
    rows: result.data.map((row) => {
      const trimmed: CSVRow = {};
      for (const [k, v] of Object.entries(row)) {
        trimmed[k] = typeof v === "string" ? v.trim() : String(v ?? "");
      }
      return trimmed;
    }),
  };
}
