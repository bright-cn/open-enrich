"use client";

import { CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";

interface OutboundSummaryCardsProps {
  counts: {
    fullyEnriched: number;
    hasBuyingSignal: number;
    needsReview: number;
    total: number;
  };
  activeSegment: string | null;
  onSegmentClick: (segment: string | null) => void;
}

const CARDS = [
  {
    key: "fully_enriched",
    label: "Fully enriched",
    countKey: "fullyEnriched" as const,
    icon: CheckCircle2,
    accentColor: "#34D399",
    glowColor: "rgba(52, 211, 153, 0.08)",
    borderActive: "border-[#34D399]/30",
    iconBg: "bg-[#34D399]/8",
  },
  {
    key: "buying_signal",
    label: "Has buying signal",
    countKey: "hasBuyingSignal" as const,
    icon: TrendingUp,
    accentColor: "#FBBF24",
    glowColor: "rgba(251, 191, 36, 0.06)",
    borderActive: "border-[#FBBF24]/30",
    iconBg: "bg-[#FBBF24]/8",
  },
  {
    key: "needs_review",
    label: "Needs review",
    countKey: "needsReview" as const,
    icon: AlertTriangle,
    accentColor: "#F87171",
    glowColor: "rgba(248, 113, 113, 0.06)",
    borderActive: "border-[#F87171]/30",
    iconBg: "bg-[#F87171]/8",
  },
] as const;

export function OutboundSummaryCards({
  counts,
  activeSegment,
  onSegmentClick,
}: OutboundSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {CARDS.map((card) => {
        const isActive = activeSegment === card.key;
        const Icon = card.icon;
        const count = counts[card.countKey];
        const percent = counts.total > 0 ? Math.round((count / counts.total) * 100) : 0;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSegmentClick(isActive ? null : card.key)}
            className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 text-left overflow-hidden border ${
              isActive
                ? `bg-[rgba(11,16,34,0.8)] ${card.borderActive} shadow-lg`
                : "bg-[rgba(11,16,34,0.45)] border-[rgba(165,180,220,0.08)] hover:border-[rgba(165,180,220,0.15)] hover:bg-[rgba(11,16,34,0.6)]"
            }`}
            style={isActive ? { boxShadow: `0 8px 32px ${card.glowColor}` } : undefined}
          >
            {/* Subtle top accent line */}
            <div
              className={`absolute top-0 left-4 right-4 h-px transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}
              style={{ background: `linear-gradient(90deg, transparent, ${card.accentColor}40, transparent)` }}
            />

            <div className="flex items-start justify-between">
              <div>
                <div
                  className="text-3xl font-bold tracking-tight tabular-nums"
                  style={{ color: isActive ? card.accentColor : "#f0f2f8" }}
                >
                  {count}
                </div>
                <div className="text-[rgba(240,242,248,0.4)] text-xs mt-1.5 font-medium">
                  {card.label}
                </div>
              </div>
              <div
                className={`p-2 rounded-xl transition-colors duration-300 ${
                  isActive ? card.iconBg : "bg-[rgba(165,180,220,0.04)]"
                }`}
              >
                <Icon
                  size={18}
                  style={{ color: isActive ? card.accentColor : "rgba(240,242,248,0.3)" }}
                  className="transition-colors duration-300"
                />
              </div>
            </div>

            {/* Mini progress bar */}
            <div className="mt-4 flex items-center gap-2.5">
              <div className="flex-1 h-1 rounded-full bg-[rgba(165,180,220,0.06)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: isActive ? card.accentColor : "rgba(165,180,220,0.15)",
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-[rgba(240,242,248,0.3)] tabular-nums w-8 text-right">
                {percent}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
