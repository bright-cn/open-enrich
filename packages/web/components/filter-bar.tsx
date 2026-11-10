"use client";

import { Search, X } from "lucide-react";
import type { FilterState, FilterCounts } from "@/lib/filter-utils";

interface FilterBarProps {
  filters: FilterState;
  counts: FilterCounts;
  totalShowing: number;
  totalRows: number;
  onFilterChange: (key: keyof FilterState, value: string | null) => void;
  onClearAll: () => void;
}

function Pill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5 active:scale-95 ${
        active
          ? "bg-[rgba(75,139,255,0.1)] text-[#4B8BFF] border border-[rgba(75,139,255,0.15)]"
          : "text-[rgba(240,242,248,0.4)] hover:text-[rgba(240,242,248,0.65)] border border-transparent"
      }`}
    >
      {label}
      <span className={`text-[10px] rounded-md px-1.5 py-0.5 min-w-[20px] text-center tabular-nums ${
        active
          ? "bg-[rgba(75,139,255,0.15)] text-[#4B8BFF]"
          : "bg-[rgba(165,180,220,0.06)] text-[rgba(240,242,248,0.3)]"
      }`}>
        {count}
      </span>
    </button>
  );
}

export function FilterBar({
  filters,
  counts,
  totalShowing,
  totalRows,
  onFilterChange,
  onClearAll,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.status !== "all" ||
    filters.confidence !== "all" ||
    filters.search !== "" ||
    filters.segment !== null;

  return (
    <div className="space-y-0">
      <div className="bg-[rgba(11,16,34,0.4)] border border-[rgba(165,180,220,0.08)] rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {/* Status pills */}
        <Pill
          label="All"
          count={counts.all}
          active={filters.status === "all"}
          onClick={() => onFilterChange("status", "all")}
        />
        <Pill
          label="Enriched"
          count={counts.enriched}
          active={filters.status === "enriched"}
          onClick={() => onFilterChange("status", "enriched")}
        />
        <Pill
          label="Skipped"
          count={counts.skipped}
          active={filters.status === "skipped"}
          onClick={() => onFilterChange("status", "skipped")}
        />
        <Pill
          label="Errors"
          count={counts.errors}
          active={filters.status === "errors"}
          onClick={() => onFilterChange("status", "errors")}
        />

        {/* Divider */}
        <div className="w-px h-4 bg-[rgba(165,180,220,0.08)] mx-1" />

        {/* Confidence pills */}
        <Pill
          label="High confidence"
          count={counts.highConfidence}
          active={filters.confidence === "high"}
          onClick={() => onFilterChange("confidence", "high")}
        />
        <Pill
          label="Needs review"
          count={counts.needsReview}
          active={filters.confidence === "needs_review"}
          onClick={() => onFilterChange("confidence", "needs_review")}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(240,242,248,0.25)]"
          />
          <input
            type="text"
            placeholder="Search rows..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onFilterChange("search", "");
            }}
            className="bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.08)] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[#f0f2f8] placeholder:text-[rgba(240,242,248,0.25)] w-48 focus:border-[rgba(75,139,255,0.3)] focus:shadow-[0_0_0_3px_rgba(75,139,255,0.06)] outline-none transition-all duration-200"
          />
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-xs text-[rgba(240,242,248,0.3)] hover:text-[#f0f2f8] cursor-pointer inline-flex items-center gap-1 transition-all duration-200"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Showing count */}
      {hasActiveFilters && (
        <p className="text-[11px] text-[rgba(240,242,248,0.3)] mt-2 tabular-nums">
          Showing {totalShowing} of {totalRows} rows
        </p>
      )}
    </div>
  );
}
