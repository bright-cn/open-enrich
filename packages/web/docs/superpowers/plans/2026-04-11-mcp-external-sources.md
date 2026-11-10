# MCP 外部数据源：实施计划

> <strong>面向智能体式工作进程：</strong>必需的子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，逐项实施此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

<strong>目标：</strong>允许用户连接远程 MCP 服务器作为外部数据源，与现有 Bright Data 工具一同丰富记录。

<strong>架构：</strong>设置面板允许用户添加远程 MCP 服务器 URL。在执行数据丰富时，`@langchain/mcp-adapters` 会连接已配置的服务器，并将其工具转换为 LangChain 工具。新的 `mcp-sources` 图节点使用这些工具运行 ReAct 智能体，并与现有智能体并行执行。结果通过现有的基于置信度的去重归并器合并。

**技术栈：**`@langchain/mcp-adapters`、LangGraph、LangChain ReAct 智能体、Next.js API 路由、React + Tailwind

---

### 任务 1：安装依赖项并添加 AgentStep

**文件：**
- 修改：`package.json`
- 修改：`lib/types/enrichment.ts:60-68`

- [ ] **步骤 1：安装 `@langchain/mcp-adapters`**

```bash
cd /home/meirk/BrightAI/Demos/open-enrich/open-enrich
npm install @langchain/mcp-adapters
```

- [ ] **步骤 2：将 `"mcp"` 添加到 `lib/types/enrichment.ts` 中的 AgentStep 联合类型**

替换第 60-68 行：

```typescript
export type AgentStep =
  | "discovery"
  | "profile"
  | "metrics"
  | "funding"
  | "techstack"
  | "social"
  | "custom"
  | "person"
  | "mcp";
```

- [ ] **步骤 3：提交**

```bash
git add package.json package-lock.json lib/types/enrichment.ts
git commit -m "feat: add @langchain/mcp-adapters dependency and mcp agent step"
```

---

### 任务 2：MCP 客户端管理器

**文件：**
- 创建：`lib/mcp/client-manager.ts`
- 创建：`lib/mcp/types.ts`

- [ ] **步骤 1：创建 `lib/mcp/types.ts`**

```typescript
export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
}
```

- [ ] **步骤 2：创建 `lib/mcp/client-manager.ts`**

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { MCPServerConfig } from "./types";
import { readFile } from "fs/promises";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), "data", "mcp-servers.json");

async function loadConfig(): Promise<MCPServerConfig[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as MCPServerConfig[];
  } catch {
    return [];
  }
}

export class MCPClientManager {
  private client: MultiServerMCPClient | null = null;
  private tools: StructuredToolInterface[] = [];

  async hasServers(): Promise<boolean> {
    const config = await loadConfig();
    return config.length > 0;
  }

  async connect(): Promise<void> {
    const config = await loadConfig();
    if (config.length === 0) return;

    const serverConfig: Record<string, { url: string; transport: "sse"; headers?: Record<string, string> }> = {};
    for (const server of config) {
      serverConfig[server.name] = {
        url: server.url,
        transport: "sse" as const,
        ...(server.headers ? { headers: server.headers } : {}),
      };
    }

    try {
      this.client = new MultiServerMCPClient(serverConfig);
      this.tools = await this.client.getTools();
      console.log(`[mcp] Connected to ${config.length} server(s), ${this.tools.length} tool(s) available`);
    } catch (err) {
      console.warn(`[mcp] Failed to connect:`, err instanceof Error ? err.message : err);
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
```

- [ ] **步骤 3：提交**

```bash
git add lib/mcp/
git commit -m "feat: add MCPClientManager for remote MCP server connections"
```

---

### 任务 3：MCP 数据丰富智能体

**文件：**
- 创建：`lib/agents/mcp-agent.ts`

- [ ] **步骤 1：创建 `lib/agents/mcp-agent.ts`**

它采用与 `profile-agent.ts` 相同的模式：使用 `submitFieldTool` 的 ReAct 智能体，解析来自 `ToolMessage` 实例的结果。

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createLLM } from "@/lib/config/llm";
import type {
  EnrichmentState,
  EnrichmentStateUpdate,
  AgentLog,
} from "@/lib/agents/state";
import { submitFieldTool } from "@/lib/tools/submit-tool";
import { BASE_EXTRACTION_PROMPT } from "@/lib/agents/prompts";
import type { EnrichmentResult } from "@/lib/types/enrichment";

function parseSubmittedFields(messages: unknown[]): EnrichmentResult[] {
  const results: EnrichmentResult[] = [];

  for (const msg of messages) {
    if (!(msg instanceof ToolMessage)) continue;

    try {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      const parsed = JSON.parse(content);

      if (parsed.submitted === true) {
        results.push({
          field: parsed.field,
          value: parsed.value,
          confidence: parsed.confidence,
          source: parsed.sources?.[0]?.url,
          sourceContext: parsed.sources,
          sourceCount: parsed.sources?.length ?? 0,
        });
      }
    } catch {
      // skip unparseable messages
    }
  }

  return results;
}

const MCP_PROMPT = `${BASE_EXTRACTION_PROMPT}

You are the EXTERNAL DATA SOURCES agent. You have access to external data tools connected via MCP servers.
These tools may provide CRM data, company databases, contact directories, or other structured data sources.

STRATEGY:
1. Review the available tools and their descriptions to understand what data each can provide.
2. Call the most relevant tools for the requested fields.
3. Cross-reference data from external sources — if multiple tools return the same field, prefer the one with more detail.
4. Submit each field using submit_field with appropriate confidence based on source reliability.
5. If a tool returns no useful data for a field, do NOT submit that field — let other agents handle it.

IMPORTANT: These are external data sources the user has connected. Treat their data as high-confidence (0.8-1.0) when the data is specific and clearly matches the target company/person.`;

/**
 * MCP enrichment agent: queries user-connected MCP servers for data.
 * Runs in parallel with other enrichment agents.
 * No cost tracking — MCP tools are user-provided.
 */
export async function runMCPAgent(
  state: EnrichmentState,
  mcpTools: StructuredToolInterface[]
): Promise<EnrichmentStateUpdate> {
  if (mcpTools.length === 0) {
    return {
      agentLogs: [],
    };
  }

  const fieldNames = state.requestedFields.map((f) => f.name);

  const llm = createLLM(0);
  const tools = [...mcpTools, submitFieldTool];

  const prompt = MCP_PROMPT +
    `\n\nTARGET COMPANY: ${state.companyName || state.companyNameGuess || "Unknown"}` +
    `\nDOMAIN: ${state.domain || "Unknown"}` +
    (state.companyWebsite ? `\nWEBSITE: ${state.companyWebsite}` : "") +
    (state.personFirstName ? `\nTARGET PERSON: ${state.personFirstName} ${state.personLastName}` : "") +
    `\n\nFIELDS TO FIND: ${fieldNames.join(", ")}` +
    `\n\nWhen you have enough information, use submit_field for EACH field you found data for.`;

  const agent = createReactAgent({
    llm,
    tools,
    prompt,
  });

  try {
    const companyLabel = state.companyName || state.domain || "target";
    const result = await agent.invoke({
      messages: [
        new HumanMessage(
          `Query external data sources for information about "${companyLabel}"` +
            (state.domain ? ` (domain: ${state.domain})` : "") +
            (state.personFirstName ? `. Also look up person: ${state.personFirstName} ${state.personLastName}` : "") +
            `. Find these fields: ${fieldNames.join(", ")}.`
        ),
      ],
    });

    const completedFields = parseSubmittedFields(result.messages);

    return {
      completedFields,
      agentLogs: [
        {
          step: "mcp" as const,
          message: `MCP agent completed — resolved ${completedFields.length} field(s) from external sources.`,
          timestamp: Date.now(),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[mcp-agent] Error:`, message);
    return {
      agentLogs: [
        {
          step: "mcp" as const,
          message: `MCP agent failed: ${message}`,
          timestamp: Date.now(),
        },
      ],
    };
  }
}
```

- [ ] **步骤 2：提交**

```bash
git add lib/agents/mcp-agent.ts
git commit -m "feat: add MCP enrichment agent with ReAct pattern"
```

---

### 任务 4：将 MCP 节点接入数据丰富图

**文件：**
- 修改：`lib/agents/graph.ts`
- 修改：`app/api/enrich/route.ts`

- [ ] **步骤 1：向 `lib/agents/graph.ts` 添加 `mcp-sources` 节点**

在顶部添加导入：

```typescript
import { runMCPAgent } from "./mcp-agent";
import type { StructuredToolInterface } from "@langchain/core/tools";
```

在 `person` 节点之后（第 53 行之后）、`validate` 之前添加新节点：

```typescript
    .addNode("mcp-sources", async (state: EnrichmentState, config) => {
      const mcpTools = (config?.configurable?.mcpTools ?? []) as StructuredToolInterface[];
      if (mcpTools.length === 0) return { agentLogs: [] };
      onProgress?.({
        rowIndex: 0,
        step: "mcp",
        message: `Querying external data sources (${mcpTools.length} tool(s))...`,
      });
      return runMCPAgent(state, mcpTools);
    })
```

添加边：`mcp-sources` 与 `enrich` 和 `person` 并行运行，并将结果送入 `validate`：

替换现有边部分（第 66-72 行）：

```typescript
    .addEdge(START, "discovery")
    .addEdge("discovery", "enrich")
    .addEdge("discovery", "person")
    .addEdge("discovery", "mcp-sources")
    .addEdge("enrich", "validate")
    .addEdge("person", "validate")
    .addEdge("mcp-sources", "validate")
    .addEdge("validate", "custom")
    .addEdge("custom", END);
```

- [ ] **步骤 2：更新 `app/api/enrich/route.ts` 以连接 MCP 并传递工具**

在顶部添加导入：

```typescript
import { MCPClientManager } from "@/lib/mcp/client-manager";
```

在 `start(controller)` 函数中，于 `onProgress` 回调之后、构建图之前（约第 92 行）添加 MCP 连接：

```typescript
      // Connect to MCP servers if configured
      let mcpManager: MCPClientManager | null = null;
      let mcpTools: import("@langchain/core/tools").StructuredToolInterface[] = [];
      try {
        mcpManager = new MCPClientManager();
        if (await mcpManager.hasServers()) {
          await mcpManager.connect();
          mcpTools = mcpManager.getTools();
        }
      } catch (err) {
        console.warn("[api/enrich] MCP connection failed:", err instanceof Error ? err.message : err);
      }
```

在 `processRow` 函数中，更新 `graph.invoke`，通过 configurable 传递 `mcpTools`。找到现有的 `graph.invoke` 调用，并将 `mcpTools` 添加到 configurable 对象：

```typescript
      const state = await graph.invoke(
        { /* existing state object — keep all fields */ },
        { configurable: { costTracker, mcpTools } }
      );
```

流循环完成后（`send({ type: "complete", ... })` 之后），关闭 MCP 连接：

```typescript
      // Clean up MCP connections
      if (mcpManager) {
        await mcpManager.close();
      }
```

- [ ] **步骤 3：确认 TypeScript 编译成功**

```bash
cd /home/meirk/BrightAI/Demos/open-enrich/open-enrich && npx tsc --noEmit
```

- [ ] **步骤 4：提交**

```bash
git add lib/agents/graph.ts app/api/enrich/route.ts
git commit -m "feat: wire MCP agent node into enrichment graph"
```

---

### 任务 5：MCP 服务器 API 路由

**文件：**
- 创建：`app/api/mcp-servers/route.ts`
- 创建：`app/api/mcp-servers/[id]/route.ts`
- 创建：`app/api/mcp-servers/test/route.ts`

- [ ] **步骤 1：创建 `app/api/mcp-servers/route.ts`（GET + POST）**

```typescript
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { MCPServerConfig } from "@/lib/mcp/types";

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
  let body: { name?: string; url?: string; headers?: Record<string, string> };
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
    ...(body.headers ? { headers: body.headers } : {}),
  };

  servers.push(newServer);
  await saveServers(servers);

  return Response.json(newServer, { status: 201 });
}
```

- [ ] **步骤 2：创建 `app/api/mcp-servers/[id]/route.ts`（DELETE）**

```typescript
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { MCPServerConfig } from "@/lib/mcp/types";
import { type NextRequest } from "next/server";

const CONFIG_PATH = join(process.cwd(), "data", "mcp-servers.json");

async function loadServers(): Promise<MCPServerConfig[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as MCPServerConfig[];
  } catch {
    return [];
  }
}

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
```

- [ ] **步骤 3：创建 `app/api/mcp-servers/test/route.ts`（POST）**

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

export async function POST(request: Request) {
  let body: { url?: string; headers?: Record<string, string> };
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
        transport: "sse" as const,
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
```

- [ ] **步骤 4：提交**

```bash
git add app/api/mcp-servers/
git commit -m "feat: add API routes for MCP server management"
```

---

### 任务 6：MCP 设置面板 UI

**文件：**
- 创建：`components/mcp-settings-panel.tsx`
- 修改：`components/header.tsx`
- 修改：`app/page.tsx`

- [ ] **步骤 1：创建 `components/mcp-settings-panel.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MCPServer {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
}

interface MCPSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MCPSettingsPanel({ open, onClose }: MCPSettingsPanelProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp-servers");
      if (res.ok) setServers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchServers();
  }, [open, fetchServers]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {};
      if (authHeader) headers["Authorization"] = authHeader;

      const res = await fetch("/api/mcp-servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, headers: Object.keys(headers).length ? headers : undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: `Connected — ${data.toolCount} tool(s) available` });
      } else {
        setTestResult({ success: false, message: data.error || "Connection failed" });
      }
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const headers: Record<string, string> = {};
      if (authHeader) headers["Authorization"] = authHeader;

      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, headers: Object.keys(headers).length ? headers : undefined }),
      });
      if (res.ok) {
        setName("");
        setUrl("");
        setAuthHeader("");
        setTestResult(null);
        setShowAdd(false);
        fetchServers();
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/mcp-servers/${id}`, { method: "DELETE" });
    fetchServers();
  };

  if (!open) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-[#0a1628]/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0b1022] border-l border-[rgba(165,180,220,0.08)] z-50 flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(165,180,220,0.06)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#f0f2f8] tracking-tight">
            External Data Sources
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-xs text-[rgba(240,242,248,0.4)]">
            Connect MCP servers to enrich records from external databases, CRMs, and other data sources.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[rgba(240,242,248,0.3)]" />
            </div>
          ) : servers.length === 0 && !showAdd ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[rgba(240,242,248,0.35)]">
                No data sources connected
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.06)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#f0f2f8] truncate">
                      {server.name}
                    </p>
                    <p className="text-[11px] text-[rgba(240,242,248,0.3)] font-mono truncate">
                      {server.url}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="p-1.5 rounded-lg text-[rgba(240,242,248,0.3)] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.08)] transition-all duration-200 ml-2 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Company CRM"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                    Server URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://mcp-server.example.com/sse"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.4)] mb-1.5">
                    Authorization header (optional)
                  </label>
                  <input
                    type="password"
                    value={authHeader}
                    onChange={(e) => setAuthHeader(e.target.value)}
                    placeholder="Bearer your-token"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] text-sm text-[#f0f2f8] placeholder-[rgba(240,242,248,0.2)] focus:border-[rgba(75,139,255,0.5)] focus:outline-none transition-colors font-mono text-xs"
                  />
                </div>

                {testResult && (
                  <div
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                      testResult.success
                        ? "bg-[rgba(52,211,153,0.08)] text-[#34D399]"
                        : "bg-[rgba(248,113,113,0.08)] text-[#F87171]"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <AlertCircle size={14} />
                    )}
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTest}
                    disabled={!url || testing}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-[rgba(165,180,220,0.1)] text-[rgba(240,242,248,0.6)] hover:text-[#f0f2f8] hover:border-[rgba(165,180,220,0.2)] disabled:opacity-40 transition-all duration-200 inline-flex items-center gap-1.5"
                  >
                    {testing && <Loader2 size={12} className="animate-spin" />}
                    Test Connection
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!name || !url || adding}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-[#4B8BFF] text-white hover:bg-[#3A6FE0] disabled:opacity-40 transition-all duration-200 inline-flex items-center gap-1.5"
                  >
                    {adding && <Loader2 size={12} className="animate-spin" />}
                    Add Server
                  </button>
                  <button
                    onClick={() => {
                      setShowAdd(false);
                      setName("");
                      setUrl("");
                      setAuthHeader("");
                      setTestResult(null);
                    }}
                    className="px-3 py-2 text-xs text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!showAdd && (
          <div className="px-6 py-4 border-t border-[rgba(165,180,220,0.06)]">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-[rgba(165,180,220,0.1)] text-[rgba(240,242,248,0.6)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] hover:border-[rgba(165,180,220,0.15)] transition-all duration-200 active:scale-[0.98]"
            >
              <Plus size={16} />
              Add Data Source
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
```

- [ ] **步骤 2：向 `components/header.tsx` 添加齿轮图标**

从 lucide-react 添加 `Settings` 导入，并接受一个 `onSettingsClick` 属性：

```typescript
import { GitBranch, Settings } from "lucide-react";
```

更新组件以接受该属性：

```typescript
interface HeaderProps {
  onSettingsClick?: () => void;
}

export default function Header({ onSettingsClick }: HeaderProps) {
```

在 `<nav>` 部分、GitHub 链接之前添加设置按钮：

```tsx
        <nav className="flex items-center gap-1">
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-lg text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
            >
              <Settings size={18} />
            </button>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-[rgba(240,242,248,0.4)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
          >
            <GitBranch size={18} />
          </a>
        </nav>
```

- [ ] **步骤 3：将设置面板接入 `app/page.tsx`**

添加导入：

```typescript
import { MCPSettingsPanel } from "@/components/mcp-settings-panel";
```

添加状态（靠近其他 useState 调用）：

```typescript
const [settingsOpen, setSettingsOpen] = useState(false);
```

更新 Header 以传入回调：

```tsx
<Header onSettingsClick={() => setSettingsOpen(true)} />
```

在组件底部、根 div 内、闭合 `</div>` 之前渲染面板：

```tsx
<MCPSettingsPanel
  open={settingsOpen}
  onClose={() => setSettingsOpen(false)}
/>
```

- [ ] **步骤 4：确认 TypeScript 编译成功**

```bash
cd /home/meirk/BrightAI/Demos/open-enrich/open-enrich && npx tsc --noEmit
```

- [ ] **步骤 5：提交**

```bash
git add components/mcp-settings-panel.tsx components/header.tsx app/page.tsx
git commit -m "feat: add MCP settings panel with server management UI"
```

---

### 任务 7：为进度显示添加 MCP 步骤颜色

**文件：**
- 修改：`components/enrichment-progress.tsx`

- [ ] **步骤 1：在 `components/enrichment-progress.tsx` 中添加 MCP 步骤颜色**

找到 `stepColors` 对象（约第 22-31 行），并为 `mcp` 添加条目：

```typescript
mcp: "text-[#60A5FA]",  // blue, matching the info color
```

- [ ] **步骤 2：提交**

```bash
git add components/enrichment-progress.tsx
git commit -m "feat: add MCP step color to enrichment progress display"
```

---

### 任务 8：验证与测试

**文件：**
- 所有修改过的文件

- [ ] **步骤 1：创建 `data/` 目录和空配置**

```bash
mkdir -p /home/meirk/BrightAI/Demos/open-enrich/open-enrich/data
echo "[]" > /home/meirk/BrightAI/Demos/open-enrich/open-enrich/data/mcp-servers.json
```

- [ ] **步骤 2：将 `data/` 添加到 `.gitignore`**

追加到 `.gitignore`：

```
# MCP server config (contains credentials)
data/
```

- [ ] **步骤 3：运行 TypeScript 编译**

```bash
cd /home/meirk/BrightAI/Demos/open-enrich/open-enrich && npx tsc --noEmit
```

预期结果：无错误

- [ ] **步骤 4：运行开发服务器并验证**

```bash
cd /home/meirk/BrightAI/Demos/open-enrich/open-enrich && npm run dev
```

手动测试清单：
1. 点击页眉中的齿轮图标：设置面板滑入
2. 面板显示“未连接任何数据源”
3. 点击“添加数据源”：显示表单
4. 输入测试 URL 并点击“测试连接”：应显示错误（没有真实的 MCP 服务器）
5. 关闭面板：面板滑出
6. 在没有 MCP 服务器的情况下运行数据丰富：其行为应与之前完全一致（静默跳过）

- [ ] **步骤 5：最终提交**

```bash
git add .gitignore data/mcp-servers.json
git commit -m "feat: add data directory and gitignore for MCP config"
```
