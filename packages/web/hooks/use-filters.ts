"use client";

import { useState, useCallback } from "react";
import { type FilterState, DEFAULT_FILTERS } from "@/lib/filter-utils";

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const setFilter = useCallback(
    (key: keyof FilterState, value: string | null) => {
      setFilters((prev) => {
        // For status/confidence: if clicking the already-active value, reset to "all"
        if (
          (key === "status" || key === "confidence") &&
          prev[key] === value
        ) {
          return { ...prev, [key]: "all" };
        }
        return { ...prev, [key]: value };
      });
    },
    []
  );

  const clearAll = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.confidence !== "all" ||
    filters.search !== "" ||
    filters.segment !== null;

  return { filters, setFilter, clearAll, hasActiveFilters };
}
