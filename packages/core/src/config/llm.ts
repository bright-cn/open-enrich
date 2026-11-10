import { ChatOpenAI } from "@langchain/openai";
import type { Credentials } from "../credentials";
import type { CostTracker } from "../cost-tracker";

const MODEL = "google/gemini-3-flash-preview";
const BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Create a ChatOpenAI instance configured for OpenRouter.
 * Reuse this everywhere instead of instantiating ChatOpenAI directly.
 *
 * When costTracker is provided, monkey-patches llm.invoke to capture token
 * usage and cost from the OpenRouter response.
 */
export function createLLM(
  credentials: Pick<Credentials, "openRouterApiKey">,
  temperature = 0,
  costTracker?: CostTracker,
) {
  if (!credentials.openRouterApiKey) {
    throw new Error("openRouterApiKey is required");
  }

  const llm = new ChatOpenAI({
    model: MODEL,
    temperature,
    configuration: {
      baseURL: BASE_URL,
    },
    apiKey: credentials.openRouterApiKey,
  });

  if (costTracker) {
    const originalInvoke = llm.invoke.bind(llm);
    llm.invoke = async (...args: Parameters<typeof llm.invoke>) => {
      const result = await originalInvoke(...args);
      const usage = result.usage_metadata;
      if (usage) {
        const rawCost =
          (result.additional_kwargs as Record<string, unknown>)?.cost ??
          (usage as Record<string, unknown>).cost ??
          0;
        const cost = Number(rawCost) || 0;
        costTracker.addLLMCost(
          cost,
          usage.input_tokens ?? 0,
          usage.output_tokens ?? 0
        );
      }
      return result;
    };
  }

  return llm;
}
