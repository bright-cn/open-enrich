import { tool } from "@langchain/core/tools";
import { z } from "zod";

const sourceSchema = z.object({
  url: z.string().describe("Source URL where the data was found"),
  snippet: z.string().describe("Exact text quote supporting the value"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence for this specific source"),
});

export const submitFieldTool = tool(
  async (input) => {
    // This tool's output is consumed by the orchestrator to build
    // the final enrichment result. It doesn't perform side effects.
    return JSON.stringify({
      submitted: true,
      field: input.field,
      value: input.value,
      confidence: input.confidence,
      sources: input.sources,
    });
  },
  {
    name: "submit_field",
    description:
      "Submit a resolved enrichment field with its value, confidence score, and sources. " +
      "Call this once for each field you have successfully researched. " +
      "Only submit data that is explicitly stated in your sources — never guess or infer. " +
      "If you cannot find reliable data for a field, submit it with value null and confidence 0.",
    schema: z.object({
      field: z.string().describe("The enrichment field name being submitted"),
      value: z
        .union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.string()),
          z.null(),
        ])
        .describe("The extracted value, or null if not found"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe(
          "Confidence score: 1.0 = explicit statement, 0.8 = clearly present, " +
          "0.5 = requires interpretation, 0.3 = unclear, 0.0 = not found"
        ),
      sources: z
        .array(sourceSchema)
        .describe("Sources supporting this value (at least one if value is not null)"),
    }),
  }
);
