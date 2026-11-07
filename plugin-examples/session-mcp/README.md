# Scoped session MCP server

This example adds an HTTP MCP server named `company` only to agents with label
`company/mcp-enabled: "true"`. Edit `COMPANY_MCP_URL` in `index.server.ts` to point
to a **real** MCP server; the checked-in URL is a placeholder.

Install on a daemon with plugins enabled:

```bash
paseo plugin install /absolute/path/to/plugin-examples/session-mcp
```

Select agents by setting their labels at creation or updating labels and reloading the session.
The MCP server is launch-only: it does not change the saved agent configuration, and it is
removed on the next idle reopen after this plugin is disabled. Active turns are not interrupted.
The session open fails if the provider lacks MCP support or if `company` is already defined
by the agent or another plugin. Do not use `paseo`, which is reserved for the internal server.

See [session tool/MCP contributions](../../skills/paseo-plugin/references/rpc-and-sdk.md#scoped-agent-tools-and-session-mcp-servers).
