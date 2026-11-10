import { z } from "zod";
import { createLLM } from "../config/llm";
import type { Credentials } from "../credentials";
import type { EnrichmentField } from "../types/enrichment";

// NOTE: The category enum used here ("company", "metrics", "funding", "technology",
// "social", "custom") differs from the canonical FieldCategory type in types/enrichment.ts
// ("icp_qualification", "buying_signals", "personalization", "contact_data", "social_web",
// "custom"). This mismatch exists in the original route and is preserved here intentionally —
// it is tracked as a concern in Task 2.6.
const fieldSchema = z.object({
  fields: z.array(
    z.object({
      name: z.string(),
      displayName: z.string(),
      description: z.string(),
      type: z.enum(["string", "number", "boolean", "array"]),
      required: z.boolean(),
      category: z.enum([
        "company",
        "metrics",
        "funding",
        "technology",
        "social",
        "custom",
      ]),
    })
  ),
  interpretation: z.string(),
});

const SYSTEM_PROMPT = `You are a data enrichment field designer. Given a natural language request, generate a list of structured enrichment fields.

Rules:
- Each field should represent ONE distinct data point
- Use snake_case for field names
- Choose the most appropriate type (string, number, boolean, array)
- Categorize each field: company, metrics, funding, technology, social, or custom
- Include a clear, concise description for each field
- Return an "interpretation" summarizing what you understood from the request

Respond with valid JSON matching this schema:
{
  "fields": [{ "name": "...", "displayName": "...", "description": "...", "type": "string|number|boolean|array", "required": true|false, "category": "..." }],
  "interpretation": "..."
}`;

export interface GeneratedFields {
  fields: EnrichmentField[];
  interpretation: string;
}

export async function generateFieldsFromPrompt(
  prompt: string,
  credentials: Pick<Credentials, "openRouterApiKey">,
): Promise<GeneratedFields> {
  const llm = createLLM({ openRouterApiKey: credentials.openRouterApiKey } as Credentials);
  const response = await llm.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ]);

  const text =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() ?? text.trim();

  const data = fieldSchema.parse(JSON.parse(jsonStr));

  return {
    fields: data.fields as EnrichmentField[],
    interpretation: data.interpretation,
  };
}
