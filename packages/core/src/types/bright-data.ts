// ── SERP API Response Types ──

export interface SerpOrganicResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

export interface SerpKnowledgePanel {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  attributes?: Record<string, string>;
}

export interface SerpResponse {
  general?: {
    engine: string;
    query: string;
    resultsCount: number;
  };
  organic: SerpOrganicResult[];
  knowledgePanel?: SerpKnowledgePanel;
  peopleAlsoAsk?: Array<{ question: string; answer?: string }>;
}

/** Simplified result we pass around internally */
export interface SerpResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

// ── Web Unlocker Response Types ──

export interface UnlockerResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

// ── Web Scraper / Dataset Response Types ──

export interface LinkedInCompanyData {
  name?: string;
  description?: string;
  url?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  headquarters?: string;
  founded?: number;
  specialties?: string[];
  employeeCount?: number;
  followerCount?: number;
  type?: string;
}

export interface LinkedInProfileData {
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  currentCompany?: string;
  currentTitle?: string;
  connections?: number;
  experience?: Array<{
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
  }>;
  skills?: string[];
}

export interface CrunchbaseData {
  name?: string;
  description?: string;
  url?: string;
  foundedDate?: string;
  numEmployees?: string;
  categories?: string[];
  headquarters?: string;
  fundingTotal?: string;
  lastFundingType?: string;
  lastFundingDate?: string;
  lastFundingAmount?: string;
  investors?: string[];
  ipoStatus?: string;
  revenue?: string;
}

// ── Deep Lookup Types ──

export type DeepLookupStatus =
  | "identifying"
  | "generating_schema"
  | "generating"
  | "done"
  | "failed";

export interface DeepLookupPreview {
  previewId: string;
  status: DeepLookupStatus;
  sampleResults?: Record<string, unknown>[];
  columns?: string[];
}

export interface DeepLookupResult {
  requestId: string;
  status: DeepLookupStatus;
  step: string;
  resultCount?: number;
  data?: Record<string, unknown>[];
}
