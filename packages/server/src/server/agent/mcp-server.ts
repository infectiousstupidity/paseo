import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PASEO_AGENT_TOOL_COMPAT_ALIASES } from "@getpaseo/protocol/agent-tools";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  isJSONRPCResultResponse,
  type CallToolResult,
  type JSONRPCMessage,
  type JSONRPCResultResponse,
  type ServerNotification,
  type ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

import { addModelVisibleStructuredContent } from "./tools/paseo-tool-serialization.js";
import { createPaseoToolCatalog, type PaseoToolHostDependencies } from "./tools/paseo-tools.js";
import type { PaseoToolResult } from "./tools/types.js";

export type AgentMcpServerOptions = PaseoToolHostDependencies;

type McpToolContext = RequestHandlerExtra<ServerRequest, ServerNotification>;

// Servers built here record their COMPAT alias names so connectAgentMcpServer can drop them from
// the tools/list wire response. Filtering the response, not the SDK's list handler, keeps every
// advertised descriptor (inputSchema, outputSchema, annotations, _meta) exactly as the SDK builds it.
const compatToolNamesByServer = new WeakMap<McpServer, ReadonlySet<string>>();

function toMcpToolResult(result: PaseoToolResult): CallToolResult {
  const modelVisibleResult = addModelVisibleStructuredContent(result);
  return {
    content: modelVisibleResult.content as CallToolResult["content"],
    ...(modelVisibleResult.structuredContent !== undefined
      ? {
          structuredContent:
            modelVisibleResult.structuredContent as CallToolResult["structuredContent"],
        }
      : {}),
    ...(modelVisibleResult.isError !== undefined ? { isError: modelVisibleResult.isError } : {}),
  };
}

export async function createAgentMcpServer(options: AgentMcpServerOptions): Promise<McpServer> {
  const catalog = await createPaseoToolCatalog(options);
  const server = new McpServer({
    name: "agent-mcp",
    version: "2.0.0",
  });

  // Retired names are registered so tools/call keeps working for stored call shapes, then kept
  // out of tools/list at connect time; only advertised tools cost prompt tokens.
  for (const tool of [...catalog.tools.values(), ...catalog.compatAliases.values()]) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: unknown, context?: McpToolContext) =>
        toMcpToolResult(await catalog.executeTool(tool.name, args, { signal: context?.signal })),
    );
  }

  compatToolNamesByServer.set(server, new Set(catalog.compatAliases.keys()));

  return server;
}

/**
 * Connects an agent MCP server to a transport, keeping COMPAT alias names out of tools/list.
 * The SDK answers tools/list from every registered tool, so the wire response is filtered on
 * the way out; tools/call for the aliases stays untouched. Callers pass their own
 * per-connection transport, which is wrapped in place before connect.
 */
export async function connectAgentMcpServer(
  server: McpServer,
  transport: Transport,
): Promise<void> {
  const compatToolNames =
    compatToolNamesByServer.get(server) ?? new Set(Object.keys(PASEO_AGENT_TOOL_COMPAT_ALIASES));

  const baseSend = transport.send.bind(transport);
  Object.assign(transport, {
    send: (message: JSONRPCMessage, sendOptions?: TransportSendOptions) =>
      baseSend(stripCompatTools(message, compatToolNames), sendOptions),
  });

  await server.connect(transport);
}

function stripCompatTools(
  message: JSONRPCMessage,
  compatToolNames: ReadonlySet<string>,
): JSONRPCMessage {
  if (!isToolsListResult(message)) {
    return message;
  }
  return {
    ...message,
    result: {
      ...message.result,
      tools: message.result.tools.filter((tool) => !compatToolNames.has(tool.name)),
    },
  };
}

type ToolsListResult = JSONRPCResultResponse & {
  result: { tools: Array<{ name: string }> };
};

function isToolsListResult(message: JSONRPCMessage): message is ToolsListResult {
  if (!isJSONRPCResultResponse(message)) {
    return false;
  }
  const result = (message as { result?: unknown }).result;
  return (
    !!result && typeof result === "object" && Array.isArray((result as { tools?: unknown }).tools)
  );
}
