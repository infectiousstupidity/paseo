/** Retired agent tool names that remain callable during the MCP catalog migration. */
export const PASEO_AGENT_TOOL_COMPAT_ALIASES = {
  get_agent_status: "inspect_agent",
  get_agent_activity: "inspect_agent",
  set_agent_mode: "update_agent",
  cancel_agent: "terminate_agent",
  kill_agent: "terminate_agent",
  list_terminals: "inspect_terminal",
  capture_terminal: "inspect_terminal",
  list_workspace_scripts: "workspace_scripts",
  start_workspace_script: "workspace_scripts",
  stop_workspace_script: "workspace_scripts",
} as const;

export type PaseoAgentToolCompatAlias = keyof typeof PASEO_AGENT_TOOL_COMPAT_ALIASES;
