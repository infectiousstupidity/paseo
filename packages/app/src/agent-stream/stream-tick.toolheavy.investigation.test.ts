import { describe, expect, it } from "vitest";
import type { StreamItem, ToolCallItem } from "@/types/stream";
import {
  prepareToolCallHistory,
  projectToolCallDetailLevel,
} from "@/tool-calls/detail-level/projection";
import { getStreamItemMessageId } from "./presentation";
import { findMountedWindowStart, getMountedRecentStreamItems } from "./history-window";
import { layoutStream } from "./layout";
import { buildAgentStreamRenderModel } from "./model";
import { resolveStreamRenderStrategy } from "./strategy-resolver";

const TIMELINE_ITEMS = 2_000;
const TICKS = 200;
const WARMUP_TICKS = 30;
const EPOCH = "perf-4816-tool-heavy";

function timestamp(seed: number): Date {
  return new Date(1_700_000_000_000 + seed * 1000);
}

function toolCall(id: string, seed: number): ToolCallItem {
  return {
    kind: "tool_call",
    id,
    timestamp: timestamp(seed),
    timelineCursor: { epoch: EPOCH, seq: seed },
    payload: {
      source: "agent",
      data: {
        provider: "claude",
        callId: id,
        name: "shell",
        status: "completed",
        error: null,
        detail: { type: "shell", command: id },
      },
    },
  };
}

function buildTimeline(count: number): StreamItem[] {
  const items: StreamItem[] = [];
  let seed = 0;
  while (items.length < count) {
    const turn = items.length;
    items.push({
      kind: "user_message",
      id: `u${turn}`,
      text: "prompt",
      timestamp: timestamp(seed),
      timelineCursor: { epoch: EPOCH, seq: seed++ },
    });
    items.push(toolCall(`t${turn}a`, seed++));
    items.push(toolCall(`t${turn}b`, seed++));
    items.push({
      kind: "assistant_message",
      id: `a${turn}`,
      text: "answer",
      timestamp: timestamp(seed),
      timelineCursor: { epoch: EPOCH, seq: seed++ },
    });
  }
  return items.slice(0, count);
}

function buildHeads(base: StreamItem[], count: number): StreamItem[][] {
  let text = "";
  const heads: StreamItem[][] = [];
  for (let tick = 0; tick < count; tick += 1) {
    text += "token ";
    heads.push([
      {
        kind: "assistant_message",
        id: "live",
        text,
        timestamp: timestamp(base.length + tick),
        timelineCursor: { epoch: EPOCH, seq: base.length + tick },
      },
    ]);
  }
  return heads;
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

function stats(samples: number[]) {
  return {
    meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50Ms: percentile(samples, 0.5),
    p75Ms: percentile(samples, 0.75),
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
  };
}

function runCase(input: {
  name: string;
  tail: StreamItem[];
  historyStart: number;
  heads: StreamItem[][];
}) {
  const strategy = resolveStreamRenderStrategy({ platform: "web", isMobileBreakpoint: false });
  const prepared = prepareToolCallHistory("overview", input.tail);
  const boundaryId = input.tail[input.historyStart]?.id ?? null;
  const activeTurnStartedAt = input.tail.at(-1)?.timestamp ?? null;

  const totalSamples: number[] = [];
  const projectionSamples: number[] = [];
  const boundarySamples: number[] = [];
  const modelSamples: number[] = [];
  const layoutSamples: number[] = [];
  const visibleSetSamples: number[] = [];
  const outlineSamples: number[] = [];
  let previousHistory: StreamItem[] | null = null;
  let previousMounted: StreamItem[] | null = null;
  let previousLayoutHistory: unknown[] | null = null;
  let historyIdentityHits = 0;
  let mountedIdentityHits = 0;
  let layoutIdentityHits = 0;

  for (let tick = 0; tick < WARMUP_TICKS + TICKS; tick += 1) {
    const head = input.heads[tick % input.heads.length]!;
    const totalStart = performance.now();

    const projectionStart = performance.now();
    const projected = projectToolCallDetailLevel({
      level: "overview",
      tail: input.tail,
      head,
      preparedHistory: prepared,
      isTurnActive: true,
    });
    const projectionEnd = performance.now();

    const boundaryStart = performance.now();
    const boundaryIndex = boundaryId
      ? projected.tail.findIndex((item) => item.id === boundaryId)
      : -1;
    const boundaryEnd = performance.now();

    const modelStart = performance.now();
    const model = buildAgentStreamRenderModel({
      isTurnActive: true,
      activeTurnStartedAt,
      tail: projected.tail,
      head: projected.head,
      platform: "web",
      isMobileBreakpoint: false,
      historyStart: boundaryIndex >= 0 ? boundaryIndex : input.historyStart,
    });
    const modelEnd = performance.now();

    const layoutStart = performance.now();
    const layout = layoutStream({
      strategy,
      isTurnActive: true,
      history: model.history,
      liveHead: model.segments.liveHead,
      timingByAssistantId: model.turnTiming.byAssistantId,
    });
    const layoutEnd = performance.now();

    const visibleSetStart = performance.now();
    new Set(
      [...model.history, ...model.segments.liveHead].map((item) => getStreamItemMessageId(item)),
    );
    const visibleSetEnd = performance.now();

    const outlineStart = performance.now();
    let latest = -1;
    for (const item of [...projected.tail, ...projected.head]) {
      if (item.kind === "user_message" && item.timelineCursor?.epoch === EPOCH) {
        latest = Math.max(latest, item.timelineCursor.seq);
      }
    }
    const outlineEnd = performance.now();
    const totalEnd = performance.now();
    void latest;

    if (tick >= WARMUP_TICKS) {
      totalSamples.push(totalEnd - totalStart);
      projectionSamples.push(projectionEnd - projectionStart);
      boundarySamples.push(boundaryEnd - boundaryStart);
      modelSamples.push(modelEnd - modelStart);
      layoutSamples.push(layoutEnd - layoutStart);
      visibleSetSamples.push(visibleSetEnd - visibleSetStart);
      outlineSamples.push(outlineEnd - outlineStart);
      if (previousHistory === model.history) historyIdentityHits += 1;
      if (previousMounted === model.segments.historyMounted) mountedIdentityHits += 1;
      if (previousLayoutHistory === layout.history) layoutIdentityHits += 1;
    }

    previousHistory = model.history;
    previousMounted = model.segments.historyMounted;
    previousLayoutHistory = layout.history;
  }

  return {
    name: input.name,
    itemCount: input.tail.length,
    historyStart: input.historyStart,
    ticks: TICKS,
    identity: {
      historySameTicks: historyIdentityHits,
      mountedSameTicks: mountedIdentityHits,
      layoutHistorySameTicks: layoutIdentityHits,
    },
    total: stats(totalSamples),
    projection: stats(projectionSamples),
    boundaryLookup: stats(boundarySamples),
    model: stats(modelSamples),
    layout: stats(layoutSamples),
    visibleMessageSet: stats(visibleSetSamples),
    outlineScan: stats(outlineSamples),
  };
}

describe("#4816 tool-heavy current tick pipeline", () => {
  it("measures long-history head-only updates", () => {
    const tail = buildTimeline(TIMELINE_ITEMS);
    const heads = buildHeads(tail, WARMUP_TICKS + TICKS);
    const defaultWindowStart = findMountedWindowStart({
      items: tail,
      minMountedCount: getMountedRecentStreamItems(),
    });

    const results = [
      runCase({ name: "default-window", tail, historyStart: defaultWindowStart, heads }),
      runCase({ name: "half-revealed", tail, historyStart: 1_000, heads }),
      runCase({ name: "fully-revealed", tail, historyStart: 0, heads }),
    ];

    console.log(`PERF4816_TOOLHEAVY_JSON=${JSON.stringify(results)}`);
    expect(defaultWindowStart).toBeGreaterThan(0);
    expect(results).toHaveLength(3);
  });
});
