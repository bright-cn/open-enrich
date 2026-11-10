"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatRelativeTime } from "@/lib/format-time";

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  originalData: Record<string, string>;
  enrichments: Record<
    string,
    {
      field: string;
      value: string | number | boolean | string[] | null;
      confidence: number;
      source?: string;
      sourceContext?: Array<{
        url: string;
        snippet: string;
        confidence: number;
      }>;
      scrapedAt?: string;
    }
  >;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence > 0.8)
    return {
      pill: "bg-[#34D399]/10 text-[#34D399] border-[#34D399]/20",
      bar: "bg-[#34D399]",
    };
  if (confidence >= 0.5)
    return { pill: "bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20", bar: "bg-[#FBBF24]" };
  return { pill: "bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20", bar: "bg-[#F87171]" };
}

function formatValue(
  value: string | number | boolean | string[] | null
): string | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default function DetailModal({
  open,
  onClose,
  originalData,
  enrichments,
}: DetailModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-8 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#0a1628]/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Content panel */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 bg-[#0b1022]/97 border border-[rgba(165,180,220,0.1)] rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-y-auto shadow-[0_24px_80px_rgba(6,9,26,0.9)] backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[rgba(165,180,220,0.06)] flex items-center justify-between sticky top-0 bg-[#0b1022]/97 backdrop-blur-xl z-10 rounded-t-2xl">
              <h2 className="text-lg font-bold text-[#f0f2f8] tracking-tight">Row details</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 p-6">
              {/* Left column -- Original Data */}
              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.3)] font-semibold mb-4">
                  Original CSV data
                </h3>
                <div className="space-y-3">
                  {Object.entries(originalData).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-[11px] text-[rgba(240,242,248,0.3)] font-medium">{key}</div>
                      <div className="text-sm text-[rgba(240,242,248,0.7)] font-mono mt-0.5">
                        {value || "\u2014"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column -- Enriched Fields */}
              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.3)] font-semibold mb-4">
                  Enriched fields
                </h3>
                <div className="space-y-3">
                  {Object.entries(enrichments).map(([key, enrichment]) => {
                    const colors = getConfidenceColor(enrichment.confidence);
                    const displayValue = formatValue(enrichment.value);
                    const sources = enrichment.sourceContext ?? [];
                    const hasCorroboration =
                      sources.length >= 2 &&
                      sources.every((s) => s.confidence > 0.5);
                    const hasConflict =
                      sources.length >= 2 && !hasCorroboration;

                    return (
                      <div
                        key={key}
                        className="bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)] rounded-xl p-4 space-y-3 hover:border-[rgba(165,180,220,0.1)] transition-colors duration-200"
                      >
                        {/* Row 1: Field name + confidence pill */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.35)] font-medium">
                            {enrichment.field}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border tabular-nums ${colors.pill}`}
                          >
                            {Math.round(enrichment.confidence * 100)}%
                          </span>
                        </div>

                        {/* Row 2: Value */}
                        {displayValue !== null ? (
                          <div className="text-[15px] text-[#f0f2f8] font-medium leading-snug">
                            {displayValue}
                          </div>
                        ) : (
                          <div className="text-[15px] text-[rgba(240,242,248,0.2)] italic">
                            Not found
                          </div>
                        )}

                        {/* Row 3: Confidence bar */}
                        <div className="h-1 rounded-full bg-[rgba(165,180,220,0.06)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                            style={{
                              width: `${enrichment.confidence * 100}%`,
                            }}
                          />
                        </div>

                        {/* Row 4: Sources */}
                        {sources.length > 0 && (
                          <div className="space-y-2">
                            {sources.map((source, idx) => {
                              const domain = getDomain(source.url);
                              return (
                                <div key={idx} className="flex items-start gap-2">
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                                    alt=""
                                    className="w-4 h-4 mt-0.5 rounded-sm"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#4B8BFF] text-xs hover:underline"
                                    >
                                      {domain}
                                    </a>
                                    {source.snippet && (
                                      <p className="text-xs text-[rgba(240,242,248,0.35)] line-clamp-2 mt-0.5">
                                        {source.snippet}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Row 5: Freshness */}
                        {enrichment.scrapedAt && enrichment.source && (
                          <p className="text-[11px] text-[rgba(240,242,248,0.2)]">
                            Data from {getDomain(enrichment.source)}, scraped{" "}
                            {formatRelativeTime(enrichment.scrapedAt)}
                          </p>
                        )}

                        {/* Corroboration badge */}
                        {hasCorroboration && (
                          <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#34D399]/8 text-[#34D399] border border-[#34D399]/15">
                            Corroborated
                          </span>
                        )}
                        {hasConflict && (
                          <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FBBF24]/8 text-[#FBBF24] border border-[#FBBF24]/15">
                            Conflicting
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
