import { z } from "zod";
import { generateFieldsFromPrompt } from "@brightdata/enrich-core";

const requestSchema = z.object({
  prompt: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await generateFieldsFromPrompt(parsed.data.prompt, {
      openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
    });
    return Response.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { success: false, error: `Field generation failed: ${message}` },
      { status: 500 },
    );
  }
}
