import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import type {
  EnrichmentField,
  EnrichmentResult,
  AgentStep,
} from "../types/enrichment";

/** A single log entry from agent execution. */
export interface AgentLog {
  step: AgentStep;
  message: string;
  sourceUrl?: string;
  timestamp: number;
}

/**
 * LangGraph state for a single row's enrichment pipeline.
 *
 * Uses Annotation.Root so every node receives the full state
 * and returns a partial update that gets merged via reducers.
 */
export const EnrichmentStateAnnotation = Annotation.Root({
  /** LLM conversation messages — append-only. */
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),

  // ── Input context (set once at START) ──

  email: Annotation<string>,
  domain: Annotation<string>,
  companyNameGuess: Annotation<string>,
  requestedFields: Annotation<EnrichmentField[]>,

  // ── Progressive discovery (updated by agents) ──

  /** Confirmed company name (set by discovery agent). */
  companyName: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /** Confirmed company website URL. */
  companyWebsite: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /** LinkedIn company URL if found. */
  linkedinUrl: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // ── Person context (set from CSV) ──

  personFirstName: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  personLastName: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  personCompany: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // ── Results (append-only, merged across agents) ──

  /** Completed enrichment results — each agent appends its findings. */
  completedFields: Annotation<EnrichmentResult[]>({
    reducer: (left, right) => {
      // Deduplicate by field name, keeping highest confidence
      const merged = new Map<string, EnrichmentResult>();
      for (const r of [...left, ...right]) {
        const existing = merged.get(r.field);
        if (!existing || r.confidence > existing.confidence) {
          merged.set(r.field, r);
        }
      }
      return Array.from(merged.values());
    },
    default: () => [],
  }),

  /** Agent execution logs — append-only. */
  agentLogs: Annotation<AgentLog[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),

  /** Fields that still need to be resolved. */
  pendingFields: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
});

/** Full state type. */
export type EnrichmentState = typeof EnrichmentStateAnnotation.State;

/** Partial update type returned by nodes. */
export type EnrichmentStateUpdate = typeof EnrichmentStateAnnotation.Update;
