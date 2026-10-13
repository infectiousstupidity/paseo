import type { AgentProvider, AgentTimelineItem } from "../agent-sdk-types.js";
import { limitAgentTimelineItemContent } from "../agent-timeline-content.js";
import { InMemoryAgentTimelineStore } from "../agent-timeline-store.js";
import type {
  AgentTimelineFetchOptions,
  AgentTimelineFetchResult,
  AgentTimelineRow,
} from "../agent-timeline-store-types.js";

/** Server-only capability. Native identities must never be serialized to clients. */
export interface ProviderSubagentControlTarget {
  runId: string;
  childId: string;
  index: number;
  sessionId: string;
}

export type ProviderSubagentStatus = "running" | "completed" | "failed" | "canceled";

/**
 * Bounded current-activity projection for a subagent row: the newest completed tool call
 * observed from the child transcript, kept small enough that a two-line popover never needs
 * the full history. Sent as part of the descriptor; absent on older daemons (clients fall
 * back to the streamed timeline tail).
 */
export interface ProviderSubagentActivity {
  kind: "tool";
  /** Short display-ready label, e.g. "edit track.tsx". */
  label: string;
  /** Real timestamp of the observed event (or observation time when the row carries none). */
  at: string;
}

export interface ProviderSubagentDescriptor {
  id: string;
  parentAgentId: string;
  /** Direct provider-subagent parent. Null identifies a child of the managed agent. */
  parentSubagentId: string | null;
  provider: AgentProvider;
  title: string | null;
  description: string | null;
  status: ProviderSubagentStatus;
  createdAt: string;
  updatedAt: string;
  toolCallId: string | null;
  cwd: string | null;
  subtitle: string | null;
  activity: ProviderSubagentActivity | null;
}

export type ProviderSubagentInputEvent =
  | {
      type: "upsert";
      id: string;
      title?: string | null;
      description?: string | null;
      /**
       * Omit to keep the stored status. A presentation-only upsert says nothing about whether the
       * child is still running, and must not revert a finished one.
       */
      status?: ProviderSubagentStatus;
      toolCallId?: string | null;
      cwd?: string | null;
      subtitle?: string | null;
      activity?: ProviderSubagentActivity | null;
      parentSubagentId?: string | null;
      /** Native, session-owned target from verified Pi status.json, not display metadata. */
      controlTarget?: ProviderSubagentControlTarget | null;
      timestamp?: string;
    }
  | {
      type: "timeline";
      id: string;
      item: AgentTimelineItem;
      timestamp?: string;
    }
  | { type: "remove"; id: string };

export type ProviderSubagentStoreEvent =
  | { type: "upsert"; subagent: ProviderSubagentDescriptor }
  | {
      type: "timeline";
      parentAgentId: string;
      subagentId: string;
      provider: AgentProvider;
      row: AgentTimelineRow;
      epoch: string;
    }
  | { type: "remove"; parentAgentId: string; subagentId: string };

function storeKey(parentAgentId: string, subagentId: string): string {
  return `${parentAgentId}\0${subagentId}`;
}

/**
 * Sticky upsert semantics for a descriptor field: an omitted value preserves what is stored, an
 * explicit `null` clears it. Providers observe these fields incrementally, so a partial upsert
 * must never blank fields it says nothing about.
 */
function stickyField<T>(next: T | undefined, previous: T | null | undefined): T | null {
  return next === undefined ? (previous ?? null) : next;
}

export class ProviderSubagentStore {
  private readonly descriptors = new Map<string, ProviderSubagentDescriptor>();
  private readonly controlTargets = new Map<string, ProviderSubagentControlTarget>();
  private readonly timelines = new InMemoryAgentTimelineStore();

  apply(
    parentAgentId: string,
    provider: AgentProvider,
    event: ProviderSubagentInputEvent,
  ): ProviderSubagentStoreEvent {
    const key = storeKey(parentAgentId, event.id);
    if (event.type === "remove") {
      this.descriptors.delete(key);
      this.controlTargets.delete(key);
      this.timelines.delete(key);
      return { type: "remove", parentAgentId, subagentId: event.id };
    }

    if (event.type === "timeline") {
      if (!this.timelines.has(key)) {
        this.timelines.initialize(key);
      }
      const row = this.timelines.append(key, limitAgentTimelineItemContent(event.item), {
        timestamp: event.timestamp,
      });
      return {
        type: "timeline",
        parentAgentId,
        subagentId: event.id,
        provider,
        row,
        epoch: this.timelines.getEpoch(key),
      };
    }

    const previous = this.descriptors.get(key);
    if (!this.timelines.has(key)) {
      this.timelines.initialize(key);
    }
    const timestamp = event.timestamp ?? new Date().toISOString();
    const subagent: ProviderSubagentDescriptor = {
      id: event.id,
      parentAgentId,
      provider,
      title: stickyField(event.title, previous?.title),
      description: stickyField(event.description, previous?.description),
      status: event.status ?? previous?.status ?? "running",
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      toolCallId: stickyField(event.toolCallId, previous?.toolCallId),
      cwd: stickyField(event.cwd, previous?.cwd),
      subtitle: stickyField(event.subtitle, previous?.subtitle),
      activity: stickyField(event.activity, previous?.activity),
      parentSubagentId: stickyField(event.parentSubagentId, previous?.parentSubagentId),
    };
    // Invalidate control authority as soon as the child is no longer running.
    if (provider !== "pi" || (previous !== undefined && previous.provider !== provider) ||
        subagent.status !== "running" || event.controlTarget === null) {
      this.controlTargets.delete(key);
    } else if (event.controlTarget !== undefined && provider === "pi") {
      this.controlTargets.set(key, event.controlTarget);
    }
    this.descriptors.set(key, subagent);
    return { type: "upsert", subagent };
  }

  list(parentAgentId: string): ProviderSubagentDescriptor[] {
    return [...this.descriptors.values()]
      .filter((subagent) => subagent.parentAgentId === parentAgentId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  listAll(): ProviderSubagentDescriptor[] {
    return [...this.descriptors.values()];
  }

  get(parentAgentId: string, subagentId: string): ProviderSubagentDescriptor | null {
    return this.descriptors.get(storeKey(parentAgentId, subagentId)) ?? null;
  }

  getControlTarget(parentAgentId: string, subagentId: string): ProviderSubagentControlTarget | null {
    return this.controlTargets.get(storeKey(parentAgentId, subagentId)) ?? null;
  }

  fetchTimeline(
    parentAgentId: string,
    subagentId: string,
    options?: AgentTimelineFetchOptions,
  ): AgentTimelineFetchResult {
    return this.timelines.fetch(storeKey(parentAgentId, subagentId), options);
  }

  deleteParent(parentAgentId: string): ProviderSubagentStoreEvent[] {
    const events: ProviderSubagentStoreEvent[] = [];
    for (const subagent of this.list(parentAgentId)) {
      const key = storeKey(parentAgentId, subagent.id);
      this.descriptors.delete(key);
      this.controlTargets.delete(key);
      this.timelines.delete(key);
      events.push({ type: "remove", parentAgentId, subagentId: subagent.id });
    }
    return events;
  }
}
