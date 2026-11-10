# MCP 外部数据源：设计规范

## 概述

支持连接远程 MCP（模型上下文协议）服务器，并将其用作数据丰富的外部数据源。用户可通过设置面板配置 MCP 服务器连接。专用图节点会与现有智能体并行查询 MCP 工具，并通过现有基于置信度的去重机制合并结果。

## 约束

- **仅限远程 MCP**：SSE/可流式 HTTP 传输。为避免繁重的 npm 依赖和计算开销，不支持本地/stdio MCP 服务器。
- **不跟踪成本**：MCP 工具调用不计入 CostTracker。MCP 服务器由用户提供，其成本结构未知。
- **静默跳过**：未配置 MCP 服务器时，MCP 节点不会运行，UI 中也不会显示任何提示。
- **无需重启**：每次开始数据丰富时都会重新读取配置。

## 架构

### 软件包依赖

`@langchain/mcp-adapters`：LangChain 官方软件包，用于连接远程 MCP 服务器，并将其工具转换为标准 LangChain `StructuredTool` 实例。

### MCP 客户端管理器

`lib/mcp/client-manager.ts`：管理与已配置 MCP 服务器的连接。

**配置文件：** `data/mcp-servers.json`

```json
[
  {
    "id": "crm-data",
    "name": "Company CRM",
    "url": "https://my-crm-mcp.example.com/sse",
    "headers": { "Authorization": "Bearer xxx" }
  }
]
```

**类：`MCPClientManager`**

- `constructor()`：从 `data/mcp-servers.json` 读取配置
- `connect()`：使用 SSE 传输，通过 `@langchain/mcp-adapters` 初始化 `MultiServerMCPClient`，覆盖所有已配置的服务器。如果某台服务器无法访问，则记录警告并继续连接其他服务器。
- `getTools(): StructuredTool[]`：返回来自所有已连接服务器的 LangChain 工具扁平数组
- `close()`：断开所有客户端
- `hasServers(): boolean`：如果配置了任何服务器，则返回 true（连接前）

<strong>错误处理：</strong>连接失败绝不会阻塞数据丰富。无法访问的服务器会被跳过，并记录警告日志。

### MCP 智能体图节点

在 `lib/agents/graph.ts` 中新增一个 `mcp-sources` 节点。

**更新后的流程：**
```
START → discovery → (enrich + person + mcp-sources) → validate → custom → END
```

**节点行为：**
1. 接收来自 `config.configurable.mcpTools` 的 MCP 工具（由 API 路由传入）
2. 如果没有 MCP 工具：立即返回空结果（静默跳过）
3. 使用 MCP 工具和 `submitFieldTool` 创建 ReAct 智能体
4. 系统提示词包含：公司名称、域名、网站、人员姓名、请求字段
5. 智能体使用 MCP 工具查询外部来源，并通过 `submitFieldTool` 提交发现结果
6. 不跟踪成本：不会将 CostTracker 传给此节点

<strong>智能体实现：</strong>新增文件 `lib/agents/mcp-agent.ts`，遵循与 `profile-agent.ts` 相同的模式（使用 `submitFieldTool` 的 ReAct 智能体）。

<strong>结果合并：</strong>现有 `completedFields` reducer 负责去重，即保留每个字段中置信度最高的值。如果网页智能体和 MCP 智能体发现了同一字段，则采用较好的结果。

### 连接生命周期

1. 数据丰富请求到达 API 路由
2. 路由读取 `data/mcp-servers.json`：如果为空或缺失，则完全跳过 MCP
3. 如果配置了服务器：创建 `MCPClientManager`，调用 `connect()` 并获取工具
4. 通过 `graph.invoke(..., { configurable: { mcpTools } })` 传递 MCP 工具
5. 同一批次中的所有行共享相同的 MCP 客户端连接
6. 流结束后：调用 `manager.close()`

### 设置 UI

**设置面板**：通过页眉中 GitHub 图标旁的齿轮图标触发的滑入式面板。

**组件：**
- `components/mcp-settings-panel.tsx`：滑入式面板（与 `EnrichmentReportPanel` 采用相同模式）
  - 已配置服务器列表（名称、URL、状态、删除按钮）
  - 添加服务器表单（名称、URL、可选的身份验证标头）
  - “测试连接”按钮：连接服务器，成功后显示工具数量
  - “添加”按钮：保存到配置

**API 路由：**
- `GET /api/mcp-servers`：读取配置并返回服务器列表
- `POST /api/mcp-servers`：添加服务器（为 id 生成 UUID）
- `DELETE /api/mcp-servers/[id]`：按 id 移除服务器
- `POST /api/mcp-servers/test`：测试与 URL 的连接并返回 `{ success, toolCount, toolNames, error }`

<strong>配置持久化：</strong>使用位于 `data/mcp-servers.json` 的简单 JSON 文件。首次写入时自动创建。每次运行数据丰富任务时都会重新读取，无需重启。

<strong>设计：</strong>深色表面、细微边框，与现有面板保持一致。齿轮图标采用与页眉中 GitHub 图标相同的样式。

## 要创建的文件

- `lib/mcp/client-manager.ts`：MCPClientManager 类
- `lib/agents/mcp-agent.ts`：MCP 数据丰富智能体（ReAct 模式）
- `components/mcp-settings-panel.tsx`：设置 UI 面板
- `app/api/mcp-servers/route.ts`：用于服务器列表的 GET + POST
- `app/api/mcp-servers/[id]/route.ts`：用于移除服务器的 DELETE
- `app/api/mcp-servers/test/route.ts`：用于测试连接的 POST

## 要修改的文件

- `lib/agents/graph.ts`：添加 `mcp-sources` 节点、从 discovery 指向该节点的边，以及从该节点指向 validate 的边
- `app/api/enrich/route.ts`：创建 MCPClientManager、连接、传递工具并在流结束后关闭
- `components/header.tsx`：添加用于打开设置面板的齿轮图标按钮
- `app/page.tsx`：使用打开/关闭状态渲染 MCPSettingsPanel
- `package.json`：添加 `@langchain/mcp-adapters` 依赖

## 范围之外

- 本地/stdio MCP 服务器
- MCP 调用的成本跟踪
- 为每次数据丰富任务选择 MCP 服务器（始终使用所有已配置的服务器）
- MCP 资源/提示词模板支持（仅支持工具）
- 除自定义标头外的身份验证（不支持 OAuth、API 密钥轮换等）
