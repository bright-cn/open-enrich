import type { RowCost } from "@brightdata/enrich-core";
import { calculateClayComparison } from "@/lib/clay-pricing";

export interface EnrichmentReport {
  summary: {
    totalRows: number;
    enrichedCount: number;
    skippedCount: number;
    errorCount: number;
    enrichmentRate: number;
  };
  fieldCoverage: Array<{
    field: string;
    populatedCount: number;
    populatedPercent: number;
    avgConfidence: number;
    minConfidence: number;
    maxConfidence: number;
  }>;
  sourceAttribution: Array<{
    source: string;
    fieldCount: number;
    rowCount: number;
  }>;
  qualityFlags: Array<{
    rowIndex: number;
    field: string;
    issue: string;
  }>;
  costAnalysis?: {
    totalCost: RowCost;
    clayCost: {
      totalDataCost: number;
      totalPlatformCost: number;
      totalCost: number;
      perRowAverage: number;
      monthlyPlatformCost: number;
      fieldTotals: Record<string, number>;
    };
    savings: number;
    perRowCost: number;
  };
}

const DOMAIN_LABELS: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "crunchbase.com": "Crunchbase",
  "google.com": "Google Search",
  "github.com": "GitHub",
  "twitter.com": "Twitter",
  "x.com": "Twitter",
  "pitchbook.com": "PitchBook",
  "bloomberg.com": "Bloomberg",
  "zoominfo.com": "ZoomInfo",
  "apollo.io": "Apollo",
};

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

function readableSource(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

export function generateReport(
  rows: Array<{
    rowIndex: number;
    enrichments: Record<
      string,
      {
        value: unknown;
        confidence: number;
        sourceContext?: Array<{ url: string }>;
      }
    >;
    status: string;
  }>,
  requestedFieldNames: string[],
  totalCost?: RowCost
): EnrichmentReport {
  const totalRows = rows.length;
  let enrichedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    if (row.status === "completed" || row.status === "done") {
      enrichedCount++;
    } else if (row.status === "skipped") {
      skippedCount++;
    } else if (row.status === "error") {
      errorCount++;
    }
  }

  const enrichmentRate = totalRows > 0 ? (enrichedCount / totalRows) * 100 : 0;

  // ---- Field Coverage ----

  const completedRows = rows.filter(
    (r) => r.status === "completed" || r.status === "done"
  );

  const fieldCoverage = requestedFieldNames.map((field) => {
    let populatedCount = 0;
    const confidences: number[] = [];

    for (const row of completedRows) {
      const entry = row.enrichments[field];
      if (entry && entry.value != null && entry.value !== "") {
        populatedCount++;
        confidences.push(entry.confidence);
      }
    }

    const populatedPercent =
      completedRows.length > 0
        ? Math.round((populatedCount / completedRows.length) * 100)
        : 0;
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;
    const minConfidence =
      confidences.length > 0 ? Math.min(...confidences) : 0;
    const maxConfidence =
      confidences.length > 0 ? Math.max(...confidences) : 0;

    return {
      field,
      populatedCount,
      populatedPercent,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      minConfidence: Math.round(minConfidence * 100) / 100,
      maxConfidence: Math.round(maxConfidence * 100) / 100,
    };
  });

  fieldCoverage.sort((a, b) => b.populatedPercent - a.populatedPercent);

  // ---- Source Attribution ----

  const sourceMap = new Map<
    string,
    { fieldCount: number; rowIndices: Set<number> }
  >();

  for (const row of completedRows) {
    for (const [, entry] of Object.entries(row.enrichments)) {
      if (!entry.sourceContext) continue;
      for (const ctx of entry.sourceContext) {
        const domain = extractHostname(ctx.url);
        const label = readableSource(domain);
        let bucket = sourceMap.get(label);
        if (!bucket) {
          bucket = { fieldCount: 0, rowIndices: new Set() };
          sourceMap.set(label, bucket);
        }
        bucket.fieldCount++;
        bucket.rowIndices.add(row.rowIndex);
      }
    }
  }

  const sourceAttribution = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      fieldCount: data.fieldCount,
      rowCount: data.rowIndices.size,
    }))
    .sort((a, b) => b.fieldCount - a.fieldCount)
    .slice(0, 10);

  // ---- Quality Flags ----

  const qualityFlags: EnrichmentReport["qualityFlags"] = [];

  for (const row of completedRows) {
    if (qualityFlags.length >= 50) break;

    for (const field of requestedFieldNames) {
      if (qualityFlags.length >= 50) break;

      const entry = row.enrichments[field];
      if (!entry || entry.value == null || entry.value === "") {
        qualityFlags.push({
          rowIndex: row.rowIndex,
          field,
          issue: "missing",
        });
      } else if (entry.confidence < 0.3) {
        qualityFlags.push({
          rowIndex: row.rowIndex,
          field,
          issue: "low confidence",
        });
      }
    }
  }

  let costAnalysis: EnrichmentReport["costAnalysis"];
  if (totalCost) {
    const enrichedFieldNames = rows
      .filter((r) => r.status === "completed")
      .map((r) =>
        Object.entries(r.enrichments)
          .filter(([, v]) => v.value != null && v.confidence > 0)
          .map(([k]) => k)
      );
    const clayCost = calculateClayComparison(rows.length, enrichedFieldNames);
    const savings = clayCost.totalCost > 0
      ? Math.round((1 - totalCost.totalCost / clayCost.totalCost) * 100)
      : 0;
    costAnalysis = {
      totalCost,
      clayCost,
      savings,
      perRowCost: rows.length > 0 ? totalCost.totalCost / rows.length : 0,
    };
  }

  return {
    summary: {
      totalRows,
      enrichedCount,
      skippedCount,
      errorCount,
      enrichmentRate: Math.round(enrichmentRate * 10) / 10,
    },
    fieldCoverage,
    sourceAttribution,
    qualityFlags,
    costAnalysis,
  };
}

export function generateMarkdownReport(report: EnrichmentReport): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const lines: string[] = [];

  lines.push("# Open Enrich — Enrichment Report");
  lines.push(`Generated: ${now}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total Rows | ${report.summary.totalRows} |`);
  lines.push(
    `| Enriched | ${report.summary.enrichedCount} (${report.summary.enrichmentRate}%) |`
  );
  lines.push(`| Skipped | ${report.summary.skippedCount} |`);
  lines.push(`| Errors | ${report.summary.errorCount} |`);
  lines.push("");

  // Field Coverage
  lines.push("## Field Coverage");
  lines.push("| Field | Coverage | Avg Confidence |");
  lines.push("|-------|----------|----------------|");
  for (const fc of report.fieldCoverage) {
    lines.push(
      `| ${fc.field} | ${fc.populatedPercent}% | ${Math.round(fc.avgConfidence * 100)}% |`
    );
  }
  lines.push("");

  // Source Attribution
  lines.push("## Source Attribution");
  lines.push("| Source | Fields | Rows |");
  lines.push("|--------|--------|------|");
  for (const sa of report.sourceAttribution) {
    lines.push(`| ${sa.source} | ${sa.fieldCount} | ${sa.rowCount} |`);
  }
  lines.push("");

  // Quality Flags
  lines.push("## Quality Flags");
  lines.push(`${report.qualityFlags.length} issues found.`);
  for (const flag of report.qualityFlags) {
    lines.push(
      `- Row ${flag.rowIndex}: ${flag.field} — ${flag.issue}`
    );
  }
  lines.push("");

  return lines.join("\n");
}
