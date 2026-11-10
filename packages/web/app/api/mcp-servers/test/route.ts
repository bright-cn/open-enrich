import { MultiServerMCPClient } from "@langchain/mcp-adapters";

export async function POST(request: Request) {
  let body: { url?: string; transport?: "sse" | "http"; headers?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const client = new MultiServerMCPClient({
      test: {
        url: body.url,
        transport: (body.transport || "sse") as "sse" | "http",
        ...(body.headers ? { headers: body.headers } : {}),
      },
    });

    const tools = await client.getTools();
    const toolNames = tools.map((t) => t.name);

    await client.close();

    return Response.json({
      success: true,
      toolCount: tools.length,
      toolNames,
    });
  } catch (err) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }
}
