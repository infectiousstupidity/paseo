import type { ProviderPaseoToolsPolicy } from "@getpaseo/protocol/provider-config";

interface ProviderPaseoToolSettings {
  paseoTools?: ProviderPaseoToolsPolicy;
}

export function resolvePaseoToolPolicy(
  providerId: string,
  providerSettings: Readonly<Record<string, ProviderPaseoToolSettings>> | undefined,
): ProviderPaseoToolsPolicy | undefined {
  return providerSettings?.[providerId]?.paseoTools;
}

/**
 * Tools that drive recurring jobs or host processes. `paseoTools: { toolset: "core" }` omits
 * them for profiles that should not run jobs, heartbeats, terminals, or workspace scripts.
 * Absent means "full", so existing profiles keep every tool and narrowing is always opt-in.
 */
export const AUTOMATION_PASEO_TOOLS: readonly string[] = [
  // Schedules and heartbeats
  "create_schedule",
  "create_heartbeat",
  "delete_heartbeat",
  "delete_schedule",
  "inspect_schedule",
  "list_schedules",
  "pause_schedule",
  "resume_schedule",
  "run_schedule_once",
  "schedule_logs",
  "update_schedule",
  // Host terminals
  "capture_terminal",
  "create_terminal",
  "inspect_terminal",
  "kill_terminal",
  "list_terminals",
  "send_terminal_keys",
  // Workspace scripts
  "list_workspace_scripts",
  "start_workspace_script",
  "stop_workspace_script",
  "workspace_scripts",
];

const CORE_OMITTED_PASEO_TOOLS = new Set<string>(AUTOMATION_PASEO_TOOLS);

export function isPaseoToolEnabled(
  policy: ProviderPaseoToolsPolicy | undefined,
  toolName: string,
): boolean {
  if (toolName === "speak") {
    return true;
  }
  if (!isPaseoToolPolicyEnabled(policy)) {
    return false;
  }
  if (policy?.disabledTools?.includes(toolName)) {
    return false;
  }
  return policy?.toolset !== "core" || !CORE_OMITTED_PASEO_TOOLS.has(toolName);
}

export function isPaseoToolPolicyEnabled(policy: ProviderPaseoToolsPolicy | undefined): boolean {
  return policy?.enabled !== false;
}
