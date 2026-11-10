import {
  PRESET_FIELDS,
  generateFieldsFromPrompt,
  type EnrichmentField,
  type Credentials,
} from "@brightdata/enrich-core";

export class UnknownFieldsError extends Error {
  constructor(public unknown: string[]) {
    super(`Unknown field names: ${unknown.join(", ")}`);
  }
}

export function resolveFieldsByName(names: string[]): EnrichmentField[] {
  const map = new Map(PRESET_FIELDS.map((f) => [f.name, f]));
  const unknown: string[] = [];
  const out: EnrichmentField[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    const f = map.get(trimmed);
    if (f) out.push(f);
    else unknown.push(trimmed);
  }
  if (unknown.length > 0) throw new UnknownFieldsError(unknown);
  return out;
}

const STOPWORDS = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "company", "companies"]);

export function resolveFieldsByDescription(description: string): { fields: EnrichmentField[]; matched: boolean } {
  const tokens = description.toLowerCase().split(/[\s,;]+/).filter((t) => t && !STOPWORDS.has(t));
  if (tokens.length === 0) return { fields: [], matched: false };

  const scores = new Map<string, number>();
  for (const field of PRESET_FIELDS) {
    const haystack = `${field.name} ${field.displayName} ${field.description}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (haystack.includes(t)) score += 1;
    }
    if (score > 0) scores.set(field.name, score);
  }

  const top = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, s]) => s >= 2)
    .slice(0, 8)
    .map(([name]) => name);

  if (top.length >= 2) {
    return { fields: resolveFieldsByName(top), matched: true };
  }
  return { fields: [], matched: false };
}

export async function resolveFields(
  args: { describe?: string; fields?: string },
  credentials: Pick<Credentials, "openRouterApiKey">,
): Promise<{ fields: EnrichmentField[]; source: "preset-names" | "preset-match" | "llm" }> {
  if (args.fields) {
    return { fields: resolveFieldsByName(args.fields.split(",")), source: "preset-names" };
  }
  if (args.describe) {
    const match = resolveFieldsByDescription(args.describe);
    if (match.matched) return { fields: match.fields, source: "preset-match" };
    const generated = await generateFieldsFromPrompt(args.describe, credentials);
    return { fields: generated.fields, source: "llm" };
  }
  throw new Error("Either --describe or --fields must be provided");
}
