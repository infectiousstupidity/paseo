import type { ToolCallDetail } from "@getpaseo/protocol/agent-types";
import type { StreamItem, ToolCallItem } from "@/types/stream";

/**
 * "Latest meaningful activity" for a subagent row, derived from timeline events the client has
 * already streamed. The projection is bounded (it only scans a tail) and stable (a token streaming
 * into an assistant message does not change the label while the same tool call is the newest
 * event), so rows do not re-render or bounce on every streamed token.
 */

/** How far back the tail scan goes; the popover only needs the most recent meaningful event. */
const TAIL_SCAN_LIMIT = 20;
/** Excerpts are capped so one row cannot carry an unbounded piece of tool output or a response. */
const EXCERPT_LIMIT = 80;

export type SubagentActivity =
  | { kind: "tool"; label: string }
  | { kind: "response"; text: string }
  | { kind: "none" };

const NONE_ACTIVITY: SubagentActivity = { kind: "none" };

/**
 * Newest event first. A running child reports its newest tool call only: assistant text is still
 * streaming and would change on every token. A finished child reports its last explicit response
 * when one was observed, else its last tool call. Reasoning, user prompts, and raw tool arguments
 * never surface here.
 *
 * The daemon can also carry a bounded current-activity projection on the descriptor (Task 03),
 * which keeps advancing after the retained history caps while the client's timeline tail stops.
 * The fresher source wins: the descriptor observes every transcript row the daemon follows, so
 * for children beyond the caps it is newer than the retained tail; for children inside the caps
 * a finished child's final response stays the newest meaningful event and keeps its precedence.
 * Older daemons omit the field and the pure timeline projection below applies unchanged.
 */
export function deriveSubagentActivity(
  tail: readonly StreamItem[] | undefined,
  isRunning: boolean,
  descriptorActivity?: { kind: "tool"; label: string; at: string } | null,
): SubagentActivity {
  const desc = descriptorActivity
    ? {
        kind: "tool" as const,
        label: descriptorActivity.label,
        at: Date.parse(descriptorActivity.at),
      }
    : null;
  const projected = projectTail(tail, isRunning);
  if (isRunning) {
    if (desc && (!projected || desc.at >= projected.at)) {
      return { kind: "tool", label: desc.label };
    }
    return projected ? asSubagentActivity(projected) : NONE_ACTIVITY;
  }
  if (projected && projected.kind === "response" && (!desc || projected.at >= desc.at)) {
    return { kind: "response", text: projected.label };
  }
  if (desc && (!projected || desc.at >= projected.at)) {
    return { kind: "tool", label: desc.label };
  }
  return projected ? asSubagentActivity(projected) : NONE_ACTIVITY;
}

function asSubagentActivity(projected: {
  kind: "tool" | "response";
  label: string;
}): SubagentActivity {
  return projected.kind === "tool"
    ? { kind: "tool", label: projected.label }
    : { kind: "response", text: projected.label };
}

/** Task 02's bounded tail projection, with the chosen item's timestamp for freshness checks. */
function projectTail(
  tail: readonly StreamItem[] | undefined,
  isRunning: boolean,
): { kind: "tool" | "response"; label: string; at: number } | null {
  if (!tail || tail.length === 0) return null;
  const window = tail.slice(-TAIL_SCAN_LIMIT);
  for (let i = window.length - 1; i >= 0; i -= 1) {
    const item = window[i];
    if (!item) continue;
    if (isRunning) {
      if (item.kind === "tool_call") {
        const label = toolCallLabel(item);
        if (label) return { kind: "tool", label, at: item.timestamp.getTime() };
      }
      continue;
    }
    if (item.kind === "assistant_message") {
      const text = responseExcerpt(item.text);
      if (text) return { kind: "response", label: text, at: item.timestamp.getTime() };
      continue;
    }
    if (item.kind === "tool_call") {
      const label = toolCallLabel(item);
      if (label) return { kind: "tool", label, at: item.timestamp.getTime() };
    }
  }
  return null;
}

function toolCallLabel(item: ToolCallItem): string | null {
  if (item.payload.source === "orchestrator") {
    const name = item.payload.data.toolName.trim();
    return name || null;
  }
  const name = item.payload.data.name.trim();
  const target = shortTarget(item.payload.data.detail);
  const label = `${name} ${target}`.trim();
  return label || null;
}

/** A short, structured target: file basenames, first-line commands, queries, hosts. No raw args. */
function shortTarget(detail: ToolCallDetail): string {
  switch (detail.type) {
    case "read":
    case "edit":
    case "write":
      return baseName(detail.filePath);
    case "shell":
      return excerpt(firstLine(detail.command));
    case "search":
      return excerpt(firstLine(detail.query));
    case "fetch":
      return hostOf(detail.url);
    case "worktree_setup":
      return excerpt(detail.branchName);
    case "sub_agent":
      return excerpt(detail.subAgentType ?? "");
    default:
      return "";
  }
}

/** Only the first line of a response: a multi-paragraph report never reaches the row. */
function responseExcerpt(text: string): string | null {
  const line = excerpt(firstLine(text));
  return line || null;
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  return line.replace(/\s+/g, " ").trim();
}

function excerpt(text: string): string {
  const normalized = text.trim();
  if (normalized.length <= EXCERPT_LIMIT) return normalized;
  return `${normalized.slice(0, EXCERPT_LIMIT - 1)}…`;
}

function baseName(filePath: string): string {
  const segments = filePath.split(/[\\/]/);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (segment) return excerpt(segment);
  }
  return "";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return excerpt(firstLine(url));
  }
}

/** "45s", "3m", "2h", "5d". Null when the timestamp is not a valid date — unknown stays absent. */
export function formatSubagentAge(createdAt: Date, now: Date): string | null {
  const created = createdAt.getTime();
  if (Number.isNaN(created)) return null;
  const seconds = Math.max(0, Math.floor((now.getTime() - created) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
