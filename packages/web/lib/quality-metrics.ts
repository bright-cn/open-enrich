export interface QualityMetrics {
  totalFields: number;
  enrichedFields: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  highConfidencePercent: number;
  sourceBreakdown: Record<string, number>;
  conflictingFields: number;
  averageConfidence: number;
}

const DOMAIN_LABELS: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "crunchbase.com": "Crunchbase",
  "google.com": "Google Search",
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

function readableDomain(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

export function computeQualityMetrics(
  rows: Array<{
    enrichments: Record<
      string,
      {
        confidence: number;
        sourceContext?: Array<{
          url: string;
          snippet: string;
          confidence: number;
        }>;
      }
    >;
    status: string;
  }>
): QualityMetrics {
  let totalFields = 0;
  let enrichedFields = 0;
  let highConfidenceCount = 0;
  let mediumConfidenceCount = 0;
  let lowConfidenceCount = 0;
  let confidenceSum = 0;
  let conflictingFields = 0;
  const sourceBreakdown: Record<string, number> = {};

  const completedRows = rows.filter((row) => row.status === "completed");

  for (const row of completedRows) {
    const enrichments = row.enrichments;
    if (!enrichments) continue;

    for (const key of Object.keys(enrichments)) {
      const field = enrichments[key];
      totalFields++;

      if (field == null) continue;
      if (field.confidence == null && !field.sourceContext) continue;

      enrichedFields++;
      const confidence = field.confidence ?? 0;
      confidenceSum += confidence;

      if (confidence > 0.8) {
        highConfidenceCount++;
      } else if (confidence >= 0.5) {
        mediumConfidenceCount++;
      } else {
        lowConfidenceCount++;
      }

      const sources = field.sourceContext;
      if (sources && Array.isArray(sources)) {
        for (const source of sources) {
          if (!source.url) continue;
          const domain = readableDomain(extractDomain(source.url));
          sourceBreakdown[domain] = (sourceBreakdown[domain] ?? 0) + 1;
        }

        if (sources.length >= 2) {
          const confidences = sources.map((s) => s.confidence ?? 0);
          const min = Math.min(...confidences);
          const max = Math.max(...confidences);
          if (max - min > 0.3) {
            conflictingFields++;
          }
        }
      }
    }
  }

  const highConfidencePercent =
    enrichedFields > 0
      ? Math.round((highConfidenceCount / enrichedFields) * 100)
      : 0;

  const averageConfidence =
    enrichedFields > 0 ? confidenceSum / enrichedFields : 0;

  return {
    totalFields,
    enrichedFields,
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    highConfidencePercent,
    sourceBreakdown,
    conflictingFields,
    averageConfidence,
  };
}
