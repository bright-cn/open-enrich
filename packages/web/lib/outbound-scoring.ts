export interface OutboundClassification {
  fullyEnriched: Set<number>;
  hasBuyingSignal: Set<number>;
  needsReview: Set<number>;
  counts: {
    fullyEnriched: number;
    hasBuyingSignal: number;
    needsReview: number;
    total: number;
  };
}

const BUYING_SIGNAL_FIELDS = [
  "recent_funding",
  "hiring_velocity",
  "leadership_changes",
  "job_postings",
  "tech_changes",
] as const;

export function classifyRows(
  rows: Array<{
    rowIndex: number;
    enrichments: Record<string, { value: unknown; confidence: number }>;
    status: string;
  }>,
  requestedFieldNames: string[]
): OutboundClassification {
  const fullyEnriched = new Set<number>();
  const hasBuyingSignal = new Set<number>();
  const needsReview = new Set<number>();

  const completedRows = rows.filter((r) => r.status === "completed");

  for (const row of completedRows) {
    const { rowIndex, enrichments } = row;

    // Check fully enriched: every requested field has non-null value AND confidence >= 0.3
    const isFullyEnriched = requestedFieldNames.every((field) => {
      const entry = enrichments[field];
      return (
        entry !== undefined &&
        entry.value !== null &&
        entry.value !== undefined &&
        entry.confidence >= 0.3
      );
    });

    if (isFullyEnriched) {
      fullyEnriched.add(rowIndex);
    }

    // Check buying signals: at least one signal field has a truthy value
    const hasBuying = BUYING_SIGNAL_FIELDS.some((field) => {
      const entry = enrichments[field];
      return entry !== undefined && Boolean(entry.value);
    });

    if (hasBuying) {
      hasBuyingSignal.add(rowIndex);
    }

    // Check needs review: any enriched field has confidence < 0.5, OR any requested field is missing/null
    const lowConfidence = Object.values(enrichments).some(
      (entry) => entry.confidence < 0.5
    );

    const missingField = requestedFieldNames.some((field) => {
      const entry = enrichments[field];
      return (
        entry === undefined || entry.value === null || entry.value === undefined
      );
    });

    if (lowConfidence || missingField) {
      needsReview.add(rowIndex);
    }
  }

  return {
    fullyEnriched,
    hasBuyingSignal,
    needsReview,
    counts: {
      fullyEnriched: fullyEnriched.size,
      hasBuyingSignal: hasBuyingSignal.size,
      needsReview: needsReview.size,
      total: completedRows.length,
    },
  };
}
