import type { PluginServerContext } from "@getpaseo/plugin/server";

// Replace this placeholder with a reachable MCP server before installing.
const COMPANY_MCP_URL = "https://tools.example.com/mcp";

export default function contribute(server: PluginServerContext) {
  server.before("agent.session_open", ({ request }) => {
    if (request.labels["company/mcp-enabled"] !== "true") return;
    return {
      ...request,
      mcpServers: {
        ...request.mcpServers,
        company: { type: "http", url: COMPANY_MCP_URL },
      },
    };
  });
  return () => {};
}
