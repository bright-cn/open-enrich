import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { MCPServerConfig } from "@brightdata/enrich-core";

export class MCPClientManager {
  private client: MultiServerMCPClient | null = null;
  private tools: StructuredToolInterface[] = [];

  constructor(private config: MCPServerConfig[]) {}

  hasServers(): boolean {
    return this.config.length > 0;
  }

  async connect(): Promise<void> {
    if (this.config.length === 0) return;

    const serverConfig: Record<
      string,
      { url: string; transport: "sse" | "http"; headers?: Record<string, string> }
    > = {};
    for (const server of this.config) {
      serverConfig[server.name] = {
        url: server.url,
        transport: server.transport || "sse",
        ...(server.headers ? { headers: server.headers } : {}),
      };
    }

    try {
      this.client = new MultiServerMCPClient(serverConfig);
      this.tools = await this.client.getTools();
      console.log(
        `[mcp] Connected to ${this.config.length} server(s), ${this.tools.length} tool(s) available`,
      );
    } catch (err) {
      console.warn(
        `[mcp] Failed to connect:`,
        err instanceof Error ? err.message : err,
      );
      this.tools = [];
    }
  }

  getTools(): StructuredToolInterface[] {
    return this.tools;
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors
      }
      this.client = null;
      this.tools = [];
    }
  }
}

// Web-only file-system loader — intentional process.cwd() usage
import { readFile } from "fs/promises";
import { join } from "path";

export async function loadMCPConfig(): Promise<MCPServerConfig[]> {
  try {
    const raw = await readFile(
      join(process.cwd(), "data", "mcp-servers.json"),
      "utf-8",
    );
    return JSON.parse(raw) as MCPServerConfig[];
  } catch {
    return [];
  }
}
