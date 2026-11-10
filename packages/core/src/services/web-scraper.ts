import { createBrightDataClient } from "./bright-data";
import type {
  LinkedInCompanyData,
  LinkedInProfileData,
  CrunchbaseData,
} from "../types/bright-data";
import type { Credentials } from "../credentials";

/**
 * Scrape structured LinkedIn company data using Bright Data's dedicated scraper.
 * Uses the one-call orchestrate method: trigger → poll → fetch.
 */
export async function scrapeLinkedInCompany(
  url: string,
  credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">
): Promise<LinkedInCompanyData | null> {
  const client = createBrightDataClient(credentials);
  try {
    const result = await client.scrape.linkedin.companies([url]);
    if (!result.success || !result.data) return null;

    const records = result.data as Record<string, unknown>[];
    if (!records.length) return null;

    const raw = records[0];
    return {
      name: str(raw.name),
      description: str(raw.description ?? raw.about),
      url: str(raw.url),
      website: str(raw.website),
      industry: str(raw.industries),
      companySize: str(raw.company_size),
      headquarters: str(raw.headquarters),
      founded: raw.founded ? Number(raw.founded) : undefined,
      specialties: raw.specialties
        ? toStringArray(raw.specialties)
        : undefined,
      employeeCount: raw.employees_in_linkedin
        ? Number(raw.employees_in_linkedin)
        : undefined,
      followerCount: raw.followers
        ? Number(raw.followers)
        : undefined,
      type: str(raw.organization_type),
    };
  } catch (err) {
    console.error(`[web-scraper] LinkedIn company scrape failed for ${url}:`, err);
    return null;
  }
}

/**
 * Scrape structured LinkedIn person profile data.
 */
export async function scrapeLinkedInProfile(
  url: string,
  credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">
): Promise<LinkedInProfileData | null> {
  const client = createBrightDataClient(credentials);
  try {
    const result = await client.scrape.linkedin.profiles([url]);
    if (!result.success || !result.data) return null;

    const records = result.data as Record<string, unknown>[];
    if (!records.length) return null;

    const raw = records[0];
    const currentCompany = raw.current_company as Record<string, unknown> | null;
    return {
      name: str(raw.name),
      headline: str(raw.about),
      location: str(raw.city),
      about: str(raw.about),
      currentCompany: currentCompany ? str(currentCompany.name) : str(raw.current_company_name),
      currentTitle: undefined, // not available in LinkedIn public profile scrape
      connections: raw.connections ? Number(raw.connections) : undefined,
      experience: Array.isArray(raw.experience)
        ? (raw.experience as Record<string, unknown>[]).map((e) => ({
            title: String(e.title ?? ""),
            company: String(e.company ?? e.subtitle ?? ""),
            startDate: str(e.start_year),
            endDate: str(e.end_year),
          }))
        : undefined,
      education: Array.isArray(raw.education)
        ? (raw.education as Record<string, unknown>[]).map((e) => ({
            school: String(e.title ?? e.school ?? ""),
            degree: str(e.subtitle ?? e.degree),
            field: str(e.field_of_study),
          }))
        : undefined,
      skills: raw.skills ? toStringArray(raw.skills) : undefined,
    };
  } catch (err) {
    console.error(`[web-scraper] LinkedIn profile scrape failed for ${url}:`, err);
    return null;
  }
}

/**
 * Scrape Crunchbase company data via Web Unlocker + markdown extraction.
 * Crunchbase doesn't have a dedicated SDK scraper, so we use SERP + unlocker.
 */
export async function scrapeCrunchbase(
  companyName: string,
  _credentials: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">
): Promise<CrunchbaseData | null> {
  // Crunchbase is best accessed via search + structured extraction
  // by the agent layer rather than direct scraping. This function
  // provides a placeholder for when Bright Data adds a dedicated scraper.
  // For now, agents use SERP search + Web Unlocker on crunchbase.com URLs.
  console.warn(
    `[web-scraper] Crunchbase direct scraping not yet available via SDK. ` +
    `Use SERP search for "${companyName}" instead.`
  );
  return null;
}

// ── Helpers ──

function str(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  const s = String(val).trim();
  return s.length > 0 ? s : undefined;
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (typeof val === "string") return val.split(",").map((s) => s.trim());
  return [];
}
