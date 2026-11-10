import type { RowCost } from "./types/enrichment";
import type { StructuredToolInterface } from "@langchain/core/tools";

const BRIGHT_DATA_COST_PER_CALL = 0.0015;

export class CostTracker {
  private llmCost = 0;
  private llmTokensIn = 0;
  private llmTokensOut = 0;
  private toolCalls = 0;
  private onChange?: (cost: RowCost) => void;

  constructor(onChange?: (cost: RowCost) => void) {
    this.onChange = onChange;
  }

  addLLMCost(cost: number, tokensIn: number, tokensOut: number) {
    this.llmCost += cost;
    this.llmTokensIn += tokensIn;
    this.llmTokensOut += tokensOut;
    this.onChange?.(this.snapshot());
  }

  addToolCall() {
    this.toolCalls += 1;
    this.onChange?.(this.snapshot());
  }

  snapshot(): RowCost {
    const toolCost = this.toolCalls * BRIGHT_DATA_COST_PER_CALL;
    return {
      llmCost: this.llmCost,
      llmTokensIn: this.llmTokensIn,
      llmTokensOut: this.llmTokensOut,
      toolCalls: this.toolCalls,
      toolCost,
      totalCost: this.llmCost + toolCost,
    };
  }

  reset() {
    this.llmCost = 0;
    this.llmTokensIn = 0;
    this.llmTokensOut = 0;
    this.toolCalls = 0;
    this.onChange?.(this.snapshot());
  }
}

/**
 * Wrap a LangChain tool to count invocations on a CostTracker.
 */
export function withCostTracking<T extends StructuredToolInterface>(
  originalTool: T,
  tracker: CostTracker
): T {
  const wrapped = Object.create(originalTool);
  wrapped.invoke = async (...args: Parameters<typeof originalTool.invoke>) => {
    tracker.addToolCall();
    return originalTool.invoke(...args);
  };
  return wrapped as T;
}
