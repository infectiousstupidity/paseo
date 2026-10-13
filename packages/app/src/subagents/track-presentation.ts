import type { TFunction } from "i18next";
import type { ComposerTrackPillSegment } from "@/composer/tracks";
import type { SidebarStateBucket } from "@/utils/sidebar-agent-state";
import { deriveSidebarStateBucket, STATUS_BUCKET_ORDER } from "@/utils/sidebar-agent-state";
import type { SubagentRow } from "./select";
import { isFinishedSubagent } from "./archive-finished";
import { providerSubagentLifecycleStatus } from "./provider-store";

/**
 * The lifecycle state a row names in words. `completed` reads "Finished", never a success claim:
 * a finished reviewer may have reported defects, and only explicit child evidence earns more.
 * Null means nothing to name yet: a managed child that is still initializing carries the app's
 * own inactive mark and has no state to word, so the word stays absent rather than invented.
 */
export type SubagentStateWord = "running" | "finished" | "failed" | "canceled";

/** Visibility hint only. Every click is independently authorized by the daemon and native Pi. */
export function canControlPiSubagent(row: SubagentRow): boolean {
  return row.kind === "provider" && row.provider === "pi" &&
    row.status === "running" && row.controlEligible === true;
}

export function resolveSubagentState(row: SubagentRow): SubagentStateWord | null {
  if (row.kind === "provider") {
    switch (row.status) {
      case "running":
        return "running";
      case "failed":
        return "failed";
      case "canceled":
        return "canceled";
      default:
        return "finished";
    }
  }
  if (row.turn.phase === "open" || row.status === "running") return "running";
  if (row.status === "error") return "failed";
  if (row.status === "initializing") return null;
  return "finished";
}

/**
 * What needs a look first: running, failed, and attention children ahead of terminal ones
 * (completed, canceled). Each group keeps its stable creation order, and a row only moves when
 * it crosses the active/finished boundary — never on an event inside one group. This is
 * attention ordering, not archiving: a failed child still sorts as finished for the archive row.
 */
/** Three stable visual groups. A failed child needs attention, not an invented review verdict. */
export interface SubagentSections {
  attention: SubagentRow[];
  working: SubagentRow[];
  recent: SubagentRow[];
}

export function groupSubagentRows(rows: readonly SubagentRow[]): SubagentSections {
  const groups: SubagentSections = { attention: [], working: [], recent: [] };
  for (const row of rows) {
    const state = resolveSubagentState(row);
    if (state === "failed" || row.requiresAttention) groups.attention.push(row);
    else if (state === "running") groups.working.push(row);
    else groups.recent.push(row);
  }
  return groups;
}

export function orderSubagentRows(rows: readonly SubagentRow[]): SubagentRow[] {
  const active: SubagentRow[] = [];
  const finished: SubagentRow[] = [];
  for (const row of rows) {
    (isOrderingActive(row) ? active : finished).push(row);
  }
  return [...active, ...finished];
}

function isOrderingActive(row: SubagentRow): boolean {
  if (row.kind === "provider") {
    return row.status === "running" || row.status === "failed";
  }
  return row.turn.phase === "open" || row.status === "running" || row.status === "error";
}

function presentationStatus(row: SubagentRow) {
  if (row.kind === "paseo") {
    if (row.turn.phase === "open") return "running";
    return row.status === "running" ? "idle" : row.status;
  }
  return providerSubagentLifecycleStatus(row.status);
}

export interface SubagentRowPresentationData {
  key: string;
  kind: "agent";
  label: string;
  subtitle: string;
  titleState: "ready" | "loading";
  statusBucket: SidebarStateBucket | null;
}

/**
 * Display only, not a task rewrite: skip standalone repo/HEAD boilerplate lines while retaining
 * the exact source description for the expanded pane. Do not infer a task from a filename/hash.
 */
export function compactSubagentTask(raw: string): string {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const content = lines.find((line) =>
    !/^(?:(?:repository|repo|cwd|workspace|working directory|head|commit|branch)\s*[:=]|task\s*:?$)/i.test(line),
  ) ?? lines[0] ?? raw;
  const normalized = content.replace(/^[-*]\s+/, "").trim();
  return normalized.length > 120 ? normalized.slice(0, 119).trimEnd() + "…" : normalized;
}

export function buildSubagentRowPresentationData(row: SubagentRow): SubagentRowPresentationData {
  // The task distinguishes siblings in a fan-out, so it names the row when present. Providers
  // own the compact secondary context because model, effort, and usage semantics differ.
  const description = resolveRowLabel(row.description);
  const title = resolveRowLabel(row.title);
  const label = description ? compactSubagentTask(description) : title;
  const providerSubtitle = row.kind === "provider" ? resolveRowLabel(row.subtitle) : null;
  const subtitle = providerSubtitle ?? (description ? title : null);
  const status = presentationStatus(row);
  return {
    key: `${row.kind}_subagent_${row.id}`,
    kind: "agent",
    label: label ?? "",
    subtitle: subtitle ?? "",
    titleState: label ? "ready" : "loading",
    statusBucket: deriveSidebarStateBucket({
      status,
      requiresAttention: false,
    }),
  };
}

type ActiveStatusBucket = Exclude<SidebarStateBucket, "done">;

/** The sidebar's list order, minus the state that earns no mark. */
const ACTIVE_STATUS_BUCKET_ORDER = STATUS_BUCKET_ORDER.filter(
  (bucket): bucket is ActiveStatusBucket => bucket !== "done",
);

/** One state the pill reports, and how many children are in it. */
interface SubagentStatusCount {
  bucket: ActiveStatusBucket;
  count: number;
}

/** Everything the pill draws. Built together so no mark can end up next to another one's count. */
export interface SubagentPillPresentation {
  segments: ComposerTrackPillSegment[];
  accessibilityLabel: string;
}

/**
 * What the pill says about a fan-out, and which marks it says it with.
 *
 * A mark and a number sitting together answer the same question, so the pill cannot collapse a
 * mixed fan-out into the most urgent state the way a sidebar project row does: a red dot beside
 * "1 failed" over a child that is still working says the fan-out has stopped. Every state present
 * gets its own mark and its own count, in the order the sidebar's status groups list them.
 *
 * It stays one line because subagent rows only ever reach three states — see
 * `buildSubagentRowPresentationData`, which reports no attention of its own — so the pill is two
 * segments at worst, and falls back to naming what it opens once nothing is happening.
 */
export function buildSubagentPillPresentation(
  t: TFunction,
  rows: readonly SubagentRow[],
): SubagentPillPresentation {
  const counts = summarizeSubagentStatus(rows);
  if (counts.length === 0) {
    const label = totalLabel(t, rows.length);
    return { segments: [{ bucket: null, text: label }], accessibilityLabel: label };
  }
  const labels = counts.map(({ bucket, count }) => statusLabel(t, bucket, count));
  return {
    segments: counts.map(({ bucket }, index) => ({ bucket, text: labels[index] ?? "" })),
    // Marks separate the segments on screen; a screen reader needs the pause spelled out.
    accessibilityLabel: labels.join(", "),
  };
}

/** Wording comes from the sidebar's status groups — one name per state across the whole app. */
function statusLabel(t: TFunction, bucket: ActiveStatusBucket, count: number): string {
  switch (bucket) {
    case "running":
      return t("subagents.pillLabelWorking", { count });
    case "failed":
      return t("subagents.pillLabelFailed", { count });
    case "needs_input":
      return count === 1
        ? t("subagents.pillLabelNeedsInputOne")
        : t("subagents.pillLabelNeedsInputMany", { count });
    case "attention":
      return t("subagents.pillLabelReadyToReview", { count });
  }
}

/** Nothing is happening, so the pill is back to naming what it opens. */
function totalLabel(t: TFunction, total: number): string {
  return total === 1 ? t("subagents.pillLabelOne") : t("subagents.pillLabelMany", { count: total });
}

/**
 * Empty when every child is done: a finished fan-out is not worth a colour above the composer.
 */
function summarizeSubagentStatus(rows: readonly SubagentRow[]): SubagentStatusCount[] {
  const buckets = rows.map((row) => buildSubagentRowPresentationData(row).statusBucket);
  return ACTIVE_STATUS_BUCKET_ORDER.flatMap((bucket) => {
    const count = buckets.filter((candidate) => candidate === bucket).length;
    return count > 0 ? [{ bucket, count }] : [];
  });
}

export function countFinishedSubagents(rows: readonly SubagentRow[]): number {
  return rows.filter(isFinishedSubagent).length;
}

export function resolveRowLabel(title: string | null | undefined): string | null {
  if (typeof title !== "string") {
    return null;
  }
  const normalized = title.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.toLowerCase() === "new agent") {
    return null;
  }
  return normalized;
}
