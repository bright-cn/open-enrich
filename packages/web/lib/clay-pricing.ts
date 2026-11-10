/**
 * Clay.com Growth plan pricing estimates per enriched field.
 * Based on ~$0.05/credit at Growth plan rates.
 * Source: clay.com/pricing, March 2026 pricing overhaul.
 */
const CLAY_COST_MAP: Record<string, number> = {
  // Contact data
  person_email: 0.40,
  person_phone: 0.25,
  person_linkedin_url: 0.20,
  person_github_url: 0.15,
  person_twitter_url: 0.10,
  person_title: 0.15,
  person_seniority: 0.15,
  person_location: 0.15,
  person_headline: 0.10,
  person_summary: 0.10,

  // Company enrichment
  company_name: 0.10,
  domain: 0.05,
  description: 0.10,
  industry: 0.10,
  employee_count: 0.15,
  year_founded: 0.10,
  headquarters: 0.10,

  // Technographics
  tech_stack: 0.25,
  technologies: 0.25,

  // Funding
  recent_funding: 0.20,
  total_funding: 0.20,
  funding_stage: 0.20,
  investors: 0.20,

  // Social/web
  linkedin_url: 0.15,
  twitter_url: 0.10,
  github_url: 0.10,

  // Metrics/signals
  hiring_velocity: 0.20,
  leadership_changes: 0.20,
  revenue_estimate: 0.25,
  growth_signals: 0.20,
};

const DEFAULT_FIELD_COST = 0.20;
const CLAY_MONTHLY_PLATFORM_COST = 495;

/**
 * Estimate Clay cost for a single enriched field.
 */
export function getClayFieldCost(fieldName: string): number {
  return CLAY_COST_MAP[fieldName] ?? DEFAULT_FIELD_COST;
}

/**
 * Estimate total Clay cost for a set of successfully enriched fields.
 * Only counts fields that have actual data (non-null value, confidence > 0).
 */
export function calculateClayCost(
  enrichedFieldNames: string[]
): { perFieldCosts: Record<string, number>; totalDataCost: number } {
  const perFieldCosts: Record<string, number> = {};
  let totalDataCost = 0;

  for (const field of enrichedFieldNames) {
    const cost = getClayFieldCost(field);
    perFieldCosts[field] = cost;
    totalDataCost += cost;
  }

  return { perFieldCosts, totalDataCost };
}

/**
 * Calculate full Clay comparison including platform amortization.
 */
export function calculateClayComparison(
  totalRows: number,
  enrichedFieldNames: string[][]
) {
  let totalDataCost = 0;
  const fieldTotals: Record<string, number> = {};

  for (const fields of enrichedFieldNames) {
    const { perFieldCosts, totalDataCost: rowCost } = calculateClayCost(fields);
    totalDataCost += rowCost;
    for (const [field, cost] of Object.entries(perFieldCosts)) {
      fieldTotals[field] = (fieldTotals[field] ?? 0) + cost;
    }
  }

  if (totalRows === 0) {
    return { totalDataCost: 0, totalPlatformCost: 0, totalCost: 0, perRowAverage: 0, fieldTotals: {}, monthlyPlatformCost: CLAY_MONTHLY_PLATFORM_COST };
  }

  // Amortize platform cost — floor at 100 rows to avoid inflated per-row cost on small batches
  const estimatedMonthlyVolume = Math.max(totalRows, 100);
  const platformCostPerRow = CLAY_MONTHLY_PLATFORM_COST / estimatedMonthlyVolume;
  const totalPlatformCost = platformCostPerRow * totalRows;

  return {
    totalDataCost,
    totalPlatformCost,
    totalCost: totalDataCost + totalPlatformCost,
    perRowAverage: (totalDataCost + totalPlatformCost) / totalRows,
    fieldTotals,
    monthlyPlatformCost: CLAY_MONTHLY_PLATFORM_COST,
  };
}
