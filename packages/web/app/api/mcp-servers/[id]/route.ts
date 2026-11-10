import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { MCPServerConfig } from "@brightdata/enrich-core";
import { type NextRequest } from "next/server";

const CONFIG_PATH = join(process.cwd(), "data", "mcp-servers.json");

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let servers: MCPServerConfig[];
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    servers = JSON.parse(raw) as MCPServerConfig[];
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filtered = servers.filter((s) => s.id !== id);
  if (filtered.length === servers.length) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await writeFile(CONFIG_PATH, JSON.stringify(filtered, null, 2), "utf-8");
  return Response.json({ success: true });
}
