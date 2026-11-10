"use client";

import React from "react";
import { formatRelativeTime } from "@/lib/format-time";

interface SourceTooltipProps {
  children: React.ReactNode;
  value: string | number | boolean | string[] | null;
  confidence: number;
  sourceContext?: Array<{ url: string; snippet: string; confidence: number }>;
  scrapedAt?: string;
}

function getConfidenceBadgeClasses(confidence: number): string {
  if (confidence > 0.8) return "bg-[#34D399]/10 text-[#34D399] border-[#34D399]/15";
  if (confidence >= 0.5) return "bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/15";
  return "bg-[#F87171]/10 text-[#F87171] border-[#F87171]/15";
}

function formatDisplayValue(value: string | number | boolean | string[] | null): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function getFreshnessDot(scrapedAt: string): { dot: string; label: string | null } {
  const ms = Date.now() - new Date(scrapedAt).getTime();
  const hours = ms / (1000 * 60 * 60);
  const days = hours / 24;

  if (days >= 7) {
    return { dot: "bg-[#F87171]", label: "may be stale" };
  }
  if (hours >= 24) {
    return { dot: "bg-[#FBBF24]", label: null };
  }
  return { dot: "", label: null };
}

function getAgreementIndicator(
  sourceContext: Array<{ url: string; snippet: string; confidence: number }>
): { text: string; className: string } | null {
  if (sourceContext.length <= 1) return null;

  const confidences = sourceContext.map((s) => s.confidence);
  const allAboveHalf = confidences.every((c) => c > 0.5);
  const maxDivergence = Math.max(...confidences) - Math.min(...confidences);

  if (maxDivergence > 0.3) {
    return { text: "Sources may conflict", className: "text-[#FBBF24]" };
  }
  if (allAboveHalf) {
    return { text: "Sources agree", className: "text-[#34D399]" };
  }
  return null;
}

export function SourceTooltip({
  children,
  value,
  confidence,
  sourceContext,
  scrapedAt,
}: SourceTooltipProps) {
  const hasSources = sourceContext && sourceContext.length > 0;
  const agreement = hasSources ? getAgreementIndicator(sourceContext) : null;

  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute z-50 bottom-full left-0 mb-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
        <div className="bg-[#0b1022]/97 border border-[rgba(165,180,220,0.12)] rounded-xl p-3.5 shadow-[0_16px_48px_rgba(6,9,26,0.9)] backdrop-blur-2xl">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#f0f2f8] truncate">
              {formatDisplayValue(value)}
            </span>
            <span
              className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md border tabular-nums ${getConfidenceBadgeClasses(confidence)}`}
            >
              {Math.round(confidence * 100)}%
            </span>
          </div>

          {/* Freshness line */}
          {scrapedAt && (
            <div className="flex items-center gap-1.5 mt-2">
              {getFreshnessDot(scrapedAt).dot && (
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${getFreshnessDot(scrapedAt).dot}`}
                />
              )}
              <span className="text-[11px] text-[rgba(240,242,248,0.3)]">
                Scraped {formatRelativeTime(scrapedAt)}
                {getFreshnessDot(scrapedAt).label && (
                  <span className="ml-1">
                    — {getFreshnessDot(scrapedAt).label}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Sources list */}
          {hasSources ? (
            <div className="mt-2.5 space-y-2">
              {sourceContext.map((source, index) => {
                let domain: string;
                try {
                  domain = new URL(source.url).hostname;
                } catch {
                  domain = source.url;
                }

                return (
                  <div key={index}>
                    <div className="flex items-center gap-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#4B8BFF] text-xs hover:underline"
                      >
                        {domain}
                      </a>
                      <span className="text-[11px] text-[rgba(240,242,248,0.3)] tabular-nums">
                        {Math.round(source.confidence * 100)}%
                      </span>
                    </div>
                    <blockquote className="text-[11px] text-[rgba(240,242,248,0.35)] border-l-2 border-[rgba(165,180,220,0.1)] pl-2 mt-1 line-clamp-2">
                      {source.snippet}
                    </blockquote>
                  </div>
                );
              })}

              {/* Agreement indicator */}
              {agreement && (
                <p className={`text-[11px] mt-1 font-medium ${agreement.className}`}>
                  {agreement.text}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-[rgba(240,242,248,0.25)] mt-2">
              No source data available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
