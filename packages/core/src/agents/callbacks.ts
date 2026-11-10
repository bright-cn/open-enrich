import type { AgentStep } from "../types/enrichment";

/**
 * Callback that emits SSE-style progress events during enrichment.
 * The API route passes this in, and each agent node calls it.
 */
export type ProgressCallback = (event: AgentProgressEvent) => void;

export type AgentProgressEvent = {
  rowIndex: number;
  step: AgentStep;
  message: string;
  sourceUrl?: string;
};

/**
 * No-op callback for when streaming isn't needed (e.g. tests).
 */
export const noopCallback: ProgressCallback = () => {};
