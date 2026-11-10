"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { QualityMetrics } from "@/lib/quality-metrics";

interface QualitySummaryBannerProps {
  metrics: QualityMetrics;
}

function confidenceColor(percent: number): string {
  if (percent > 75) return "text-[#34D399]";
  if (percent >= 50) return "text-[#FBBF24]";
  return "text-[#F87171]";
}

function topSources(
  breakdown: Record<string, number>,
  limit: number
): Array<{ name: string; count: number }> {
  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export function QualitySummaryBanner({ metrics }: QualitySummaryBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const top3 = topSources(metrics.sourceBreakdown, 3);

  const allSources = Object.entries(metrics.sourceBreakdown).sort(
    (a, b) => b[1] - a[1]
  );
  const totalSourceHits = allSources.reduce((sum, [, c]) => sum + c, 0);
  const visibleSources = allSources.slice(0, 8);
  const remainingSources = allSources.length - visibleSources.length;

  const maxBarCount = Math.max(
    metrics.highConfidenceCount,
    metrics.mediumConfidenceCount,
    metrics.lowConfidenceCount,
    1
  );

  return (
    <div className="bg-[rgba(11,16,34,0.45)] border border-[rgba(165,180,220,0.08)] rounded-2xl overflow-hidden">
      {/* Main bar */}
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        {/* Left side */}
        <div className="flex items-center flex-wrap gap-4">
          {/* Confidence */}
          <span
            className={`text-sm font-semibold ${confidenceColor(metrics.highConfidencePercent)}`}
          >
            {metrics.highConfidencePercent}% high confidence
          </span>

          {/* Source pills */}
          {top3.length > 0 && (
            <div className="flex items-center gap-1.5">
              {top3.map((source) => (
                <span
                  key={source.name}
                  className="px-2 py-0.5 bg-[rgba(165,180,220,0.06)] rounded-md text-[11px] text-[rgba(240,242,248,0.55)] font-medium tabular-nums"
                >
                  {source.name}: {source.count}
                </span>
              ))}
            </div>
          )}

          {/* Conflicts */}
          {metrics.conflictingFields > 0 && (
            <span className="text-sm text-[#FBBF24] font-medium">
              {metrics.conflictingFields} conflict
              {metrics.conflictingFields !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Right side */}
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-[11px] text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] transition-colors font-medium"
        >
          Details
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Expandable detail panel */}
      {expanded && (
        <div className="px-5 py-5 border-t border-[rgba(165,180,220,0.06)] space-y-5">
          {/* Section 1: Source Breakdown Table */}
          <div>
            <h4 className="text-[11px] font-semibold text-[rgba(240,242,248,0.4)] mb-2.5 uppercase tracking-wider">
              Source breakdown
            </h4>
            <table className="text-xs w-full">
              <thead>
                <tr className="text-left text-[rgba(240,242,248,0.3)]">
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium w-16 text-right">
                    Fields
                  </th>
                  <th className="pb-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {visibleSources.map(([name, count]) => {
                  const share =
                    totalSourceHits > 0
                      ? Math.round((count / totalSourceHits) * 100)
                      : 0;
                  return (
                    <tr key={name} className="text-[rgba(240,242,248,0.6)]">
                      <td className="py-1 pr-4">{name}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        {count}
                      </td>
                      <td className="py-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-[rgba(165,180,220,0.06)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[rgba(165,180,220,0.2)]"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <span className="text-[rgba(240,242,248,0.3)] w-8 text-right tabular-nums">
                            {share}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {remainingSources > 0 && (
              <p className="text-[11px] text-[rgba(240,242,248,0.2)] mt-2">
                and {remainingSources} more
              </p>
            )}
          </div>

          {/* Section 2: Confidence Distribution */}
          <div>
            <h4 className="text-[11px] font-semibold text-[rgba(240,242,248,0.4)] mb-2.5 uppercase tracking-wider">
              Confidence distribution
            </h4>
            <div className="space-y-2">
              {/* High */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#34D399] w-14 font-medium">High</span>
                <span className="text-xs text-[rgba(240,242,248,0.35)] w-8 text-right tabular-nums">
                  {metrics.highConfidenceCount}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[rgba(165,180,220,0.06)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#34D399] transition-all duration-500"
                    style={{
                      width: `${(metrics.highConfidenceCount / maxBarCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
              {/* Medium */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#FBBF24] w-14 font-medium">Medium</span>
                <span className="text-xs text-[rgba(240,242,248,0.35)] w-8 text-right tabular-nums">
                  {metrics.mediumConfidenceCount}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[rgba(165,180,220,0.06)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FBBF24] transition-all duration-500"
                    style={{
                      width: `${(metrics.mediumConfidenceCount / maxBarCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
              {/* Low */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#F87171] w-14 font-medium">Low</span>
                <span className="text-xs text-[rgba(240,242,248,0.35)] w-8 text-right tabular-nums">
                  {metrics.lowConfidenceCount}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[rgba(165,180,220,0.06)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F87171] transition-all duration-500"
                    style={{
                      width: `${(metrics.lowConfidenceCount / maxBarCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Summary stats */}
          <div className="flex items-center flex-wrap gap-4">
            <span className="text-[11px] text-[rgba(240,242,248,0.3)] tabular-nums">
              Total fields: {metrics.totalFields}
            </span>
            <span className="text-[11px] text-[rgba(240,242,248,0.3)] tabular-nums">
              Enriched: {metrics.enrichedFields}
            </span>
            <span className="text-[11px] text-[rgba(240,242,248,0.3)] tabular-nums">
              Avg confidence: {Math.round(metrics.averageConfidence * 100)}%
            </span>
            <span className="text-[11px] text-[rgba(240,242,248,0.3)] tabular-nums">
              Conflicts: {metrics.conflictingFields}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
