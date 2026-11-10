import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { scrapeLinkedInCompany, scrapeLinkedInProfile } from "../services/web-scraper";
import { searchGoogle } from "../services/serp";
import type { Credentials } from "../credentials";

export function createLinkedInCompanyTool(credentials: Credentials) {
  return tool(
    async (input) => {
      let url = input.linkedinUrl;

      // If no URL provided, search for the LinkedIn company page
      if (!url && input.companyName) {
        const results = await searchGoogle(
          `"${input.companyName}" site:linkedin.com/company`,
          credentials,
          { numResults: 3 }
        );
        const match = results.find((r) =>
          r.url.includes("linkedin.com/company/")
        );
        if (!match) {
          return JSON.stringify({
            success: false,
            error: `Could not find LinkedIn page for "${input.companyName}"`,
          });
        }
        url = match.url;
      }

      if (!url) {
        return JSON.stringify({
          success: false,
          error: "Provide either companyName or linkedinUrl",
        });
      }

      const data = await scrapeLinkedInCompany(url, credentials);
      if (!data) {
        return JSON.stringify({
          success: false,
          error: `Failed to scrape LinkedIn company: ${url}`,
        });
      }

      return JSON.stringify({ success: true, linkedinUrl: url, data });
    },
    {
      name: "linkedin_company",
      description:
        "Get structured company data from LinkedIn: name, industry, HQ, employee count, " +
        "website, founding year, specialties, and company type. " +
        "Provide either a LinkedIn URL or a company name (will search for the LinkedIn page).",
      schema: z.object({
        companyName: z
          .string()
          .optional()
          .describe("Company name to search for on LinkedIn"),
        linkedinUrl: z
          .string()
          .optional()
          .describe("Direct LinkedIn company URL (e.g. linkedin.com/company/bright-data)"),
      }),
    }
  );
}

export function createLinkedInProfileTool(credentials: Credentials) {
  return tool(
    async (input) => {
      let url = input.linkedinUrl;

      // If no URL provided, search for the LinkedIn profile
      if (!url && input.name) {
        const companyCtx = input.company ? ` ${input.company}` : "";
        const results = await searchGoogle(
          `"${input.name}"${companyCtx} site:linkedin.com/in/`,
          credentials,
          { numResults: 3 }
        );
        const match = results.find((r) =>
          r.url.includes("linkedin.com/in/")
        );
        if (!match) {
          return JSON.stringify({
            success: false,
            error: `Could not find LinkedIn profile for "${input.name}"`,
          });
        }
        url = match.url;
      }

      if (!url) {
        return JSON.stringify({
          success: false,
          error: "Provide either name or linkedinUrl",
        });
      }

      const data = await scrapeLinkedInProfile(url, credentials);
      if (!data) {
        return JSON.stringify({
          success: false,
          error: `Failed to scrape LinkedIn profile: ${url}`,
        });
      }

      return JSON.stringify({ success: true, linkedinUrl: url, data });
    },
    {
      name: "linkedin_profile",
      description:
        "Get structured person profile data from LinkedIn: name, headline, location, " +
        "current company, experience, education, and skills. " +
        "Provide either a LinkedIn URL or a person's name (will search for the profile).",
      schema: z.object({
        name: z.string().optional().describe("Person's full name"),
        company: z
          .string()
          .optional()
          .describe("Company name for disambiguation"),
        linkedinUrl: z
          .string()
          .optional()
          .describe("Direct LinkedIn profile URL (e.g. linkedin.com/in/username)"),
      }),
    }
  );
}
