import { describe, expect, test } from "vitest";
import { ProviderSubagentStore } from "./store.js";

describe("ProviderSubagentStore", () => {
  test("keeps provider children and their timelines scoped to the parent agent", () => {
    const subagents = new ProviderSubagentStore();

    subagents.apply("parent-a", "codex", {
      type: "upsert",
      id: "child-1",
      title: "Explore",
      cwd: "/workspace/child",
      status: "running",
      timestamp: "2026-07-12T10:00:00.000Z",
    });
    subagents.apply("parent-a", "codex", {
      type: "timeline",
      id: "child-1",
      item: { type: "assistant_message", text: "Found it." },
      timestamp: "2026-07-12T10:00:01.000Z",
    });
    subagents.apply("parent-a", "codex", {
      type: "upsert",
      id: "child-1",
      status: "completed",
      timestamp: "2026-07-12T10:00:02.000Z",
    });
    subagents.apply("parent-b", "claude", {
      type: "upsert",
      id: "child-1",
      title: "Review",
      status: "running",
      timestamp: "2026-07-12T10:00:03.000Z",
    });

    expect(subagents.list("parent-a")).toEqual([
      expect.objectContaining({
        id: "child-1",
        parentAgentId: "parent-a",
        provider: "codex",
        title: "Explore",
        cwd: "/workspace/child",
        status: "completed",
        createdAt: "2026-07-12T10:00:00.000Z",
        updatedAt: "2026-07-12T10:00:02.000Z",
      }),
    ]);
    expect(subagents.fetchTimeline("parent-a", "child-1").rows).toMatchObject([
      {
        seq: 1,
        timestamp: "2026-07-12T10:00:01.000Z",
        item: { type: "assistant_message", text: "Found it." },
      },
    ]);
    expect(subagents.list("parent-b")[0]).toMatchObject({ provider: "claude", title: "Review" });
    expect(subagents.deleteParent("parent-a")).toEqual([
      { type: "remove", parentAgentId: "parent-a", subagentId: "child-1" },
    ]);
    expect(subagents.list("parent-a")).toEqual([]);
    expect(subagents.list("parent-b")).toHaveLength(1);
  });

  test("keeps native Pi targets private, parent-scoped, and revokes them on terminal state", () => {
    const store = new ProviderSubagentStore();
    const target = { runId: "run-1", childId: "native-second", snapshotId: "step:1", index: 1, sessionId: "pi-session" };
    const update = store.apply("parent-a", "pi", {
      type: "upsert", id: "call-1:1", status: "running", controlTarget: target,
    });
    expect(store.getControlTarget("parent-a", "call-1:1")).toEqual(target);
    expect(store.getControlTarget("parent-b", "call-1:1")).toBeNull();
    expect(store.get("parent-a", "call-1:1")).not.toHaveProperty("controlTarget");
    expect(update).not.toHaveProperty("controlTarget");
    if (update.type === "upsert") expect(update.subagent).not.toHaveProperty("controlTarget");

    // Unknown native run IDs must never ride on a public descriptor or update.
    store.apply("parent-a", "pi", { type: "upsert", id: "call-1:1", status: "canceled" });
    expect(store.getControlTarget("parent-a", "call-1:1")).toBeNull();
    expect(store.get("parent-a", "call-1:1")?.controlEligible).toBe(false);
    // Canceled/stopped children must never retain a native target for a guessed Resume.
    store.apply("parent-a", "claude", {
      type: "upsert", id: "call-1:2", status: "running", controlTarget: target,
    });
    expect(store.getControlTarget("parent-a", "call-1:2")).toBeNull();
    store.apply("parent-a", "pi", {
      type: "upsert", id: "call-1:3", status: "running", controlTarget: target,
    });
    store.apply("parent-a", "pi", { type: "remove", id: "call-1:3" });
    expect(store.getControlTarget("parent-a", "call-1:3")).toBeNull();
  });

  test("keeps observed child settings on activity-only updates and clears prior effort on model change", () => {
    const store = new ProviderSubagentStore();
    store.apply("parent", "pi", { type: "upsert", id: "child",
      model: "openrouter/model-a", thinkingOptionId: "xhigh" });
    store.apply("parent", "pi", { type: "upsert", id: "child",
      activity: { kind: "tool", label: "read file.ts", at: "2026-10-14T00:00:00Z" } });
    expect(store.get("parent", "child")).toMatchObject({
      model: "openrouter/model-a", thinkingOptionId: "xhigh",
    });
    store.apply("parent", "pi", { type: "upsert", id: "child",
      model: "openrouter/model-b", thinkingOptionId: null });
    expect(store.get("parent", "child")).toMatchObject({
      model: "openrouter/model-b", thinkingOptionId: null,
    });
  });

  test("limits oversized provider child tool output before storage", () => {
    const subagents = new ProviderSubagentStore();
    const output = "x".repeat(70 * 1024);
    const update = subagents.apply("parent-a", "opencode", {
      type: "timeline",
      id: "child-1",
      item: {
        type: "tool_call",
        callId: "call-1",
        name: "shell",
        status: "completed",
        error: null,
        detail: { type: "shell", command: "print", output },
      },
    });

    expect(update.type).toBe("timeline");
    const [row] = subagents.fetchTimeline("parent-a", "child-1").rows;
    expect(row?.item).toMatchObject({
      type: "tool_call",
      detail: { type: "shell", output: "x".repeat(64 * 1024) },
    });
  });

  test("pages provider history on projected item boundaries", () => {
    const subagents = new ProviderSubagentStore();
    for (let index = 0; index < 101; index += 1) {
      subagents.apply("parent-a", "opencode", {
        type: "timeline",
        id: "child-1",
        item: { type: "assistant_message", text: String(index) },
      });
    }

    const page = subagents.fetchTimeline("parent-a", "child-1", {
      direction: "tail",
      limit: 1,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.seqStart).toBe(1);
    expect(page.rows[0]?.item).toMatchObject({
      text: Array.from({ length: 101 }, (_, i) => String(i)).join(""),
    });
    expect(page.rows.at(-1)?.seq).toBe(101);
    expect(page.hasOlder).toBe(false);
  });
});
