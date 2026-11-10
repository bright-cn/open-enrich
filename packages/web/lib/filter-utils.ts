export interface FilterState {
  status: "all" | "enriched" | "skipped" | "errors";
  confidence: "all" | "high" | "needs_review";
  search: string;
  segment: string | null;
}

export interface FilterCounts {
  all: number;
  enriched: number;
  skipped: number;
  errors: number;
  highConfidence: number;
  needsReview: number;
}

export const DEFAULT_FILTERS: FilterState = {
  status: "all",
  confidence: "all",
  search: "",
  segment: null,
};

function getAvgConfidence(
  enrichments: Record<string, { value: unknown; confidence: number }>
): number {
  const entries = Object.values(enrichments);
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, e) => acc + e.confidence, 0);
  return sum / entries.length;
}

function hasLowConfidenceField(
  enrichments: Record<string, { value: unknown; confidence: number }>
): boolean {
  return Object.values(enrichments).some((e) => e.confidence < 0.5);
}

function matchesSearch(
  row: {
    enrichments: Record<string, { value: unknown; confidence: number }>;
    originalData: Record<string, string>;
  },
  search: string
): boolean {
  if (!search) return true;
  const lowerSearch = search.toLowerCase();

  const originalValues = Object.values(row.originalData).join(" ");
  const enrichmentValues = Object.values(row.enrichments)
    .map((e) => String(e.value ?? ""))
    .join(" ");
  const combined = `${originalValues} ${enrichmentValues}`.toLowerCase();

  return combined.includes(lowerSearch);
}

export function applyFilters<
  T extends {
    status: string;
    enrichments: Record<string, { value: unknown; confidence: number }>;
    originalData: Record<string, string>;
    rowIndex: number;
  }
>(
  rows: T[],
  filters: FilterState,
  segmentSets?: Record<string, Set<number>>
): { filtered: T[]; counts: FilterCounts } {
  // Compute counts BEFORE filtering so pill badges show how many would match
  const counts: FilterCounts = {
    all: rows.length,
    enriched: 0,
    skipped: 0,
    errors: 0,
    highConfidence: 0,
    needsReview: 0,
  };

  for (const row of rows) {
    if (row.status === "completed") counts.enriched++;
    if (row.status === "skipped") counts.skipped++;
    if (row.status === "error") counts.errors++;
    if (getAvgConfidence(row.enrichments) > 0.8) counts.highConfidence++;
    if (hasLowConfidenceField(row.enrichments)) counts.needsReview++;
  }

  // Apply all filters with AND logic
  const filtered = rows.filter((row) => {
    // Status filter
    if (filters.status === "enriched" && row.status !== "completed") return false;
    if (filters.status === "skipped" && row.status !== "skipped") return false;
    if (filters.status === "errors" && row.status !== "error") return false;

    // Confidence filter
    if (filters.confidence === "high" && getAvgConfidence(row.enrichments) <= 0.8)
      return false;
    if (filters.confidence === "needs_review" && !hasLowConfidenceField(row.enrichments))
      return false;

    // Search filter
    if (!matchesSearch(row, filters.search)) return false;

    // Segment filter
    if (filters.segment !== null && segmentSets) {
      const segmentSet = segmentSets[filters.segment];
      if (segmentSet && !segmentSet.has(row.rowIndex)) return false;
    }

    return true;
  });

  return { filtered, counts };
}
