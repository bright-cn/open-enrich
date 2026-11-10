import { z } from "zod";
import { runEnrichment, type Credentials } from "@brightdata/enrich-core";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { MCPClientManager, loadMCPConfig } from "@/lib/mcp/client-manager";
import { isDemoMode } from "@/lib/demo-mode/config";
import {
  getClientIp,
  checkAndReserveQuota,
  type QuotaResult,
} from "@/lib/demo-mode/quota";

export const maxDuration = 300; // 5 min for Vercel

const MAX_ROWS = 100;
const MAX_FIELDS = 20;

const requestSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1),
  fields: z
    .array(
      z.object({
        name: z.string(),
        displayName: z.string(),
        description: z.string(),
        type: z.enum(["string", "number", "boolean", "array"]),
        required: z.boolean(),
        category: z
          .enum([
            "icp_qualification",
            "buying_signals",
            "personalization",
            "contact_data",
            "social_web",
            "custom",
          ])
          .optional(),
      }),
    )
    .min(1),
  emailColumn: z.string(),
  nameColumn: z.string().optional(),
  firstNameColumn: z.string().optional(),
  lastNameColumn: z.string().optional(),
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

  const { rows, fields, emailColumn, firstNameColumn, lastNameColumn } = parsed.data;

  if (rows.length > MAX_ROWS) {
    return Response.json({ error: `Max ${MAX_ROWS} rows allowed` }, { status: 400 });
  }
  if (fields.length > MAX_FIELDS) {
    return Response.json({ error: `Max ${MAX_FIELDS} fields allowed` }, { status: 400 });
  }

  // Demo-mode quota gate. Reserves rows up-front: the counter increments by
  // the number of rows we accept (post-trim), not the number requested.
  let quotaPartialEvent: { type: "quota_partial"; granted: number; requested: number } | null =
    null;
  if (isDemoMode()) {
    const ip = getClientIp(request);
    let result: QuotaResult;
    try {
      result = await checkAndReserveQuota(ip, rows.length);
    } catch (err) {
      console.error("[api/enrich] demo-mode quota check failed:", err);
      return Response.json({ error: "demo_quota_unavailable" }, { status: 503 });
    }
    if (result.status === "blocked") {
      return Response.json(
        { error: "demo_limit_reached", code: "DEMO_LIMIT_REACHED" },
        { status: 429 },
      );
    }
    if (result.status === "partial") {
      console.log(
        `[api/enrich] demo-mode partial: ip=${ip} granted=${result.granted} requested=${result.requested}`,
      );
      rows.length = result.granted;
      quotaPartialEvent = {
        type: "quota_partial",
        granted: result.granted,
        requested: result.requested,
      };
    }
  }

  console.log("[api/enrich] Request received:");
  console.log("[api/enrich]   rows:", rows.length);
  console.log(
    "[api/enrich]   fields:",
    fields.map((f) => f.name),
  );
  console.log("[api/enrich]   emailColumn:", emailColumn);

  // Build credentials from env at the web boundary; engine code never reads env.
  const credentials: Credentials = {
    brightDataApiKey: process.env.BRIGHT_DATA_API_KEY ?? "",
    brightDataSerpZone: process.env.BRIGHT_DATA_SERP_ZONE ?? "",
    brightDataUnlockerZone: process.env.BRIGHT_DATA_UNLOCKER_ZONE ?? "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  };

  // Connect to MCP servers if configured.
  let mcpManager: MCPClientManager | null = null;
  let mcpTools: StructuredToolInterface[] = [];
  try {
    const mcpConfig = await loadMCPConfig();
    mcpManager = new MCPClientManager(mcpConfig);
    if (mcpManager.hasServers()) {
      await mcpManager.connect();
      mcpTools = mcpManager.getTools();
    }
  } catch (err) {
    console.warn(
      "[api/enrich] MCP connection failed:",
      err instanceof Error ? err.message : err,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      if (quotaPartialEvent) {
        send(quotaPartialEvent);
      }

      try {
        for await (const event of runEnrichment({
          rows,
          fields,
          identifierColumn: emailColumn,
          firstNameColumn,
          lastNameColumn,
          credentials,
          mcpTools,
        })) {
          send(event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[api/enrich] runEnrichment error:", message);
        send({ type: "error", rowIndex: -1, error: message });
      } finally {
        if (mcpManager) {
          await mcpManager.close();
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
