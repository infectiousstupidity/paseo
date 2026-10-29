import type { ProviderRuntimeActivitySnapshot } from "./agent-sdk-types.js";

/**
 * Per-agent runtime activity ledger (#12).
 *
 * The daemon suspends agent runtimes that have been continuously quiet for a configured window.
 * Suspension decisions need two things that `updatedAt` and `lastUserMessageAt` cannot give: a
 * quiet interval that only real work resets, and a count of work that is still open. Reading
 * history, subscribing, heartbeats, metadata changes and usage polling must not move the window;
 * a long silent turn must not look idle.
 *
 * This ledger tracks what the manager itself can see — dispatches, runs, permissions, barriers,
 * schedules. Each provider adapter reports the work its own runtime owns through the named
 * activity snapshot on its session; both views have to be quiet before a sweep commits.
 */

/** Default quiescence window before an idle runtime is suspended; matches the issue's accepted default. */
export const DEFAULT_AGENT_IDLE_TIMEOUT_MS = 15 * 60_000;
/** A single manager-owned sweep timer checks at most this often; detection latency is at most one sweep. */
export const MAX_IDLE_SWEEP_INTERVAL_MS = 30_000;

export interface RuntimeActivitySnapshot extends ProviderRuntimeActivitySnapshot {
  /** Epoch ms of the last observed real activity, or null when none observed since start. */
  lastActivityAt: number | null;
}

export interface AgentRuntimeActivityLedger {
  /** Record an agent's runtime starting or an observation interval restarting (fresh window). */
  noteRuntimeStart(agentId: string): void;
  /** Record real work (prompt, tool call, dispatch, permission activity); resets the window. */
  noteActivity(agentId: string): void;
  /** Record that outstanding work became quiescent; starts a fresh interval without counting the silence that preceded it. */
  noteQuiescent(agentId: string): void;
  /** Add an open-work entry keyed so double-add and double-remove cannot drift the count. */
  addOpenWork(agentId: string, key: string): void;
  removeOpenWork(agentId: string, key: string, options?: { resetQuiet: boolean }): void;
  snapshot(agentId: string): RuntimeActivitySnapshot | null;
  forget(agentId: string): void;
  /** Restart every agent's observation window (used when the timeout is re-enabled). */
  resetAll(): void;
}

interface LedgerEntry {
  quietSinceMs: number;
  lastActivityAt: number | null;
  openWork: Set<string>;
}

export function createAgentRuntimeActivityLedger(
  nowMs: () => number = Date.now,
): AgentRuntimeActivityLedger {
  const entries = new Map<string, LedgerEntry>();

  function entryFor(agentId: string): LedgerEntry {
    let entry = entries.get(agentId);
    if (!entry) {
      entry = { quietSinceMs: nowMs(), lastActivityAt: null, openWork: new Set<string>() };
      entries.set(agentId, entry);
    }
    return entry;
  }

  return {
    noteRuntimeStart(agentId) {
      const entry = entryFor(agentId);
      entry.quietSinceMs = nowMs();
    },

    noteActivity(agentId) {
      const entry = entryFor(agentId);
      entry.lastActivityAt = nowMs();
      entry.quietSinceMs = nowMs();
    },

    noteQuiescent(agentId) {
      const entry = entryFor(agentId);
      entry.quietSinceMs = nowMs();
    },

    addOpenWork(agentId, key) {
      entryFor(agentId).openWork.add(key);
    },

    removeOpenWork(agentId, key, options) {
      const entry = entries.get(agentId);
      if (entry?.openWork.delete(key) && options?.resetQuiet !== false) {
        entry.quietSinceMs = nowMs();
      }
    },

    snapshot(agentId) {
      const entry = entries.get(agentId);
      if (!entry) {
        return null;
      }
      return {
        quietMs: Math.max(0, nowMs() - entry.quietSinceMs),
        hasOutstandingWork: entry.openWork.size > 0,
        lastActivityAt: entry.lastActivityAt,
      };
    },

    forget(agentId) {
      entries.delete(agentId);
    },

    resetAll() {
      for (const entry of entries.values()) {
        entry.quietSinceMs = nowMs();
      }
    },
  };
}

/** Sweep period for a configured timeout: never longer than the timeout, never more often than needed. */
export function idleSweepIntervalMs(timeoutMs: number): number {
  return Math.min(MAX_IDLE_SWEEP_INTERVAL_MS, timeoutMs);
}
