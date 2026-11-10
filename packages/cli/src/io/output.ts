import { createWriteStream, existsSync, readFileSync, type WriteStream } from "fs";
import type { CSVRow, RowEnrichmentResult, EnrichmentField } from "@brightdata/enrich-core";

function escapeCsv(value: string): string {
  if (/[,"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export class OrderedCSVWriter {
  private stream: WriteStream;
  private buffer = new Map<number, RowEnrichmentResult>();
  private nextExpected: number;
  private rowsWritten: number;

  constructor(
    private path: string,
    private originalHeaders: string[],
    private enrichmentFieldNames: string[],
    options: { append: boolean; startAt: number },
  ) {
    this.nextExpected = options.startAt;
    this.rowsWritten = options.startAt;

    if (options.append) {
      this.stream = createWriteStream(path, { flags: "a" });
    } else {
      this.stream = createWriteStream(path, { flags: "w" });
      const header = [...originalHeaders, ...enrichmentFieldNames].map(escapeCsv).join(",") + "\n";
      this.stream.write(header);
    }
  }

  buildHeader(): string {
    return [...this.originalHeaders, ...this.enrichmentFieldNames].map(escapeCsv).join(",");
  }

  acceptResult(result: RowEnrichmentResult): number {
    this.buffer.set(result.rowIndex, result);
    let drained = 0;
    while (this.buffer.has(this.nextExpected)) {
      const r = this.buffer.get(this.nextExpected)!;
      this.buffer.delete(this.nextExpected);
      this.stream.write(this.formatRow(r) + "\n");
      this.nextExpected++;
      this.rowsWritten++;
      drained++;
    }
    return drained;
  }

  private formatRow(r: RowEnrichmentResult): string {
    const cells: string[] = this.originalHeaders.map((h) => escapeCsv(r.originalData[h] ?? ""));
    for (const fieldName of this.enrichmentFieldNames) {
      const enr = r.enrichments[fieldName];
      cells.push(enr ? escapeCsv(formatValue(enr.value)) : "");
    }
    return cells.join(",");
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.end((err: NodeJS.ErrnoException | null) => (err ? reject(err) : resolve()));
    });
  }

  get count(): number { return this.rowsWritten; }
}

export interface ResumeInfo {
  exists: boolean;
  resumable: boolean;
  completedRows: number;
  reason?: string;
}

export function inspectExistingOutput(
  path: string,
  expectedHeader: string,
): ResumeInfo {
  if (!existsSync(path)) return { exists: false, resumable: false, completedRows: 0 };
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  if (lines.length === 0) return { exists: true, resumable: false, completedRows: 0, reason: "empty file" };
  const actualHeader = lines[0];
  if (actualHeader !== expectedHeader) {
    return {
      exists: true,
      resumable: false,
      completedRows: 0,
      reason: `header mismatch\n  Existing: ${actualHeader}\n  Expected: ${expectedHeader}`,
    };
  }
  // Count non-empty data rows
  let completed = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].length > 0) completed++;
  }
  return { exists: true, resumable: true, completedRows: completed };
}

export function buildHeader(originalHeaders: string[], enrichmentFieldNames: string[]): string {
  return [...originalHeaders, ...enrichmentFieldNames].map(escapeCsv).join(",");
}
