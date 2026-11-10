"use client";

import { useState } from "react";
import { X, Download, Copy, BarChart3, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  generateMarkdownReport,
  type EnrichmentReport,
} from "@/lib/report-generator";

interface EnrichmentReportProps {
  report: EnrichmentReport;
  onClose: () => void;
  open: boolean;
}

function confidenceBarColor(avgConfidence: number): string {
  if (avgConfidence > 0.8) return "bg-[#34D399]";
  if (avgConfidence >= 0.5) return "bg-[#FBBF24]";
  return "bg-[#F87171]";
}

export function EnrichmentReportPanel({
  report,
  onClose,
  open,
}: EnrichmentReportProps) {
  const [copied, setCopied] = useState(false);

  const { summary, fieldCoverage, sourceAttribution, qualityFlags } = report;

  function handleDownload() {
    const md = generateMarkdownReport(report);
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enrichment_report_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    const md = generateMarkdownReport(report);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#0a1628]/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel — slides in from right */}
          <motion.div
            initial={{ x: "100%", opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.8 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col bg-[#0b1022]/98 border-l border-[rgba(165,180,220,0.08)] h-full backdrop-blur-2xl shadow-[-20px_0_60px_rgba(6,9,26,0.8)]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[rgba(165,180,220,0.06)] flex items-center justify-between sticky top-0 bg-[#0b1022]/98 z-10">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-4 w-4 text-[rgba(240,242,248,0.35)]" />
                <span className="text-base font-bold text-[#f0f2f8] tracking-tight">
                  Enrichment report
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[rgba(165,180,220,0.06)] text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-8 overflow-y-auto flex-1">
              {/* Section 1: Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: summary.totalRows, label: "Total rows" },
                  { value: summary.enrichedCount, label: `Enriched (${summary.enrichmentRate}%)` },
                  { value: summary.skippedCount, label: "Skipped" },
                  { value: summary.errorCount, label: "Errors" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)] rounded-xl p-3.5">
                    <div className="text-xl font-bold text-[#f0f2f8] tabular-nums">
                      {stat.value}
                    </div>
                    <div className="text-[11px] text-[rgba(240,242,248,0.35)] mt-0.5 font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Section 2: Field Coverage */}
              <div>
                <h3 className="text-sm font-bold text-[#f0f2f8] mb-4 tracking-tight">
                  Field coverage
                </h3>
                <div className="space-y-3">
                  {fieldCoverage.map((fc) => (
                    <div key={fc.field}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-[rgba(240,242,248,0.65)]">{fc.field}</span>
                        <span className="text-[11px] text-[rgba(240,242,248,0.35)] font-mono tabular-nums">
                          {fc.populatedPercent}% / {Math.round(fc.avgConfidence * 100)}%
                          conf
                        </span>
                      </div>
                      <div className="h-1 bg-[rgba(165,180,220,0.06)] rounded-full overflow-hidden w-full">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${confidenceBarColor(fc.avgConfidence)}`}
                          style={{ width: `${fc.populatedPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Source Attribution */}
              <div>
                <h3 className="text-sm font-bold text-[#f0f2f8] mb-4 tracking-tight">
                  Source attribution
                </h3>
                <div className="space-y-0.5">
                  {sourceAttribution.map((sa) => (
                    <div
                      key={sa.source}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm text-[rgba(240,242,248,0.65)]">{sa.source}</span>
                      <span className="text-[11px] text-[rgba(240,242,248,0.35)] font-mono tabular-nums">
                        {sa.fieldCount} fields, {sa.rowCount} rows
                      </span>
                    </div>
                  ))}
                  {sourceAttribution.length === 0 && (
                    <p className="text-xs text-[rgba(240,242,248,0.3)]">
                      No source attribution data available.
                    </p>
                  )}
                </div>
              </div>

              {/* Section 4: Quality Flags */}
              {qualityFlags.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-[#FBBF24] mb-3 tracking-tight">
                    Quality flags
                  </h3>
                  <p className="text-[11px] text-[rgba(240,242,248,0.35)] mb-2">
                    {qualityFlags.length} issues found.
                  </p>
                  <div className="space-y-1">
                    {qualityFlags.slice(0, 20).map((flag, i) => (
                      <p key={i} className="text-xs text-[rgba(240,242,248,0.4)]">
                        Row {flag.rowIndex}: {flag.field} — {flag.issue}
                      </p>
                    ))}
                    {qualityFlags.length > 20 && (
                      <p className="text-[11px] text-[rgba(240,242,248,0.25)] mt-1">
                        ...and {qualityFlags.length - 20} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Section 5: Cost Analysis */}
              {report.costAnalysis && (
                <section>
                  <h3 className="text-sm font-semibold text-[#f0f2f8] mb-3 tracking-tight">
                    Cost analysis
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)]">
                      <p className="text-[10px] uppercase tracking-wider text-[rgba(240,242,248,0.4)]">LLM cost</p>
                      <p className="text-lg font-mono font-bold text-[#34D399]">
                        ${report.costAnalysis.totalCost.llmCost.toFixed(4)}
                      </p>
                      <p className="text-[10px] text-[rgba(240,242,248,0.3)] font-mono">
                        {report.costAnalysis.totalCost.llmTokensIn.toLocaleString()} in / {report.costAnalysis.totalCost.llmTokensOut.toLocaleString()} out
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)]">
                      <p className="text-[10px] uppercase tracking-wider text-[rgba(240,242,248,0.4)]">Bright Data tools</p>
                      <p className="text-lg font-mono font-bold text-[#34D399]">
                        ${report.costAnalysis.totalCost.toolCost.toFixed(4)}
                      </p>
                      <p className="text-[10px] text-[rgba(240,242,248,0.3)] font-mono">
                        {report.costAnalysis.totalCost.toolCalls} API calls
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[rgba(165,180,220,0.06)] overflow-hidden mb-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[rgba(11,16,34,0.5)]">
                          <th className="text-left px-3 py-2 text-[rgba(240,242,248,0.4)] font-medium">Component</th>
                          <th className="text-right px-3 py-2 text-[#34D399] font-medium">Open Enrich</th>
                          <th className="text-right px-3 py-2 text-[rgba(240,242,248,0.35)] font-medium">Clay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(165,180,220,0.06)]">
                        <tr>
                          <td className="px-3 py-2 text-[rgba(240,242,248,0.6)]">Data enrichment</td>
                          <td className="px-3 py-2 text-right font-mono text-[#34D399]">${report.costAnalysis.totalCost.totalCost.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right font-mono text-[rgba(240,242,248,0.35)]">${report.costAnalysis.clayCost.totalDataCost.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 text-[rgba(240,242,248,0.6)]">Platform subscription</td>
                          <td className="px-3 py-2 text-right font-mono text-[#34D399]">$0.00</td>
                          <td className="px-3 py-2 text-right font-mono text-[rgba(240,242,248,0.35)]">${report.costAnalysis.clayCost.monthlyPlatformCost}/mo</td>
                        </tr>
                        <tr className="bg-[rgba(11,16,34,0.3)]">
                          <td className="px-3 py-2 text-[#f0f2f8] font-semibold">Per row average</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[#34D399]">${report.costAnalysis.perRowCost.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[rgba(240,242,248,0.35)]">${report.costAnalysis.clayCost.perRowAverage.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 rounded-xl bg-[rgba(52,211,153,0.06)] border border-[rgba(52,211,153,0.15)]">
                    <p className="text-sm text-[#34D399] font-semibold">
                      {report.costAnalysis.savings}% cost reduction vs Clay
                    </p>
                    <p className="text-[11px] text-[rgba(240,242,248,0.35)] mt-1">
                      Clay Growth plan requires ${report.costAnalysis.clayCost.monthlyPlatformCost}/mo subscription. Open Enrich is free and open source.
                    </p>
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[rgba(165,180,220,0.06)] flex items-center gap-3 sticky bottom-0 bg-[#0b1022]/98">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-[rgba(165,180,220,0.1)] bg-[rgba(11,16,34,0.5)] text-[rgba(240,242,248,0.65)] hover:bg-[rgba(11,16,34,0.8)] hover:text-[#f0f2f8] hover:border-[rgba(165,180,220,0.15)] transition-all duration-200 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-[rgba(240,242,248,0.45)] hover:bg-[rgba(165,180,220,0.06)] hover:text-[#f0f2f8] transition-all duration-200 active:scale-[0.98]"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-[#34D399]" />
                    <span className="text-[#34D399]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy to clipboard
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
