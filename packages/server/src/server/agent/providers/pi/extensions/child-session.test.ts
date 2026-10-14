import { describe, expect, test } from "vitest";
import { appendFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderSubagentStore } from "../../../provider-subagents/store.js";
import { PiChildSessionFollower } from "./child-session.js";

/** One JSONL row that maps to a single assistant_message timeline item. */
function assistantLine(text: string, timestamp: string): string {
  return JSON.stringify({
    message: { role: "assistant", content: [{ type: "text", text }] },
    timestamp,
  });
}

function toolCallLine(name: string, args: Record<string, unknown>, timestamp: string): string {
  return JSON.stringify({
    message: {
      role: "assistant",
      content: [{ type: "toolCall", id: `call-${name}`, name, arguments: args }],
    },
    timestamp,
  });
}

function toolResultLine(name: string, timestamp: string): string {
  return JSON.stringify({
    message: {
      role: "toolResult",
      toolCallId: `call-${name}`,
      content: [{ type: "text", text: "ok" }],
    },
    timestamp,
  });
}

function activities(events: Awaited<ReturnType<PiChildSessionFollower["readNew"]>>): {
  label: string;
  at: string;
}[] {
  return events
    .filter((event) => event.type === "upsert" && event.activity)
    .map((event) => ({
      label: event.type === "upsert" && event.activity ? event.activity.label : "",
      at: event.type === "upsert" && event.activity ? event.activity.at : "",
    }));
}

function timelineCount(events: Awaited<ReturnType<PiChildSessionFollower["readNew"]>>): number {
  return events.filter((event) => event.type === "timeline").length;
}

describe("PiChildSessionFollower", () => {
  let dir: string;
  let file: string;

  test("reports activity after the 200-item cap without growing the retained timeline", async () => {
    dir = await mkdtemp(join(tmpdir(), "paseo-pi-follower-"));
    file = join(dir, "child.jsonl");
    const follower = new PiChildSessionFollower("child", file);
    const store = new ProviderSubagentStore();
    try {
      // 205 rows, each mapping to one item: the first 200 fill the retention cap.
      const rows: string[] = [];
      for (let i = 0; i < 205; i += 1) {
        rows.push(
          assistantLine(`note ${i}`, `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`),
        );
      }
      await writeFile(file, rows.join("\n") + "\n");
      let events = await follower.readNew();
      expect(timelineCount(events)).toBe(200);
      expect(activities(events)).toEqual([]);

      // Unchanged file: the next tick does no work and emits nothing (no churn).
      expect(await follower.readNew()).toEqual([]);

      // An active tool action appended after the cap must still surface as activity.
      await appendFile(
        file,
        `${toolCallLine("write", { path: "/tmp/child/context.md", content: "x" }, "2026-01-01T01:00:00.000Z")}\n`,
      );
      await appendFile(file, `${toolResultLine("write", "2026-01-01T01:00:01.000Z")}\n`);
      events = await follower.readNew();
      expect(timelineCount(events)).toBe(0);
      expect(activities(events)).toEqual([
        { label: "write context.md", at: "2026-01-01T01:00:01.000Z" },
      ]);

      // Re-reading without new content never re-emits the same activity.
      expect(await follower.readNew()).toEqual([]);

      // The retained store timeline never grew past the cap.
      for (const event of await new PiChildSessionFollower("child", file).readNew()) {
        store.apply("parent", "pi", event);
      }
      const fetched = store.fetchTimeline("parent", "child", { limit: 0 });
      expect(fetched.rows.length).toBe(200);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("reports activity after the 2 MiB byte cap with bounded per-tick reads", async () => {
    dir = await mkdtemp(join(tmpdir(), "paseo-pi-follower-"));
    file = join(dir, "child.jsonl");
    const follower = new PiChildSessionFollower("child", file);
    try {
      // ~2.3 MiB of single-item rows: crosses the 2 MiB byte cap.
      const padding = "x".repeat(880);
      const rows: string[] = [];
      for (let i = 0; i < 2600; i += 1) {
        rows.push(assistantLine(`${padding} row ${i}`, "2026-01-01T00:00:00.000Z"));
      }
      await writeFile(file, rows.join("\n") + "\n");
      const events = await follower.readNew();
      expect(timelineCount(events)).toBe(200);
      const afterCapSize = (await stat(file)).size;
      expect(afterCapSize).toBeGreaterThan(2 * 1024 * 1024);

      // Late append after the byte cap: the follower keeps consuming the tail in bounded
      // windows, so the activity surfaces on a later tick. The retained timeline never grows.
      await appendFile(
        file,
        `${toolCallLine("bash", { command: "npm test" }, "2026-01-02T00:00:00.000Z")}\n`,
      );
      await appendFile(file, `${toolResultLine("bash", "2026-01-02T00:00:02.000Z")}\n`);
      let tickEvents = [];
      let tick = 0;
      do {
        tickEvents = await follower.readNew();
        tick += 1;
      } while (activities(tickEvents).length === 0 && tick < 10);
      expect(tick).toBeLessThan(10);
      expect(timelineCount(tickEvents)).toBe(0);
      expect(activities(tickEvents)).toEqual([
        { label: "bash npm test", at: "2026-01-02T00:00:02.000Z" },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("holds a partial JSONL row until its newline arrives", async () => {
    dir = await mkdtemp(join(tmpdir(), "paseo-pi-follower-"));
    file = join(dir, "child.jsonl");
    const follower = new PiChildSessionFollower("child", file);
    try {
      const full = assistantLine("split me", "2026-01-01T00:00:00.000Z");
      await writeFile(file, full.slice(0, 20));
      expect(await follower.readNew()).toEqual([]);
      await appendFile(file, full.slice(20) + "\n");
      const events = await follower.readNew();
      expect(timelineCount(events)).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("drops a single line longer than the pending bound and keeps reading", async () => {
    dir = await mkdtemp(join(tmpdir(), "paseo-pi-follower-"));
    file = join(dir, "child.jsonl");
    const follower = new PiChildSessionFollower("child", file);
    try {
      const huge = assistantLine("y".repeat(1.5 * 1024 * 1024), "2026-01-01T00:00:00.000Z");
      await writeFile(file, huge); // no trailing newline
      expect(await follower.readNew()).toEqual([]);
      await appendFile(
        file,
        `\n${toolCallLine("read", { path: "/tmp/child/a.md" }, "2026-01-01T00:00:05.000Z")}\n`,
      );
      const events = await follower.readNew();
      expect(timelineCount(events)).toBe(1);
      expect(activities(events)).toEqual([{ label: "read a.md", at: "2026-01-01T00:00:05.000Z" }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("stops without looping when the file is truncated or replaced", async () => {
    dir = await mkdtemp(join(tmpdir(), "paseo-pi-follower-"));
    file = join(dir, "child.jsonl");
    const follower = new PiChildSessionFollower("child", file);
    try {
      await writeFile(file, assistantLine("one", "2026-01-01T00:00:00.000Z") + "\n");
      expect(timelineCount(await follower.readNew())).toBe(1);
      await writeFile(file, "short");
      expect(await follower.readNew()).toEqual([]);
      expect(await follower.readNew()).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("projects only child-observed model and thinking changes", async () => {
    dir = await mkdtemp(join(tmpdir(), "paseo-pi-follower-"));
    file = join(dir, "child.jsonl");
    const follower = new PiChildSessionFollower("child", file);
    try {
      const rows = [
        { type: "model_change", provider: "openrouter", modelId: "qwen3.8-27b" },
        { type: "message", message: {
          role: "assistant", provider: "openrouter", model: "qwen3.8-27b",
          content: [{ type: "text", text: "Working" }],
        } },
      ];
      await writeFile(file, rows.map(row => JSON.stringify(row)).join("\n") + "\n");
      expect((await follower.readNew()).filter(event => event.type === "upsert")).toMatchObject([
        { model: "openrouter/qwen3.8-27b", thinkingOptionId: null },
      ]);
      expect(await follower.readNew()).toEqual([]);

      await appendFile(file, JSON.stringify({ type: "thinking_level_change", thinkingLevel: "xhigh" }) + "\n");
      expect((await follower.readNew()).filter(event => event.type === "upsert")).toMatchObject([
        { model: "openrouter/qwen3.8-27b", thinkingOptionId: "xhigh" },
      ]);

      await appendFile(file, JSON.stringify({ type: "model_change",
        provider: "openrouter", modelId: "different-model" }) + "\n");
      expect((await follower.readNew()).filter(event => event.type === "upsert")).toMatchObject([
        { model: "openrouter/different-model", thinkingOptionId: null },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("does not infer identity from the child prompt or tool output", async () => {
    dir = await mkdtemp(join(tmpdir(), "paseo-pi-follower-"));
    file = join(dir, "child.jsonl");
    try {
      await writeFile(file, assistantLine("Use qwen xhigh", "2026-01-01T00:00:00Z") + "\n");
      expect((await new PiChildSessionFollower("child", file).readNew())
        .filter(event => event.type === "upsert")).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("returns no events for a missing file", async () => {
    const follower = new PiChildSessionFollower("child", join(tmpdir(), "does-not-exist.jsonl"));
    expect(await follower.readNew()).toEqual([]);
  });
});
