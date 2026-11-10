import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { MCPServerConfig } from "@brightdata/enrich-core";

const CONFIG_PATH = join(process.cwd(), "data", "mcp-servers.json");

async function loadServers(): Promise<MCPServerConfig[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as MCPServerConfig[];
  } catch {
    return [];
  }
}

async function saveServers(servers: MCPServerConfig[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(servers, null, 2), "utf-8");
}

export async function GET() {
  const servers = await loadServers();
  return Response.json(servers);
}

export async function POST(request: Request) {
  let body: { name?: string; url?: string; transport?: "sse" | "http"; headers?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || !body.url) {
    return Response.json({ error: "name and url are required" }, { status: 400 });
  }

  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  const servers = await loadServers();
  const newServer: MCPServerConfig = {
    id: crypto.randomUUID(),
    name: body.name,
    url: body.url,
    transport: body.transport || "sse",
    ...(body.headers ? { headers: body.headers } : {}),
  };

  servers.push(newServer);
  await saveServers(servers);

  return Response.json(newServer, { status: 201 });
}
