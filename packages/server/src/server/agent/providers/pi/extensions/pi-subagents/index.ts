import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractTextFromToolResult } from "../../tool-call-mapper.js";
import type { ProviderSubagentStatus, ProviderSubagentControlTarget } from "../../../../provider-subagents/store.js";
import type { PiExtension, PiExtensionToolCall, PiExtensionToolMapping } from "../contract.js";

const Args = z
  .object({
    agent: z.string().trim().min(1).optional(),
    task: z.string().trim().min(1).optional(),
    async: z.boolean().optional(),
    action: z.unknown().optional(),
  })
  .passthrough();
const Row = z
  .object({
    index: z.number().int().nonnegative().optional(),
    agent: z.string().trim().min(1),
    exitCode: z.number().optional(),
    success: z.boolean().optional(),
    sessionFile: z.string().trim().min(1).optional(),
  })
  .passthrough();
const Completion = z
  .object({ runId: z.string().trim().min(1), results: z.array(Row) })
  .passthrough();
const Details = z
  .object({
    mode: z.string(),
    runId: z.string().optional(),
    asyncId: z.string().optional(),
    asyncDir: z.string().trim().min(1).optional(),
    results: z.array(Row),
    completions: z.array(Completion).optional(),
  })
  .passthrough();
const AsyncStatus = z
  .object({
    state: z.string(),
    sessionId: z.string().optional(),
    runId: z.string().optional(),
    steps: z.array(
      z
        .object({
          agent: z.string().trim().min(1),
          childId: z.string().optional(),
          workflowKey: z.string().optional(),
          runId: z.string().optional(),
          status: z.string().optional(),
          sessionFile: z.string().trim().min(1).optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/** Run states from which an async run never advances on its own. */
const TERMINAL_RUN_STATES = new Set(["complete", "failed", "partial", "rejected", "stopped"]);

function runStateStatus(runState: string): ProviderSubagentStatus {
  switch (runState) {
    case "complete":
      return "completed";
    case "stopped":
      return "canceled";
    case "failed":
    case "partial":
    case "rejected":
      return "failed";
    default:
      // queued, running, paused, and unknown states keep the child alive.
      return "running";
  }
}

/** A step's own terminal state wins; non-terminal or missing step states fall back to the run. */
function stepStatusStatus(stepStatus: string | undefined): ProviderSubagentStatus | undefined {
  switch (stepStatus) {
    case "complete":
    case "completed":
      return "completed";
    case "stopped":
      return "canceled";
    case "failed":
    case "error":
    case "rejected":
    case "partial":
      return "failed";
    default:
      return undefined;
  }
}

function asyncChildStatus(runState: string, stepStatus?: string): ProviderSubagentStatus {
  return stepStatusStatus(stepStatus) ?? runStateStatus(runState);
}

/** The `subagent-notify` header; a grouped notice reports every run as completed. */
function noticeStatus(header: string) {
  if (/^Background tasks completed \(\d+\):/.test(header)) return "completed";
  const outcome = header.match(
    /^(?:Background task|Detached foreground task) (completed|failed|stopped): \*\*/,
  )?.[1];
  if (outcome === "stopped") return "canceled";
  return outcome as "completed" | "failed" | undefined;
}

export const piSubagents: PiExtension = {
  id: "pi-subagents",
  createSession: () => {
    const callsByRun = new Map<string, string>();
    const readSessions = new Set<string>();
    /** Keyed by async directory, which both status.json and the completion notice carry. */
    const asyncRuns = new Map<
      string,
      { owner: string; runId: string; polling: boolean; last: Map<string, { status: string; title: string; target: string }> }
    >();
    const rememberAsyncRun = (details: z.infer<typeof Details>, call: PiExtensionToolCall) => {
      if (details.asyncDir && details.runId && call.status !== "failed") {
        asyncRuns.set(details.asyncDir, { owner: call.callId, runId: details.runId, polling: true, last: new Map() });
      }
    };
    const collectRows = (
      owner: string,
      rows: z.infer<typeof Row>[],
      description?: string,
      failed = false,
    ) => {
      const subagents: NonNullable<PiExtensionToolMapping["subagents"]> = [];
      const childSessions: NonNullable<PiExtensionToolMapping["childSessions"]> = [];
      for (const [index, row] of rows.entries()) {
        const id = rows.length === 1 ? owner : `${owner}:${row.index ?? index}`;
        subagents.push({
          type: "upsert",
          id,
          title: row.agent,
          description,
          toolCallId: owner,
          // Missing both `success` and `exitCode` is an unjudged finish, not a failure: the
          // pi-subagents producer records `success: false` and/or a nonzero `exitCode` on failure.
          status:
            failed ||
            row.success === false ||
            (row.success === undefined && row.exitCode !== undefined && row.exitCode !== 0)
              ? "failed"
              : "completed",
        });
        if (row.sessionFile && !readSessions.has(row.sessionFile)) {
          readSessions.add(row.sessionFile);
          childSessions.push({ id, file: row.sessionFile });
        }
      }
      return { subagents, childSessions };
    };
    const mapWait = (call: PiExtensionToolCall) => {
      if (call.status === "running") return undefined;
      const details = Details.safeParse(
        typeof call.result === "object" ? call.result?.details : null,
      );
      if (!details.success || !details.data.completions) return undefined;
      const subagents: NonNullable<PiExtensionToolMapping["subagents"]> = [];
      const childSessions: NonNullable<PiExtensionToolMapping["childSessions"]> = [];
      for (const completion of details.data.completions) {
        const owner = callsByRun.get(completion.runId);
        if (!owner) continue;
        const mapped = collectRows(owner, completion.results);
        subagents.push(...mapped.subagents);
        childSessions.push(...mapped.childSessions);
      }
      return subagents.length ? { subagents, childSessions } : undefined;
    };
    const mapSpawn = (call: PiExtensionToolCall) => {
      const args = Args.safeParse(call.args);
      if (!args.success || args.data.action !== undefined || !args.data.agent || !args.data.task)
        return undefined;
      const detail = {
        type: "sub_agent" as const,
        subAgentType: args.data.agent,
        description: args.data.task,
        log: extractTextFromToolResult(call.result)?.trim() ?? "",
      };
      const base = {
        type: "upsert" as const,
        id: call.callId,
        title: args.data.agent,
        description: args.data.task,
        toolCallId: call.callId,
      };
      if (call.status === "running")
        return { detail, subagents: [{ ...base, status: "running" as const }] };
      const details = Details.safeParse(
        typeof call.result === "object" ? call.result?.details : null,
      );
      if (!details.success || details.data.mode === "management")
        return call.status === "failed"
          ? { detail, subagents: [{ ...base, status: "failed" as const }] }
          : { detail };
      if (details.data.runId) callsByRun.set(details.data.runId, call.callId);
      if (details.data.results.length === 0 && (details.data.asyncId || args.data.async)) {
        rememberAsyncRun(details.data, call);
        return {
          detail,
          subagents: [
            {
              ...base,
              status: call.status === "failed" ? ("failed" as const) : ("running" as const),
            },
          ],
        };
      }
      if (details.data.results.length === 0 && call.status === "failed")
        return { detail, subagents: [{ ...base, status: "failed" as const }] };
      return {
        detail,
        ...collectRows(call.callId, details.data.results, args.data.task, call.status === "failed"),
      };
    };
    return {
      mapToolCall(call) {
        if (call.toolName === "bg_wait") return mapWait(call);
        if (call.toolName === "subagent") return mapSpawn(call);
        return undefined;
      },
      // The notice is the only completion Pi persists, so replay settles async runs from it.
      mapCustomMessage(message) {
        if (message.customType !== "subagent-notify") return undefined;
        const text =
          typeof message.content === "string"
            ? message.content
            : extractTextFromToolResult({ content: message.content });
        const lines = text?.split("\n") ?? [];
        const status = noticeStatus(lines[0] ?? "");
        if (!status) return undefined;
        const subagents: NonNullable<PiExtensionToolMapping["subagents"]> = [];
        const childSessions: NonNullable<PiExtensionToolMapping["childSessions"]> = [];
        // Each run's session line follows its async directory line; earlier lines are child output.
        let owner: string | undefined;
        for (const line of lines) {
          const dir = line.match(/^Retention-managed async directory: (.+)$/)?.[1];
          if (dir) {
            owner = asyncRuns.get(dir)?.owner;
            if (owner) subagents.push({ type: "upsert", id: owner, status });
            continue;
          }
          const file = owner ? line.match(/^Session file: (.+)$/)?.[1] : undefined;
          if (!owner || !file) continue;
          if (!readSessions.has(file)) {
            readSessions.add(file);
            childSessions.push({ id: owner, file });
          }
          owner = undefined;
        }
        return subagents.length ? { subagents, childSessions } : undefined;
      },
      poll() {
        const subagents: NonNullable<PiExtensionToolMapping["subagents"]> = [];
        const childSessions: NonNullable<PiExtensionToolMapping["childSessions"]> = [];
        for (const [dir, run] of asyncRuns) {
          if (!run.polling) continue;
          let raw: unknown;
          try {
            raw = JSON.parse(readFileSync(join(dir, "status.json"), "utf8"));
          } catch {
            // Missing or partial status files are not evidence of failure; keep the prior state.
            continue;
          }
          const parsed = AsyncStatus.safeParse(raw);
          if (!parsed.success) continue;
          const runState = parsed.data.state;
          const steps = parsed.data.steps;
          // Do not invent step:index identities. Native child IDs are required for control.
          // Multiple status rows can share aliases; only a uniquely resolved native ID is safe.
          const identities = steps.map((step) => step.childId || step.workflowKey || step.runId);
          for (const [index, step] of steps.entries()) {
            const id = steps.length === 1 ? run.owner : `${run.owner}:${index}`;
            const status = asyncChildStatus(runState, step.status);
            const nativeId = identities[index];
            const controlTarget: ProviderSubagentControlTarget | null =
              status === "running" && (step.status === "running" || step.status === "pending") &&
              parsed.data.runId === run.runId &&
              typeof parsed.data.sessionId === "string" && parsed.data.sessionId.length > 0 &&
              typeof nativeId === "string" && nativeId.length > 0 &&
              identities.filter((value) => value === nativeId).length === 1
                ? { runId: run.runId, childId: nativeId, index, sessionId: parsed.data.sessionId }
                : null;
            const targetKey = controlTarget ? JSON.stringify(controlTarget) : "";
            const file =
              step.sessionFile && !readSessions.has(step.sessionFile)
                ? step.sessionFile
                : undefined;
            const last = run.last.get(id);
            // Emit only on first observation or a material change (lifecycle, agent title,
            // newly attached session file), so an unchanged running status stays quiet.
            if (!last || last.status !== status || last.title !== step.agent || last.target !== targetKey || file) {
              run.last.set(id, { status, title: step.agent, target: targetKey });
              subagents.push({ type: "upsert", id, title: step.agent, status, controlTarget });
            }
            if (file) {
              readSessions.add(file);
              childSessions.push({ id, file });
            }
          }
          if (TERMINAL_RUN_STATES.has(runState)) {
            if (steps.length === 0) {
              const status = runStateStatus(runState);
              if (run.last.get(run.owner)?.status !== status) {
                run.last.set(run.owner, { status, title: "", target: "" });
                subagents.push({ type: "upsert", id: run.owner, status });
              }
            }
            run.polling = false;
          }
        }
        return subagents.length || childSessions.length ? { subagents, childSessions } : undefined;
      },
    };
  },
};
