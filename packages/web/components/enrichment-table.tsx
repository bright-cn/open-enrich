"use client";

import { useState, useMemo } from "react";
import { SourceTooltip } from "./source-tooltip";
import DetailModal from "./detail-modal";
import { QualitySummaryBanner } from "./quality-summary-banner";
import { computeQualityMetrics } from "@/lib/quality-metrics";

interface SourceContext {
  url: string;
  snippet: string;
  confidence: number;
}

interface EnrichmentValue {
  field: string;
  value: string | number | boolean | string[] | null;
  confidence: number;
  source?: string;
  sourceContext?: SourceContext[];
  scrapedAt?: string;
}

interface EnrichmentResult {
  rowIndex: number;
  originalData: Record<string, string>;
  enrichments: Record<string, EnrichmentValue>;
  status: "pending" | "processing" | "completed" | "error" | "skipped";
  error?: string;
}

interface EnrichmentTableProps {
  results: EnrichmentResult[];
  originalHeaders: string[];
  enrichmentFieldNames: string[];
  isComplete?: boolean;
}

function StatusDot({ status }: { status: EnrichmentResult["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-[rgba(165,180,220,0.2)]",
    processing: "bg-[#4B8BFF] animate-pulse",
    completed: "bg-[#34D399]",
    error: "bg-[#F87171]",
    skipped: "bg-[rgba(165,180,220,0.1)]",
  };

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${styles[status] || styles.pending}`}
    />
  );
}

function confidenceBorderClass(confidence: number): string {
  if (confidence > 0.8) return "border-l-2 border-l-[#34D399]/50";
  if (confidence > 0.5) return "border-l-2 border-l-[#FBBF24]/50";
  return "border-l-2 border-l-[#F87171]/50";
}

function formatCellValue(val: EnrichmentValue): string {
  if (val.value === null || val.value === undefined) return "";
  if (Array.isArray(val.value)) return val.value.join(", ");
  if (typeof val.value === "boolean") return val.value ? "Yes" : "No";
  return String(val.value);
}

function SourceCountBadge({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <sup className="ml-0.5 text-[9px] text-[#34D399]/70 tabular-nums" title={`${count} sources agree`}>
      {count}
    </sup>
  );
}

export default function EnrichmentTable({
  results,
  originalHeaders,
  enrichmentFieldNames,
  isComplete,
}: EnrichmentTableProps) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const qualityMetrics = useMemo(() => {
    if (!isComplete || results.length === 0) return null;
    return computeQualityMetrics(results);
  }, [results, isComplete]);

  const selectedRow = selectedRowIndex !== null
    ? results.find((r) => r.rowIndex === selectedRowIndex)
    : null;

  return (
    <>
      {qualityMetrics && <QualitySummaryBanner metrics={qualityMetrics} />}

      <div className="overflow-x-auto rounded-2xl border border-[rgba(165,180,220,0.08)] mt-4 bg-[rgba(11,16,34,0.3)]">
        <table className="w-full text-sm">
          <thead className="bg-[rgba(11,16,34,0.7)] sticky top-0 z-10">
            <tr>
              <th className="w-8 px-3 py-3.5" />
              {originalHeaders.map((header) => (
                <th
                  key={`orig-${header}`}
                  className="text-[rgba(240,242,248,0.35)] text-[11px] tracking-wider font-semibold px-4 py-3.5 text-left uppercase"
                >
                  {header}
                </th>
              ))}
              {enrichmentFieldNames.map((field) => (
                <th
                  key={`enrich-${field}`}
                  className="text-[#4B8BFF]/60 text-[11px] tracking-wider font-semibold px-4 py-3.5 text-left uppercase"
                >
                  {field.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr
                key={row.rowIndex}
                onClick={() => setSelectedRowIndex(row.rowIndex)}
                className="border-t border-[rgba(165,180,220,0.04)] cursor-pointer hover:bg-[rgba(75,139,255,0.02)] transition-colors duration-150"
              >
                <td className="px-3 py-3 text-center">
                  <StatusDot status={row.status} />
                </td>

                {originalHeaders.map((header) => (
                  <td
                    key={`orig-${row.rowIndex}-${header}`}
                    className="px-4 py-3 text-[rgba(240,242,248,0.6)] font-mono text-xs max-w-[200px] truncate"
                  >
                    {row.originalData[header] ?? ""}
                  </td>
                ))}

                {enrichmentFieldNames.map((field) => {
                  const enrichment = row.enrichments[field];

                  if (row.status === "error" && field === enrichmentFieldNames[0]) {
                    return (
                      <td
                        key={`enrich-${row.rowIndex}-${field}`}
                        className="px-4 py-3 text-[#F87171]/60 text-xs italic"
                        colSpan={enrichmentFieldNames.length}
                      >
                        {row.error || "Unknown error"}
                      </td>
                    );
                  }

                  if (row.status === "error" && field !== enrichmentFieldNames[0]) {
                    return null;
                  }

                  if (!enrichment || enrichment.value === null || enrichment.value === undefined) {
                    return (
                      <td
                        key={`enrich-${row.rowIndex}-${field}`}
                        className="px-4 py-3 text-[rgba(240,242,248,0.15)] text-xs"
                      >
                        —
                      </td>
                    );
                  }

                  const displayValue = formatCellValue(enrichment);
                  const sourceCount = enrichment.sourceContext?.length ?? 0;

                  return (
                    <td
                      key={`enrich-${row.rowIndex}-${field}`}
                      className={`px-4 py-3 text-xs ${confidenceBorderClass(enrichment.confidence)}`}
                    >
                      <SourceTooltip
                        value={enrichment.value}
                        confidence={enrichment.confidence}
                        sourceContext={enrichment.sourceContext}
                        scrapedAt={enrichment.scrapedAt}
                      >
                        <span className={enrichment.confidence < 0.5 ? "text-[rgba(240,242,248,0.35)]" : "text-[rgba(240,242,248,0.8)]"}>
                          {displayValue.length > 60 ? displayValue.slice(0, 60) + "..." : displayValue}
                          <SourceCountBadge count={sourceCount} />
                        </span>
                      </SourceTooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <DetailModal
          open={selectedRowIndex !== null}
          onClose={() => setSelectedRowIndex(null)}
          originalData={selectedRow.originalData}
          enrichments={selectedRow.enrichments}
        />
      )}
    </>
  );
}
