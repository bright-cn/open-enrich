"use client";

import { useEffect, useRef } from "react";
import { X, Terminal } from "lucide-react";

interface AgentLog {
  rowIndex: number;
  step: string;
  message: string;
  sourceUrl?: string;
  timestamp: number;
}

interface EnrichmentProgressProps {
  completed: number;
  total: number;
  isRunning: boolean;
  agentLogs: AgentLog[];
  onCancel: () => void;
}

const stepColors: Record<string, string> = {
  discovery: "text-[#22D3EE]",
  profile: "text-[#4B8BFF]",
  custom: "text-[#A5A0F6]",
  metrics: "text-[#34D399]",
  funding: "text-[#FBBF24]",
  techstack: "text-[#60A5FA]",
  social: "text-[#60A5FA]",
  mcp: "text-[#60A5FA]",
};

function getStepColor(step: string): string {
  const key = step.toLowerCase();
  for (const [prefix, color] of Object.entries(stepColors)) {
    if (key.includes(prefix)) return color;
  }
  return "text-[rgba(240,242,248,0.4)]";
}

export default function EnrichmentProgress({
  completed,
  total,
  isRunning,
  agentLogs,
  onCancel,
}: EnrichmentProgressProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentLogs]);

  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="bg-[rgba(11,16,34,0.6)] border border-[rgba(165,180,220,0.08)] rounded-2xl overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(165,180,220,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[rgba(240,242,248,0.3)]" />
          <span className="text-[#f0f2f8] font-semibold text-sm tracking-tight">
            Agent logs
          </span>
          {isRunning && (
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34D399]" />
            </span>
          )}
        </div>
        {isRunning && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-[rgba(165,180,220,0.04)]">
        <div
          className="h-full bg-gradient-to-r from-[#A5A0F6] via-[#4B8BFF] to-[#22D3EE] transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Status text */}
      <div className="px-4 py-2 text-[11px] text-[rgba(240,242,248,0.3)] font-mono tabular-nums">
        {completed}/{total} rows
        {isRunning && (
          <span className="ml-2 text-[rgba(240,242,248,0.2)]">
            ({Math.round(progressPercent)}%)
          </span>
        )}
      </div>

      {/* Log entries */}
      <div className="px-4 pb-4 font-mono text-[13px] space-y-0.5 max-h-64 overflow-y-auto">
        {agentLogs.map((log, i) => (
          <div key={i} className="flex py-0.5 group">
            <span
              className={`w-24 flex-shrink-0 font-medium ${getStepColor(log.step)}`}
            >
              {log.step}
            </span>
            <span className="text-[rgba(240,242,248,0.55)] group-hover:text-[rgba(240,242,248,0.75)] transition-colors duration-150">
              {log.message}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
