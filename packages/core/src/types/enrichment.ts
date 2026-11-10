export type CSVRow = Record<string, string>;

export type FieldType = "string" | "number" | "boolean" | "array";

export interface EnrichmentField {
  name: string;
  displayName: string;
  description: string;
  type: FieldType;
  required: boolean;
  category?: FieldCategory;
}

export type FieldCategory =
  | "icp_qualification"
  | "buying_signals"
  | "personalization"
  | "contact_data"
  | "social_web"
  | "custom";

export interface EnrichmentSource {
  url: string;
  snippet: string;
  confidence: number;
}

export interface FieldConfidence {
  score: number;
  sources: EnrichmentSource[];
  corroboration?: {
    sourcesAgree: boolean;
    evidence: Array<{
      value: unknown;
      sourceUrl: string;
      exactText: string;
      confidence: number;
    }>;
  };
}

export interface EnrichmentResult {
  field: string;
  value: string | number | boolean | string[] | null;
  confidence: number;
  source?: string;
  sourceContext?: EnrichmentSource[];
  sourceCount?: number;
  scrapedAt?: string;
  corroboration?: FieldConfidence["corroboration"];
}

export type EnrichmentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "error"
  | "skipped";

export type AgentStep =
  | "discovery"
  | "profile"
  | "metrics"
  | "funding"
  | "techstack"
  | "social"
  | "custom"
  | "person"
  | "mcp";

export interface RowEnrichmentResult {
  rowIndex: number;
  originalData: CSVRow;
  enrichments: Record<string, EnrichmentResult>;
  status: EnrichmentStatus;
  currentStep?: AgentStep;
  stepDetails?: string;
  error?: string;
}

export interface EmailContext {
  email: string;
  domain: string;
  companyDomain?: string;
  personalName?: string;
  companyNameGuess?: string;
  isPersonalEmail: boolean;
}

export interface RowCost {
  llmCost: number;
  llmTokensIn: number;
  llmTokensOut: number;
  toolCalls: number;
  toolCost: number;
  totalCost: number;
}

/** SSE event types streamed from /api/enrich */
export type EnrichmentEvent =
  | { type: "session"; sessionId: string }
  | { type: "pending"; rowIndex: number; totalRows: number }
  | { type: "processing"; rowIndex: number; totalRows: number }
  | {
      type: "agent_progress";
      rowIndex: number;
      step: AgentStep;
      message: string;
      sourceUrl?: string;
    }
  | { type: "cost_update"; rowIndex: number; cost: RowCost }
  | { type: "result"; result: RowEnrichmentResult; cost?: RowCost }
  | { type: "error"; rowIndex: number; error: string }
  | { type: "quota_partial"; granted: number; requested: number }
  | { type: "complete"; totalRows: number; successCount: number };
