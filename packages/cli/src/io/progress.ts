import pc from "picocolors";
import type { RunEnrichmentEvent, RowEnrichmentResult } from "@brightdata/enrich-core";
import { formatCost, formatDuration, progressBar, truncate } from "../util/format";

export interface ProgressOptions {
  total: number;
  quiet: boolean;
  verbose: boolean;
  outputPath?: string;
}

interface RowState {
  identifier: string;
  companyName?: string;
  step?: string;
}

export class ProgressRenderer {
  private completed = 0;
  private rowStates = new Map<number, RowState>();
  private latestProgress?: { step: string; companyName?: string };
  private totalCostUsd = 0;
  private llmCostUsd = 0;
  private toolCostUsd = 0;
  private successCount = 0;
  private skippedCount = 0;
  private errorCount = 0;
  private startedAt = Date.now();
  private lastRender = 0;
  private isTTY = process.stderr.isTTY === true;
  private liveLines = 0;
  private rateWindow: Array<{ at: number; completed: number }> = [];

  constructor(private opts: ProgressOptions) {}

  setRowIdentifier(rowIndex: number, identifier: string) {
    if (!this.rowStates.has(rowIndex)) {
      this.rowStates.set(rowIndex, { identifier });
    }
  }

  handleEvent(event: RunEnrichmentEvent) {
    if (this.opts.quiet) return;

    switch (event.type) {
      case "agent_progress": {
        const state = this.rowStates.get(event.rowIndex);
        if (state) state.step = event.step;
        this.latestProgress = { step: event.step, companyName: state?.companyName };
        if (this.opts.verbose) this.writeLog(`[${this.timestamp()}] ${pc.dim(`row ${event.rowIndex}: ${event.step}`)} ${event.message}`);
        this.rerender();
        break;
      }
      case "result": {
        this.handleResult(event.result);
        if (event.cost) this.applyCost(event.cost.totalCost, event.cost.llmCost, event.cost.toolCost);
        this.rerender();
        break;
      }
      case "cost_update": {
        // We only track per-row deltas at result time; cost_update is per-row running cost.
        // Skipping incremental aggregation here to avoid double-counting.
        break;
      }
      case "error": {
        this.clearLive();
        process.stderr.write(`\n${pc.red("✗ ")}${event.error}\n`);
        this.rerender();
        break;
      }
      case "complete": {
        this.finalize();
        break;
      }
    }
  }

  private handleResult(result: RowEnrichmentResult) {
    this.completed++;
    this.rateWindow.push({ at: Date.now(), completed: this.completed });
    while (this.rateWindow.length > 0 && Date.now() - this.rateWindow[0].at > 30_000) {
      this.rateWindow.shift();
    }
    const identifier = this.rowStates.get(result.rowIndex)?.identifier ?? `row ${result.rowIndex}`;
    const companyDisplay = truncate(identifier, 25).padEnd(25);

    if (result.status === "completed") {
      this.successCount++;
      const fieldCount = Object.keys(result.enrichments).length;
      this.writeLog(`[${this.timestamp()}] ${companyDisplay} ${pc.green("✓ done")}        ${fieldCount} fields`);
    } else if (result.status === "skipped") {
      this.skippedCount++;
      this.writeLog(`[${this.timestamp()}] ${companyDisplay} ${pc.yellow("⊘ skipped")}     ${result.error ?? ""}`);
    } else if (result.status === "error") {
      this.errorCount++;
      this.writeLog(`[${this.timestamp()}] ${companyDisplay} ${pc.red("✗ error")}        ${truncate(result.error ?? "", 50)}`);
    }
  }

  private applyCost(total: number, llm: number, tool: number) {
    this.totalCostUsd += total;
    this.llmCostUsd += llm;
    this.toolCostUsd += tool;
  }

  finalize() {
    if (this.opts.quiet) return;
    this.clearLive();
    const dur = formatDuration(Date.now() - this.startedAt);
    process.stderr.write(`\n${pc.green("✓")} ${this.completed} rows enriched in ${dur}\n`);
    process.stderr.write(`  ${this.successCount} done  •  ${this.skippedCount} skipped  •  ${this.errorCount} errors\n`);
    process.stderr.write(`  Total cost: ${formatCost(this.totalCostUsd)}  (LLM ${formatCost(this.llmCostUsd)}  •  Bright Data ${formatCost(this.toolCostUsd)})\n`);
    if (this.opts.outputPath) process.stderr.write(`  Written to: ${this.opts.outputPath}\n`);
  }

  private timestamp(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }

  private writeLog(line: string) {
    this.clearLive();
    process.stderr.write(line + "\n");
    this.rerender();
  }

  private clearLive() {
    if (!this.isTTY || this.liveLines === 0) return;
    for (let i = 0; i < this.liveLines; i++) {
      process.stderr.write("\x1b[1A\x1b[2K");
    }
    this.liveLines = 0;
  }

  private rerender() {
    if (!this.isTTY) return;
    const now = Date.now();
    if (now - this.lastRender < 100) return;
    this.lastRender = now;
    this.clearLive();

    const fraction = this.opts.total > 0 ? this.completed / this.opts.total : 0;
    const bar = progressBar(fraction);
    const pct = (fraction * 100).toFixed(1);

    let eta = "—";
    if (this.rateWindow.length >= 2) {
      const first = this.rateWindow[0];
      const last = this.rateWindow[this.rateWindow.length - 1];
      const dt = (last.at - first.at) / 1000;
      const dc = last.completed - first.completed;
      if (dt > 0 && dc > 0) {
        const rate = dc / dt;
        const remaining = (this.opts.total - this.completed) / rate;
        eta = formatDuration(remaining * 1000);
      }
    }

    const line1 = `  ${this.completed} / ${this.opts.total}  ${pc.cyan(bar)}  ${pct}%  •  ${formatCost(this.totalCostUsd)}  •  ETA ${eta}`;
    const active = this.opts.total - this.completed - 0; // rough
    const latest = this.latestProgress
      ? `${this.latestProgress.step}${this.latestProgress.companyName ? ` (${this.latestProgress.companyName})` : ""}`
      : "—";
    const line2 = `  ${pc.dim(`Active: ${active} rows  •  Latest: ${latest}`)}`;

    process.stderr.write(line1 + "\n" + line2 + "\n");
    this.liveLines = 2;
  }
}
