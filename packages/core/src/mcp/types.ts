export type MCPTransport = "sse" | "http";

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: MCPTransport;
  headers?: Record<string, string>;
}
