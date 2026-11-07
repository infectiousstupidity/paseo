import type { AgentToolDefinition } from "./agent-tools.js";
import type {
  AgentPermissionRequest,
  AgentPermissionResponse,
  AgentTimelineItem,
  AgentSessionConfig,
} from "@getpaseo/protocol/agent-types";
import type { PaseoApi } from "@getpaseo/client";
import type { WorkspaceCreateRequest } from "@getpaseo/protocol/messages";

export interface PluginHookContext {
  paseo: PaseoApi;
  signal: AbortSignal;
}

export interface PluginHookWorkspace {
  id: string;
  projectId: string;
  cwd: string;
  name: string | null;
  archivedAt: string | null;
}

/** Facts available after Git creates a worktree, before workspace setup or an agent. */
export interface PluginHookWorktree {
  path: string;
  branch: string;
  sourceCheckout: string;
}

export interface PluginHookAgent {
  id: string;
  workspaceId: string | null;
  parentAgentId: string | null;
  provider: string;
  cwd: string;
  title: string | null;
}

export interface PluginSessionOpenRequest {
  agentId: string;
  workspaceId: string | null;
  provider: string;
  cwd: string;
  reason: "create" | "resume" | "refresh" | "import";
  purpose: "interactive" | "history";
  readonly title: string | null;
  readonly labels: Readonly<Record<string, string>>;
  tools: AgentToolDefinition[];
  env: Record<string, string>;
  mcpServers: NonNullable<AgentSessionConfig["mcpServers"]>;
}

export type PluginTurnOutcome =
  | { kind: "completed" }
  | { kind: "failed"; error: { message: string; code?: string } }
  | { kind: "canceled"; reason: string };

export interface PluginLifecycleEvents {
  "agent.turn_started": { agent: PluginHookAgent; turnId: string | null };
  "agent.turn_ended": {
    agent: PluginHookAgent;
    turnId: string | null;
    outcome: PluginTurnOutcome;
    /**
     * @deprecated Always empty. Fetch history on demand with
     * context.paseo.agents.ref(agent.id).timeline.refetch({ direction: "tail", limit: 20 }).
     */
    timeline: readonly AgentTimelineItem[];
  };
  "agent.permission_requested": { agent: PluginHookAgent; request: AgentPermissionRequest };
  "agent.permission_resolved": {
    agent: PluginHookAgent;
    requestId: string;
    resolution: AgentPermissionResponse;
  };
  "agent.archived": { agent: PluginHookAgent; archivedAt: string };
  "agent.created": { agent: PluginHookAgent };
  "agent.closed": { agent: PluginHookAgent };
  "workspace.created": { workspace: PluginHookWorkspace };
  "workspace.archived": { workspace: PluginHookWorkspace };
}

export interface PluginBeforeRequests {
  "agent.create": { config: AgentSessionConfig; env?: Record<string, string> };
  "agent.session_open": PluginSessionOpenRequest;
  "workspace.create": Omit<WorkspaceCreateRequest, "type" | "requestId">;
}

/** Canonical plugin names. Legacy on/before registration remains supported. */
export type PluginHooks = {
  "agent.turn.before": { payload: PluginLifecycleEvents["agent.turn_started"] };
  "agent.turn.after": { payload: PluginLifecycleEvents["agent.turn_ended"] };
  "agent.permission.before": { payload: PluginLifecycleEvents["agent.permission_requested"] };
  "agent.permission.after": { payload: PluginLifecycleEvents["agent.permission_resolved"] };
  "agent.archive.after": { payload: PluginLifecycleEvents["agent.archived"] };
  "agent.create.after": { payload: PluginLifecycleEvents["agent.created"] };
  "agent.close.after": { payload: PluginLifecycleEvents["agent.closed"] };
  "workspace.create.after": { payload: PluginLifecycleEvents["workspace.created"] };
  "workspace.archive.after": { payload: PluginLifecycleEvents["workspace.archived"] };
  "agent.create.before": { request: PluginBeforeRequests["agent.create"] };
  "agent.open.before": { request: PluginBeforeRequests["agent.session_open"] };
  "workspace.create.before": { request: PluginBeforeRequests["workspace.create"] };
  "worktree.create.after": { payload: { worktree: PluginHookWorktree } };
};

export type PluginHookPayload<Name extends keyof PluginHooks> =
  PluginHooks[Name] extends { request: infer Request }
    ? { request: Request }
    : PluginHooks[Name] extends { payload: infer Payload }
      ? Payload
      : never;
export type PluginHookResult<Name extends keyof PluginHooks> =
  PluginHooks[Name] extends { request: infer Request } ? Request | void : void;

export interface PluginLifecycleRegistration {
  addHook<Name extends keyof PluginHooks>(
    name: Name,
    handler: (
      payload: PluginHookPayload<Name>,
      context: PluginHookContext,
    ) => Promise<PluginHookResult<Name>>,
  ): () => void;
  on<Name extends keyof PluginLifecycleEvents>(
    name: Name,
    handler: (
      event: PluginLifecycleEvents[Name],
      context: PluginHookContext,
    ) => void | Promise<void>,
  ): () => void;
  before<Name extends keyof PluginBeforeRequests>(
    name: Name,
    handler: (
      input: { request: PluginBeforeRequests[Name] },
      context: PluginHookContext,
    ) => PluginBeforeRequests[Name] | void | Promise<PluginBeforeRequests[Name] | void>,
  ): () => void;
}
