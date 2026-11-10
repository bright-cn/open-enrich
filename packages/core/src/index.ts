export type {
  CSVRow,
  FieldType,
  EnrichmentField,
  FieldCategory,
  EnrichmentSource,
  FieldConfidence,
  EnrichmentResult,
  EnrichmentStatus,
  AgentStep,
  RowEnrichmentResult,
  EmailContext,
  RowCost,
  EnrichmentEvent,
} from "./types/enrichment";

export type * from "./types/bright-data";

export type { Credentials } from "./credentials";
export { MissingCredentialsError, assertCredentials } from "./credentials";

// Services — internal building blocks, exported for web consumers
export { createBrightDataClient } from "./services/bright-data";
export { searchGoogle, searchBatch } from "./services/serp";
export type { SearchOptions } from "./services/serp";
export { scrapeLinkedInCompany, scrapeLinkedInProfile, scrapeCrunchbase } from "./services/web-scraper";
export { scrapeUrl, scrapeAsMarkdown, scrapeBatch } from "./services/web-unlocker";
export type { ScrapeOptions } from "./services/web-unlocker";
export { lookupCompany, preview, triggerFull, enrichColumn, getStatus } from "./services/deep-lookup";

export { CostTracker, withCostTracking } from "./cost-tracker";
export { createLLM } from "./config/llm";
export {
  companyProfileSchema,
  companyMetricsSchema,
  fundingSchema,
  techStackSchema,
  socialPresenceSchema,
  contactInfoSchema,
  personEnrichmentSchema,
  buildCustomFieldSchema,
} from "./schemas/extraction";

export { buildEnrichmentGraph } from "./agents/graph";
export type { EnrichmentState, EnrichmentStateUpdate, AgentLog } from "./agents/state";
export type { ProgressCallback, AgentProgressEvent } from "./agents/callbacks";

// Tool factories — exported so dev scripts and downstream consumers
// (e.g. CLI commands) can construct tools directly with credentials.
export { createSearchTool } from "./tools/search-tool";
export { createScrapeTool } from "./tools/scrape-tool";
export {
  createLinkedInCompanyTool,
  createLinkedInProfileTool,
} from "./tools/linkedin-tool";
export { createCrunchbaseTool } from "./tools/crunchbase-tool";
export { createDeepLookupTool } from "./tools/deep-lookup-tool";
export { submitFieldTool } from "./tools/submit-tool";

export { parseCSV } from "./csv/parse";
export type { ParsedCSV } from "./csv/parse";
export {
  exportCrmCsv,
  exportRawCsv,
  exportJson,
  exportTsv,
  triggerDownload,
  copyToClipboard,
} from "./csv/format";
export {
  getMappingsForCrm,
  mapFieldValue,
  SALESFORCE_MAPPINGS,
  HUBSPOT_MAPPINGS,
} from "./csv/crm-mappings";
export type { CrmFieldMapping } from "./csv/crm-mappings";
export { detectIdentifierColumn } from "./identifier/detect";
export type { IdentifierType, IdentifierDetection } from "./identifier/detect";
export {
  shouldSkipEmail,
  getSkipReason,
  SKIP_DOMAINS,
  CONCURRENT_ROWS,
  AGENT_TIMEOUT_MS,
} from "./identifier/skip-domains";
export { runEnrichment } from "./run-enrichment";
export type {
  RunEnrichmentOptions,
  RunEnrichmentEvent,
} from "./run-enrichment";
export { generateFieldsFromPrompt } from "./generate-fields";
export type { GeneratedFields } from "./generate-fields";
export { PRESET_FIELDS, QUICK_START_BUNDLES } from "./presets";
export type { PresetField, FieldBundle } from "./presets";

export type { MCPServerConfig, MCPTransport } from "./mcp/types";
