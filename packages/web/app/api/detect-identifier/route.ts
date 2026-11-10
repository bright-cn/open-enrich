import { z } from "zod";
import { detectIdentifierColumn } from "@brightdata/enrich-core";

const requestSchema = z.object({
  headers: z.array(z.string()),
  sampleRows: z.array(z.record(z.string(), z.string())),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sampleRows } = parsed.data;

  try {
    const result = await detectIdentifierColumn(sampleRows, {
      credentials: { openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "" },
      useLLMFallback: true,
    });

    return Response.json({
      column: result.column,
      type: result.type,
      confidence: result.confidence,
      reasoning: result.reasoning ?? "",
    });
  } catch (err) {
    console.error("[detect-identifier] error:", err);
    return Response.json(
      { error: "Detection failed", column: null, type: "unknown", confidence: 0, reasoning: "" },
      { status: 200 }, // Return 200 so the client can fall back gracefully
    );
  }
}
