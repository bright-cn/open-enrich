"use client";

import { useState, useCallback, useRef } from "react";
import type {
  CSVRow,
  EnrichmentField,
  RowEnrichmentResult,
  EnrichmentEvent,
  AgentStep,
  RowCost,
} from "@brightdata/enrich-core";
import { withBasePath } from "@/lib/base-path";

interface AgentLogEntry {
  rowIndex: number;
  step: AgentStep;
  message: string;
  sourceUrl?: string;
  timestamp: number;
}

export type DemoModalState =
  | { open: false }
  | { open: true; mode: "blocked" }
  | { open: true; mode: "partial"; granted: number; requested: number };

interface EnrichmentState {
  results: Map<number, RowEnrichmentResult>;
  agentLogs: AgentLogEntry[];
  progress: { completed: number; total: number };
  isRunning: boolean;
  sessionId: string | null;
  error: string | null;
  costs: Map<number, RowCost>;
  totalCost: RowCost;
  demoModal: DemoModalState;
}

export function useEnrichment() {
  const [state, setState] = useState<EnrichmentState>({
    results: new Map(),
    agentLogs: [],
    progress: { completed: 0, total: 0 },
    isRunning: false,
    sessionId: null,
    error: null,
    costs: new Map(),
    totalCost: { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 },
    demoModal: { open: false },
  });

  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (
      rows: CSVRow[],
      fields: EnrichmentField[],
      emailColumn: string
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        results: new Map(),
        agentLogs: [],
        progress: { completed: 0, total: rows.length },
        isRunning: true,
        sessionId: null,
        error: null,
        costs: new Map(),
        totalCost: { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 },
        demoModal: { open: false },
      });

      try {
        const response = await fetch(withBasePath("/api/enrich"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows, fields, emailColumn }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Request failed" }));
          if (response.status === 429 && err.code === "DEMO_LIMIT_REACHED") {
            setState((prev) => ({
              ...prev,
              isRunning: false,
              demoModal: { open: true, mode: "blocked" },
            }));
            return;
          }
          setState((prev) => ({
            ...prev,
            isRunning: false,
            error: err.error || `HTTP ${response.status}`,
          }));
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setState((prev) => ({ ...prev, isRunning: false, error: "No response stream" }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const dataMatch = line.match(/^data:\s*(.+)$/m);
            if (!dataMatch) continue;

            try {
              const event = JSON.parse(dataMatch[1]) as EnrichmentEvent;
              handleEvent(event);
            } catch {
              // skip malformed events
            }
          }
        }

        setState((prev) => ({ ...prev, isRunning: false }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          isRunning: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    []
  );

  const handleEvent = useCallback((event: EnrichmentEvent) => {
    switch (event.type) {
      case "session":
        setState((prev) => ({ ...prev, sessionId: event.sessionId }));
        break;

      case "pending":
        setState((prev) => ({
          ...prev,
          progress: { ...prev.progress, total: event.totalRows },
        }));
        break;

      case "processing":
        setState((prev) => {
          const results = new Map(prev.results);
          const existing = results.get(event.rowIndex);
          if (existing) {
            results.set(event.rowIndex, { ...existing, status: "processing" });
          }
          return { ...prev, results };
        });
        break;

      case "agent_progress":
        setState((prev) => ({
          ...prev,
          agentLogs: [
            ...prev.agentLogs,
            {
              rowIndex: event.rowIndex,
              step: event.step,
              message: event.message,
              sourceUrl: event.sourceUrl,
              timestamp: Date.now(),
            },
          ],
        }));
        break;

      case "cost_update":
        setState((prev) => {
          const costs = new Map(prev.costs);
          costs.set(event.rowIndex, event.cost);
          const totalCost = { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 };
          for (const c of costs.values()) {
            totalCost.llmCost += c.llmCost;
            totalCost.llmTokensIn += c.llmTokensIn;
            totalCost.llmTokensOut += c.llmTokensOut;
            totalCost.toolCalls += c.toolCalls;
            totalCost.toolCost += c.toolCost;
            totalCost.totalCost += c.totalCost;
          }
          return { ...prev, costs, totalCost };
        });
        break;

      case "result":
        console.log("[useEnrichment] result event:", {
          rowIndex: event.result.rowIndex,
          status: event.result.status,
          enrichmentKeys: Object.keys(event.result.enrichments),
          enrichmentCount: Object.keys(event.result.enrichments).length,
        });
        setState((prev) => {
          const results = new Map(prev.results);
          results.set(event.result.rowIndex, event.result);
          const completed = Array.from(results.values()).filter(
            (r) => r.status === "completed" || r.status === "error" || r.status === "skipped"
          ).length;

          let costs = prev.costs;
          let totalCost = prev.totalCost;
          if (event.cost) {
            costs = new Map(prev.costs);
            costs.set(event.result.rowIndex, event.cost);
            totalCost = { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 };
            for (const c of costs.values()) {
              totalCost.llmCost += c.llmCost;
              totalCost.llmTokensIn += c.llmTokensIn;
              totalCost.llmTokensOut += c.llmTokensOut;
              totalCost.toolCalls += c.toolCalls;
              totalCost.toolCost += c.toolCost;
              totalCost.totalCost += c.totalCost;
            }
          }

          return {
            ...prev,
            results,
            progress: { ...prev.progress, completed },
            costs,
            totalCost,
          };
        });
        break;

      case "error":
        setState((prev) => ({
          ...prev,
          agentLogs: [
            ...prev.agentLogs,
            {
              rowIndex: event.rowIndex,
              step: "discovery" as AgentStep,
              message: `Error: ${event.error}`,
              timestamp: Date.now(),
            },
          ],
        }));
        break;

      case "quota_partial":
        setState((prev) => ({
          ...prev,
          demoModal: {
            open: true,
            mode: "partial",
            granted: event.granted,
            requested: event.requested,
          },
        }));
        break;

      case "complete":
        setState((prev) => ({ ...prev, isRunning: false }));
        break;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      results: new Map(),
      agentLogs: [],
      progress: { completed: 0, total: 0 },
      isRunning: false,
      sessionId: null,
      error: null,
      costs: new Map(),
      totalCost: { llmCost: 0, llmTokensIn: 0, llmTokensOut: 0, toolCalls: 0, toolCost: 0, totalCost: 0 },
      demoModal: { open: false },
    });
  }, []);

  const closeDemoModal = useCallback(() => {
    setState((prev) => ({ ...prev, demoModal: { open: false } }));
  }, []);

  return {
    results: Array.from(state.results.values()),
    agentLogs: state.agentLogs,
    progress: state.progress,
    isRunning: state.isRunning,
    sessionId: state.sessionId,
    error: state.error,
    costs: Array.from(state.costs.entries()),
    totalCost: state.totalCost,
    demoModal: state.demoModal,
    start,
    cancel,
    reset,
    closeDemoModal,
  };
}
