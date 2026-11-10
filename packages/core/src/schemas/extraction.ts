import { z } from "zod";
import type { EnrichmentField } from "../types/enrichment";

// ── Source schema (used as companion field for every extracted value) ──

const sourceSchema = z.object({
  url: z.string(),
  quote: z.string(),
});

// ── Company Profile ──

export const companyProfileSchema = z.object({
  company_name: z.string().nullable(),
  company_name_confidence: z.number().min(0).max(1),
  company_name_sources: z.array(sourceSchema),

  domain: z.string().nullable(),
  domain_confidence: z.number().min(0).max(1),
  domain_sources: z.array(sourceSchema),

  description: z.string().nullable(),
  description_confidence: z.number().min(0).max(1),
  description_sources: z.array(sourceSchema),

  industry: z.string().nullable(),
  industry_confidence: z.number().min(0).max(1),
  industry_sources: z.array(sourceSchema),

  headquarters: z.string().nullable(),
  headquarters_confidence: z.number().min(0).max(1),
  headquarters_sources: z.array(sourceSchema),

  founded_year: z.number().nullable(),
  founded_year_confidence: z.number().min(0).max(1),
  founded_year_sources: z.array(sourceSchema),

  company_type: z.string().nullable(),
  company_type_confidence: z.number().min(0).max(1),
  company_type_sources: z.array(sourceSchema),
});

// ── Company Metrics ──

export const companyMetricsSchema = z.object({
  employee_count: z.number().nullable(),
  employee_count_confidence: z.number().min(0).max(1),
  employee_count_sources: z.array(sourceSchema),

  revenue: z.string().nullable(),
  revenue_confidence: z.number().min(0).max(1),
  revenue_sources: z.array(sourceSchema),

  growth_rate: z.string().nullable(),
  growth_rate_confidence: z.number().min(0).max(1),
  growth_rate_sources: z.array(sourceSchema),
});

// ── Funding ──

export const fundingSchema = z.object({
  funding_stage: z.string().nullable(),
  funding_stage_confidence: z.number().min(0).max(1),
  funding_stage_sources: z.array(sourceSchema),

  last_funding_amount: z.string().nullable(),
  last_funding_amount_confidence: z.number().min(0).max(1),
  last_funding_amount_sources: z.array(sourceSchema),

  total_raised: z.string().nullable(),
  total_raised_confidence: z.number().min(0).max(1),
  total_raised_sources: z.array(sourceSchema),

  valuation: z.string().nullable(),
  valuation_confidence: z.number().min(0).max(1),
  valuation_sources: z.array(sourceSchema),

  investors: z.array(z.string()).nullable(),
  investors_confidence: z.number().min(0).max(1),
  investors_sources: z.array(sourceSchema),
});

// ── Tech Stack ──

export const techStackSchema = z.object({
  tech_stack: z.array(z.string()).nullable(),
  tech_stack_confidence: z.number().min(0).max(1),
  tech_stack_sources: z.array(sourceSchema),

  languages: z.array(z.string()).nullable(),
  languages_confidence: z.number().min(0).max(1),
  languages_sources: z.array(sourceSchema),

  frameworks: z.array(z.string()).nullable(),
  frameworks_confidence: z.number().min(0).max(1),
  frameworks_sources: z.array(sourceSchema),

  github_url: z.string().nullable(),
  github_url_confidence: z.number().min(0).max(1),
  github_url_sources: z.array(sourceSchema),
});

// ── Social Presence ──

export const socialPresenceSchema = z.object({
  linkedin_url: z.string().nullable(),
  linkedin_url_confidence: z.number().min(0).max(1),
  linkedin_url_sources: z.array(sourceSchema),

  twitter_url: z.string().nullable(),
  twitter_url_confidence: z.number().min(0).max(1),
  twitter_url_sources: z.array(sourceSchema),

  github_url: z.string().nullable(),
  github_url_confidence: z.number().min(0).max(1),
  github_url_sources: z.array(sourceSchema),

  blog_url: z.string().nullable(),
  blog_url_confidence: z.number().min(0).max(1),
  blog_url_sources: z.array(sourceSchema),
});

// ── Contact Info ──

export const contactInfoSchema = z.object({
  ceo_name: z.string().nullable(),
  ceo_name_confidence: z.number().min(0).max(1),
  ceo_name_sources: z.array(sourceSchema),

  founders: z.array(z.string()).nullable(),
  founders_confidence: z.number().min(0).max(1),
  founders_sources: z.array(sourceSchema),

  email_pattern: z.string().nullable(),
  email_pattern_confidence: z.number().min(0).max(1),
  email_pattern_sources: z.array(sourceSchema),
});

// ── Person Enrichment ──

export const personEnrichmentSchema = z.object({
  person_email: z.string().nullable(),
  person_email_confidence: z.number().min(0).max(1),
  person_email_sources: z.array(sourceSchema),

  person_phone: z.string().nullable(),
  person_phone_confidence: z.number().min(0).max(1),
  person_phone_sources: z.array(sourceSchema),

  person_linkedin_url: z.string().nullable(),
  person_linkedin_url_confidence: z.number().min(0).max(1),
  person_linkedin_url_sources: z.array(sourceSchema),

  person_github_url: z.string().nullable(),
  person_github_url_confidence: z.number().min(0).max(1),
  person_github_url_sources: z.array(sourceSchema),

  person_twitter_url: z.string().nullable(),
  person_twitter_url_confidence: z.number().min(0).max(1),
  person_twitter_url_sources: z.array(sourceSchema),

  person_title: z.string().nullable(),
  person_title_confidence: z.number().min(0).max(1),
  person_title_sources: z.array(sourceSchema),

  person_seniority: z.string().nullable(),
  person_seniority_confidence: z.number().min(0).max(1),
  person_seniority_sources: z.array(sourceSchema),

  person_location: z.string().nullable(),
  person_location_confidence: z.number().min(0).max(1),
  person_location_sources: z.array(sourceSchema),

  person_headline: z.string().nullable(),
  person_headline_confidence: z.number().min(0).max(1),
  person_headline_sources: z.array(sourceSchema),

  person_summary: z.string().nullable(),
  person_summary_confidence: z.number().min(0).max(1),
  person_summary_sources: z.array(sourceSchema),
});

// ── Dynamic schema builder for custom/user-defined fields ──

export function buildCustomFieldSchema(fields: EnrichmentField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const baseType = fieldTypeToZod(field.type);
    shape[field.name] = baseType.nullable();
    shape[`${field.name}_confidence`] = z.number().min(0).max(1);
    shape[`${field.name}_sources`] = z.array(sourceSchema);
  }

  return z.object(shape);
}

function fieldTypeToZod(
  type: EnrichmentField["type"]
): z.ZodType<unknown> {
  switch (type) {
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(z.string());
    case "string":
    default:
      return z.string();
  }
}
