import { open } from "node:fs/promises";
import { limitAgentTimelineItemContent } from "../../../agent-timeline-content.js";
import type { AgentTimelineItem } from "../../../agent-sdk-types.js";
import type {
  ProviderSubagentActivity,
  ProviderSubagentInputEvent,
} from "../../../provider-subagents/store.js";
import { PiHistoryMapper } from "../history-mapper.js";
import type { PiAgentMessage } from "../rpc-types.js";
import { extractTextFromToolResult, type PiToolResult } from "../tool-call-mapper.js";

/** Lifetime cap on the retained full timeline (bytes of transcript consumed into items). */
const MAX_BYTES = 2 * 1024 * 1024;
/** Lifetime cap on the retained full timeline (mapped items). */
const MAX_ITEMS = 200;
/**
 * Per-read window once the history caps are exhausted: the follower keeps consuming the
 * append-only tail in bounded chunks so current activity stays fresh without growing the
 * retained timeline.
 */
const READ_WINDOW = 256 * 1024;
/** A single JSONL line longer than this is dropped instead of being buffered forever. */
const MAX_PENDING_BYTES = 1024 * 1024;
/** Short display label cap for the activity projection. */
const LABEL_LIMIT = 60;

export function outputFileFromToolResult(result: PiToolResult): string | undefined {
  return extractTextFromToolResult(result)?.match(/^Output file:\s*(\S+)$/m)?.[1];
}

/** Reads a finished child transcript once, up to `maxBytes`. */
export function mapPiChildSession(
  id: string,
  file: string,
  maxBytes = MAX_BYTES,
): Promise<ProviderSubagentInputEvent[]> {
  return new PiChildSessionFollower(id, file, maxBytes).readNew();
}

interface ChildSessionEntry {
  type?: string;
  message?: PiAgentMessage;
  timestamp?: string;
  provider?: string;
  modelId?: string;
  thinkingLevel?: string;
}

function mapChildLine(
  mapper: PiHistoryMapper,
  id: string,
  line: string,
  observeEntry: (entry: ChildSessionEntry) => void,
): Extract<ProviderSubagentInputEvent, { type: "timeline" }>[] {
  let entry: ChildSessionEntry;
  try {
    entry = JSON.parse(line) as ChildSessionEntry;
  } catch {
    return [];
  }
  if (!entry || typeof entry !== "object") return [];
  observeEntry(entry);
  if (!entry.message || typeof entry.message !== "object" || !("role" in entry.message)) return [];
  return mapper.mapMessages([entry.message]).flatMap((mapped) =>
    mapped.type === "timeline"
      ? [
          {
            type: "timeline" as const,
            id,
            item: limitAgentTimelineItemContent(mapped.item),
            ...(entry.timestamp ? { timestamp: entry.timestamp } : {}),
          },
        ]
      : [],
  );
}

/** First non-empty line of a block of text, whitespace-collapsed. */
function firstLine(text: string): string {
  for (const line of text.split("\n")) {
    const collapsed = line.trim().replace(/\s+/g, " ");
    if (collapsed) return collapsed;
  }
  return "";
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** Short display label for a tool timeline item: tool name plus a small target. */
function toolActivityLabel(item: Extract<AgentTimelineItem, { type: "tool_call" }>): string {
  let target = "";
  const detail = item.detail;
  switch (detail.type) {
    case "read":
    case "edit":
    case "write":
      target = detail.filePath.split(/[\\/]/).pop() ?? "";
      break;
    case "shell":
      target = firstLine(detail.command);
      break;
    case "search":
      target = firstLine(detail.query);
      break;
    case "fetch":
      try {
        target = new URL(detail.url).host;
      } catch {
        target = "";
      }
      break;
    default:
      break;
  }
  return truncate(`${item.name} ${target}`.trim(), LABEL_LIMIT);
}

/**
 * Incrementally reads one append-only child transcript. A partial JSONL row is held until
 * newline. The lifetime caps (maxBytes / MAX_ITEMS) bound the *retained* timeline only: after
 * they are exhausted the follower keeps consuming the tail in bounded windows and reports
 * current activity through small descriptor upserts, so an active child never appears frozen
 * and the full transcript is never replayed into history, wire traffic, or memory.
 *
 * Activity is the newest completed tool call (kind "tool") by design: it is identical whether
 * observed live or on replay (replay reads have no lifecycle context), and a finished child's
 * final response is already part of the retained timeline while the session fits inside the
 * caps.
 */
export class PiChildSessionFollower {
  private offset = 0;
  private pending = Buffer.alloc(0);
  private readonly mapper = new PiHistoryMapper("pi");
  private items = 0;
  /** Set when the file shrank underneath us (truncated/replaced): do not guess at new content. */
  private stopped = false;
  private lastTool: ProviderSubagentActivity | null = null;
  /** Last activity actually reported, so unchanged activity never re-upserts. */
  private emitted: ProviderSubagentActivity | null = null;
  private model: string | null = null;
  private thinkingOptionId: string | null = null;
  private emittedModel: string | null = null;
  private emittedThinking: string | null = null;
  private readonly maxBytes: number;

  constructor(
    private readonly id: string,
    private readonly file: string,
    maxBytes = MAX_BYTES,
  ) {
    this.maxBytes = Math.min(maxBytes, MAX_BYTES);
  }

  /** Reads new transcript rows, up to the next bounded window. */
  async readNew(): Promise<ProviderSubagentInputEvent[]> {
    if (this.stopped) return [];
    try {
      const batch = await this.readNewRows();
      if (batch === null) return [];
      const events = this.mapRows(batch.rows, batch.startOffset);
      this.maybeReportActivity(events);
      return events;
    } catch {
      return [];
    }
  }

  /** Reads up to the next window of complete JSONL rows, or null when there is nothing new. */
  private async readNewRows(): Promise<{ rows: string[]; startOffset: number } | null> {
    const handle = await open(this.file, "r");
    try {
      const fileSize = (await handle.stat()).size;
      if (fileSize < this.offset) {
        this.stopped = true;
        return null;
      }
      const fileRemaining = fileSize - this.offset;
      if (fileRemaining <= 0) return null;
      const bytesToCap = this.maxBytes - this.offset;
      const size = Math.min(fileRemaining, bytesToCap > 0 ? bytesToCap : READ_WINDOW);
      const buffer = Buffer.alloc(size);
      const { bytesRead } = await handle.read(buffer, 0, size, this.offset);
      const startOffset = this.offset - this.pending.length;
      this.offset += bytesRead;
      const data = Buffer.concat([this.pending, buffer.subarray(0, bytesRead)]);
      const lastNewline = data.lastIndexOf(10);
      if (lastNewline < 0) {
        if (data.length > MAX_PENDING_BYTES) this.pending = Buffer.alloc(0);
        else this.pending = data;
        return null;
      }
      const tail = data.subarray(lastNewline + 1);
      if (tail.length > MAX_PENDING_BYTES) {
        // The trailing partial line is already too large; drop it, keep complete rows only.
        this.pending = Buffer.alloc(0);
        return {
          rows: data.subarray(0, lastNewline).toString("utf8").split("\n"),
          startOffset,
        };
      }
      this.pending = tail;
      return {
        rows: data.subarray(0, lastNewline).toString("utf8").split("\n"),
        startOffset,
      };
    } finally {
      await handle.close();
    }
  }

  /**
   * Maps rows to timeline events up to the retention caps; every row (cap or no cap) feeds the
   * bounded activity projection. The byte cap counts transcript bytes consumed into the
   * *retained* timeline (file offsets), so retained content stays within ~maxBytes even when
   * rows are large.
   */
  private mapRows(rows: string[], startOffset: number): ProviderSubagentInputEvent[] {
    const events: ProviderSubagentInputEvent[] = [];
    let rowOffset = startOffset;
    for (const row of rows) {
      const mapped = mapChildLine(this.mapper, this.id, row, (entry) => this.observeSettings(entry));
      for (const event of mapped) this.trackActivity(event.item, event.timestamp);
      const withinByteCap = rowOffset < this.maxBytes;
      if (withinByteCap && this.items < MAX_ITEMS) {
        const limited = mapped.slice(0, MAX_ITEMS - this.items);
        this.items += limited.length;
        events.push(...limited);
      }
      rowOffset += Buffer.byteLength(row, "utf8") + 1;
    }
    return events;
  }

  /** Observe only the child's persisted Pi settings, never the parent's configured model. */
  private observeSettings(entry: ChildSessionEntry): void {
    let nextModel: string | null = null;
    if (entry.type === "model_change" && typeof entry.provider === "string" &&
        typeof entry.modelId === "string") {
      nextModel = `${entry.provider.trim()}/${entry.modelId.trim()}`;
    } else if (entry.type === "message" && entry.message?.role === "assistant" &&
        typeof entry.message.provider === "string" && typeof entry.message.model === "string") {
      nextModel = `${entry.message.provider.trim()}/${entry.message.model.trim()}`;
    }
    if (nextModel && !nextModel.startsWith("/") && !nextModel.endsWith("/") &&
        nextModel.length <= 200 && nextModel !== this.model) {
      this.model = nextModel;
      // A previously recorded effort cannot be assumed for a newly selected model.
      this.thinkingOptionId = null;
    }
    if (entry.type === "thinking_level_change" && typeof entry.thinkingLevel === "string" &&
        ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(entry.thinkingLevel)) {
      this.thinkingOptionId = entry.thinkingLevel;
    }
  }

  /** Upsert bounded activity and/or model settings only when an observed value changes. */
  private maybeReportActivity(events: ProviderSubagentInputEvent[]): void {
    const current = this.lastTool;
    const activityChanged = current !== null && !sameActivity(current, this.emitted);
    const settingsChanged = this.model !== this.emittedModel ||
      this.thinkingOptionId !== this.emittedThinking;
    if (!activityChanged && !settingsChanged) return;
    this.emitted = current;
    this.emittedModel = this.model;
    this.emittedThinking = this.thinkingOptionId;
    events.push({
      type: "upsert",
      id: this.id,
      ...(activityChanged && current ? { activity: current } : {}),
      ...(settingsChanged ? { model: this.model, thinkingOptionId: this.thinkingOptionId } : {}),
    });
  }

  private trackActivity(item: AgentTimelineItem, timestamp?: string): void {
    if (item.type !== "tool_call") return;
    const activity: ProviderSubagentActivity = {
      kind: "tool",
      label: toolActivityLabel(item),
      at: timestamp ?? new Date().toISOString(),
    };
    this.lastTool = activity;
  }
}

/** Activity identity for dedupe: the timestamp is metadata, not part of "did it change". */
function sameActivity(a: ProviderSubagentActivity, b: ProviderSubagentActivity | null): boolean {
  return b !== null && a.kind === b.kind && a.label === b.label;
}
