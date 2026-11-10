"use client";

import { useMemo } from "react";
import type { RowCost, RowEnrichmentResult } from "@brightdata/enrich-core";
import { calculateClayCost } from "@/lib/clay-pricing";

interface CostTickerProps {
  totalCost: RowCost;
  results: RowEnrichmentResult[];
  isRunning: boolean;
}

export default function CostTicker({ totalCost, results, isRunning }: CostTickerProps) {
  const clayCost = useMemo(() => {
    let total = 0;
    for (const result of results) {
      if (result.status !== "completed") continue;
      const enrichedFields = Object.entries(result.enrichments)
        .filter(([, v]) => v.value != null && v.confidence > 0)
        .map(([k]) => k);
      total += calculateClayCost(enrichedFields).totalDataCost;
    }
    return total;
  }, [results]);

  const savings = clayCost > 0
    ? Math.max(0, Math.round((1 - totalCost.totalCost / clayCost) * 100))
    : 0;

  const formatCost = (n: number) =>
    n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;

  return (
    <div className="rounded-xl border border-[rgba(165,180,220,0.08)] bg-[rgba(11,16,34,0.5)] backdrop-blur-sm mb-4 overflow-hidden">
      {/* Two costs stacked */}
      <div className="grid grid-cols-2 divide-x divide-[rgba(165,180,220,0.06)]">
        <div className="px-4 py-4">
          <p className="text-[10px] uppercase tracking-widest text-[rgba(240,242,248,0.35)] mb-1.5">
            Your cost
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono font-bold text-[#34D399] tabular-nums">
              {formatCost(totalCost.totalCost)}
            </span>
            {isRunning && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
            )}
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="text-[10px] uppercase tracking-widest text-[rgba(240,242,248,0.35)] mb-1.5">
            Alternative
          </p>
          <span className="text-xl font-mono font-bold text-[rgba(240,242,248,0.25)] tabular-nums">
            {formatCost(clayCost)}
          </span>
        </div>
      </div>

      {/* Savings bar */}
      {savings > 0 && (
        <div className="px-4 py-2.5 border-t border-[rgba(165,180,220,0.06)] bg-[rgba(52,211,153,0.04)] flex items-center justify-between">
          <div className="flex-1 h-1.5 rounded-full bg-[rgba(240,242,248,0.04)] overflow-hidden mr-3">
            <div
              className="h-full rounded-full bg-[#34D399]/60 transition-all duration-500"
              style={{ width: `${Math.max(2, 100 - savings)}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#34D399] font-mono tabular-nums shrink-0">
            {savings}% less
          </span>
        </div>
      )}
    </div>
  );
}
