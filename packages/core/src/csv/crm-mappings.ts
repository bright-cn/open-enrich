export interface CrmFieldMapping {
  crmField: string;
  transform?: (value: unknown) => string;
}

export const SALESFORCE_MAPPINGS: Record<string, CrmFieldMapping> = {
  company_name: { crmField: "Company" },
  employee_count: { crmField: "NumberOfEmployees", transform: (v) => String(parseInt(String(v)) || "") },
  revenue: { crmField: "AnnualRevenue", transform: (v) => String(v).replace(/[^0-9.]/g, "") },
  industry: { crmField: "Industry" },
  headquarters: { crmField: "BillingCity" },
  website: { crmField: "Website", transform: (v) => { const s = String(v); return s.startsWith("http") ? s : `https://${s}`; } },
  description: { crmField: "Description" },
  funding_stage: { crmField: "Funding_Stage__c" },
  founded_year: { crmField: "Founded_Year__c" },
  tech_stack: { crmField: "Tech_Stack__c", transform: (v) => Array.isArray(v) ? v.join("; ") : String(v) },
  linkedin_url: { crmField: "LinkedIn_URL__c" },
  twitter_url: { crmField: "Twitter_URL__c" },
  phone: { crmField: "Phone" },
  ceo_name: { crmField: "CEO_Name__c" },
  recent_funding: { crmField: "Recent_Funding__c" },
  hiring_velocity: { crmField: "Hiring_Velocity__c" },
};

export const HUBSPOT_MAPPINGS: Record<string, CrmFieldMapping> = {
  company_name: { crmField: "name" },
  employee_count: { crmField: "numberofemployees", transform: (v) => String(parseInt(String(v)) || "") },
  revenue: { crmField: "annualrevenue", transform: (v) => String(v).replace(/[^0-9.]/g, "") },
  industry: { crmField: "industry" },
  headquarters: { crmField: "city" },
  website: { crmField: "domain", transform: (v) => { try { return new URL(String(v).startsWith("http") ? String(v) : `https://${v}`).hostname.replace("www.", ""); } catch { return String(v); } } },
  description: { crmField: "description" },
  linkedin_url: { crmField: "linkedin_company_page" },
  twitter_url: { crmField: "twitterhandle", transform: (v) => { const m = String(v).match(/twitter\.com\/([^/?]+)|x\.com\/([^/?]+)/); return m ? (m[1] || m[2] || String(v)) : String(v); } },
  founded_year: { crmField: "founded_year" },
  phone: { crmField: "phone" },
  tech_stack: { crmField: "tech_stack", transform: (v) => Array.isArray(v) ? v.join("; ") : String(v) },
};

export function getMappingsForCrm(crm: "salesforce" | "hubspot"): Record<string, CrmFieldMapping> {
  return crm === "salesforce" ? SALESFORCE_MAPPINGS : HUBSPOT_MAPPINGS;
}

export function mapFieldValue(fieldName: string, value: unknown, crm: "salesforce" | "hubspot"): { crmField: string; value: string } {
  const mappings = getMappingsForCrm(crm);
  const mapping = mappings[fieldName];
  if (!mapping) return { crmField: fieldName, value: formatValue(value) };
  const transformed = mapping.transform ? mapping.transform(value) : formatValue(value);
  return { crmField: mapping.crmField, value: transformed };
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}
