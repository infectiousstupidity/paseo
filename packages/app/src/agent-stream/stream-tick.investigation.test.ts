import { describe, expect, it } from "vitest";
import type { StreamItem } from "@/types/stream";
import { deriveStreamTurnTiming } from "@/timeline/turn-time";
import { buildAgentStreamRenderModel } from "./model";
import { layoutStream } from "./layout";
import { findMountedWindowStart, getMountedRecentStreamItems } from "./history-window";
import { resolveStreamRenderStrategy } from "./strategy-resolver";
import { getStreamItemMessageId } from "./presentation";

const BASE_TIME = Date.UTC(2026, 0, 1);
const EPOCH = "perf-4816";

function userMessage(id: string, index: number): StreamItem {
  return {
    kind: "user_message",
    id,
    text: id,
    timestamp: new Date(BASE_TIME + index * 1_000),
    timelineCursor: { epoch: EPOCH, seq: index },
  };
}

function assistantMessage(id: string, index: number, text = id): StreamItem {
  return {
    kind: "assistant_message",
    id,
    text,
    timestamp: new Date(BASE_TIME + index * 1_000),
    timelineCursor: { epoch: EPOCH, seq: index },
  };
}

function createTimeline(itemCount: number): StreamItem[] {
  const items: StreamItem[] = [];
  for (let index = 0; index < itemCount; index += 2) {
    items.push(userMessage(`u-${index}`, index));
    items.push(assistantMessage(`a-${index + 1}`, index + 1));
  }
  return items;
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

function runCase(input: { name: string; tail: StreamItem[]; historyStart: number; ticks?: number }) {
  const ticks = input.ticks ?? 200;
  const strategy = resolveStreamRenderStrategy({ platform: "web", isMobileBreakpoint: false });
  const activeTurnStartedAt = input.tail.at(-2)?.timestamp ?? null;
  const modelSamples: number[] = [];
  const pipelineSamples: number[] = [];
  const timingSamples: number[] = [];
  const visibleSetSamples: number[] = [];
  const outlineSamples: number[] = [];
  const boundarySamples: number[] = [];
  let previousHistory: StreamItem[] | null = null;
  let previousMounted: StreamItem[] | null = null;
  let previousLayoutHistory: unknown[] | null = null;
  let historyIdentityHits = 0;
  let mountedIdentityHits = 0;
  let layoutIdentityHits = 0;

  for (let tick = 0; tick < 30 + ticks; tick += 1) {
    const head = [assistantMessage("live-a", input.tail.length, `delta-${tick}`)];

    const modelStart = performance.now();
    const model = buildAgentStreamRenderModel({
      isTurnActive: true,
      activeTurnStartedAt,
      tail: input.tail,
      head,
      platform: "web",
      isMobileBreakpoint: false,
      historyStart: input.historyStart,
    });
    const modelEnd = performance.now();

    const layout = layoutStream({
      strategy,
      isTurnActive: true,
      history: model.history,
      liveHead: model.segments.liveHead,
      timingByAssistantId: model.turnTiming.byAssistantId,
    });
    const pipelineEnd = performance.now();

    const renderedTail = input.historyStart ? input.tail.slice(input.historyStart) : input.tail;
    const timingStart = performance.now();
    deriveStreamTurnTiming({
      isTurnActive: true,
      activeTurnStartedAt,
      tail: renderedTail,
      head,
    });
    const timingEnd = performance.now();

    const visibleSetStart = performance.now();
    new Set(
      [...model.history, ...model.segments.liveHead].map((item) => getStreamItemMessageId(item)),
    );
    const visibleSetEnd = performance.now();

    const outlineStart = performance.now();
    const loadedItems = [...input.tail, ...head];
    loadedItems.reduce(
      (latest, item) =>
        item.kind === "user_message" && item.timelineCursor?.epoch === EPOCH
          ? Math.max(latest, item.timelineCursor.seq)
          : latest,
      -1,
    );
    const outlineEnd = performance.now();

    const boundaryId = input.tail[input.historyStart]?.id ?? "missing";
    const boundaryStart = performance.now();
    input.tail.findIndex((item) => item.id === boundaryId);
    const boundaryEnd = performance.now();

    if (tick >= 30) {
      modelSamples.push(modelEnd - modelStart);
      pipelineSamples.push(pipelineEnd - modelStart);
      timingSamples.push(timingEnd - timingStart);
      visibleSetSamples.push(visibleSetEnd - visibleSetStart);
      outlineSamples.push(outlineEnd - outlineStart);
      boundarySamples.push(boundaryEnd - boundaryStart);
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
    mountedInputCount: input.tail.length - input.historyStart,
    ticks,
    identity: {
      historySameTicks: historyIdentityHits,
      mountedSameTicks: mountedIdentityHits,
      layoutHistorySameTicks: layoutIdentityHits,
    },
    model: stats(modelSamples),
    modelPlusLayout: stats(pipelineSamples),
    turnTimingOnly: stats(timingSamples),
    visibleMessageSetOnly: stats(visibleSetSamples),
    outlineScanOnly: stats(outlineSamples),
    boundaryFindIndexOnly: stats(boundarySamples),
  };
}

describe("#4816 current stream tick investigation", () => {
  it("measures head-only scaling and history identity", () => {
    const small = createTimeline(40);
    const large = createTimeline(2_000);
    const recentStart = findMountedWindowStart({
      items: large,
      minMountedCount: getMountedRecentStreamItems(),
    });

    const results = [
      runCase({ name: "small-40-revealed", tail: small, historyStart: 0 }),
      runCase({ name: "large-2000-recent", tail: large, historyStart: recentStart }),
      runCase({ name: "large-2000-half-revealed", tail: large, historyStart: 1_000 }),
      runCase({ name: "large-2000-fully-revealed", tail: large, historyStart: 0 }),
    ];

    console.log(`PERF4816_JSON=${JSON.stringify(results)}`);

    expect(recentStart).toBeGreaterThan(0);
    expect(results).toHaveLength(4);
  });
});
