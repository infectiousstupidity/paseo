import { describe, expect, test } from "vitest";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPiExtensionHost } from "../index.js";
import { piSubagents } from "./index.js";
import {
  parseToolArgs,
  parseToolResult,
  type PiToolResult,
  type PiTrackedToolCall,
} from "../../tool-call-mapper.js";
import { mapPiChildSession } from "../child-session.js";
import { readSubagentFixture, verifySubagentFixture } from "../subagent-fixture-test.js";
import pino from "pino";
import { PiRpcAgentClient } from "../../agent.js";
import { FakePi } from "../../test-utils/fake-pi.js";
import type { AgentStreamEvent } from "../../../../agent-sdk-types.js";

function mapping(toolCall: PiTrackedToolCall, result: PiToolResult) {
  return createPiExtensionHost().mapToolCall({
    callId: "test-call",
    toolName: toolCall.toolName,
    args: toolCall.args,
    status: result ? "completed" : "running",
    result,
  });
}
function mapToolDetail(toolCall: PiTrackedToolCall, result: PiToolResult) {
  return mapping(toolCall, result)?.detail;
}

function hasChildTimeline(events: AgentStreamEvent[]) {
  return events.some(
    (event) => event.type === "provider_subagent" && event.event.type === "timeline",
  );
}

function hasCompletedChild(events: AgentStreamEvent[]) {
  return events.some(
    (event) =>
      event.type === "provider_subagent" &&
      event.event.type === "upsert" &&
      event.event.status === "completed",
  );
}

describe("pi-subagents adapter", () => {
  test("recognizes native asynchronous workflow launches without agent/task inputs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-workflow-target-"));
    const adapter = piSubagents.createSession();
    try {
      const initial = adapter.mapToolCall?.({
        callId: "workflow-call", toolName: "subagent",
        args: { workflow: true, async: true },
        status: "completed",
        result: { details: {
          mode: "workflow", runId: "workflow-run", asyncId: "workflow-run",
          asyncDir: dir, results: [],
        } },
      });
      expect(initial?.subagents).toEqual([
        expect.objectContaining({ id: "workflow-call", status: "running" }),
      ]);
      await writeFile(join(dir, "status.json"), JSON.stringify({
        state: "running", runId: "workflow-run", sessionId: "parent-session",
        steps: [
          { agent: "implementer", status: "running", workflowKey: "implement" },
          { agent: "reviewer", status: "running", workflowKey: "review" },
        ],
      }));
      expect(adapter.poll?.()?.subagents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "workflow-call:1",
          controlTarget: {
            runId: "workflow-run", childId: "review", index: 1, sessionId: "parent-session",
          },
        }),
      ]));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("binds a native second child, never a display-row index or ambiguous alias", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-native-child-"));
    const adapter = piSubagents.createSession();
    try {
      adapter.mapToolCall?.({
        callId: "call-native", toolName: "subagent",
        args: { agent: "scout", task: "Two children", async: true },
        status: "completed",
        result: {
          details: { mode: "parallel", runId: "run-native", asyncId: "run-native",
            asyncDir: dir, results: [] },
        },
      });
      await writeFile(join(dir, "status.json"), JSON.stringify({
        state: "running", runId: "run-native", sessionId: "parent-session",
        steps: [
          { agent: "first", status: "running", childId: "first-native" },
          { agent: "second", status: "running", childId: "second-native" },
        ],
      }));
      const observations = adapter.poll?.()?.subagents ?? [];
      expect(observations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "call-native:1",
          controlTarget: {
            runId: "run-native", childId: "second-native", index: 1,
            sessionId: "parent-session",
          },
        }),
      ]));

      // A missing ID must not be synthesized as step:1. A duplicate cannot be resolved.
      await writeFile(join(dir, "status.json"), JSON.stringify({
        state: "running", runId: "run-native", sessionId: "parent-session",
        steps: [
          { agent: "first", status: "running", childId: "duplicate" },
          { agent: "second", status: "running", childId: "duplicate" },
        ],
      }));
      const changed = adapter.poll?.()?.subagents ?? [];
      expect(changed.filter((event) => event.type === "upsert")).toEqual(
        expect.arrayContaining([expect.objectContaining({
          id: "call-native:1", controlTarget: null,
        })]),
      );
      await writeFile(join(dir, "status.json"), JSON.stringify({
        state: "running", runId: "run-native", sessionId: "parent-session",
        steps: [
          { agent: "first", status: "running" },
          { agent: "second", status: "running" },
        ],
      }));
      const missing = adapter.poll?.()?.subagents ?? [];
      expect(missing).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "call-native:1", controlTarget: null }),
      ]));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });


  test("follows async status and transcript without bg_wait", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-pi-async-"));
    const file = join(dir, "child.jsonl");
    const received: AgentStreamEvent[] = [];
    const host = createPiExtensionHost();
    try {
      host.follow((event) => received.push(event));
      host.mapToolCall({
        callId: "call-1",
        toolName: "subagent",
        args: { agent: "scout", task: "Inspect", async: true },
        status: "completed",
        result: {
          details: { mode: "single", runId: "run-1", asyncId: "run-1", asyncDir: dir, results: [] },
        },
      });
      await writeFile(
        file,
        '{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"BEGIN"}]}}\n',
      );
      await writeFile(
        join(dir, "status.json"),
        JSON.stringify({
          state: "running",
          steps: [{ agent: "scout", status: "running", sessionFile: file }],
        }),
      );
      await expect.poll(() => hasChildTimeline(received)).toBe(true);
      await writeFile(
        join(dir, "status.json"),
        JSON.stringify({
          state: "complete",
          steps: [{ agent: "scout", status: "complete", sessionFile: file }],
        }),
      );
      await expect.poll(() => hasCompletedChild(received)).toBe(true);
    } finally {
      host.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("does not repeat equivalent descriptor upserts while async status is unchanged", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-pi-async-"));
    const file = join(dir, "child.jsonl");
    const received: AgentStreamEvent[] = [];
    const host = createPiExtensionHost();
    try {
      host.follow((event) => received.push(event));
      host.mapToolCall({
        callId: "call-1",
        toolName: "subagent",
        args: { agent: "scout", task: "Inspect", async: true },
        status: "completed",
        result: {
          details: { mode: "single", runId: "run-1", asyncId: "run-1", asyncDir: dir, results: [] },
        },
      });
      await writeFile(
        file,
        '{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"BEGIN"}]}}\n',
      );
      await writeFile(
        join(dir, "status.json"),
        JSON.stringify({
          state: "running",
          steps: [{ agent: "scout", status: "running", sessionFile: file }],
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const upserts = received.filter(
        (event) =>
          event.type === "provider_subagent" &&
          event.event.type === "upsert" &&
          event.event.id === "call-1",
      );
      const timelines = received.filter(
        (event) => event.type === "provider_subagent" && event.event.type === "timeline",
      );
      // First observation only; the transcript keeps flowing while the descriptor stays quiet.
      expect(upserts.length).toBeLessThanOrEqual(2);
      expect(timelines.length).toBeGreaterThan(0);
      for (let i = 1; i < upserts.length; i += 1) {
        expect(upserts[i].event).not.toEqual(upserts[i - 1].event);
      }
    } finally {
      host.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("settles an async run and reads its transcript from the completion notice on replay", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-pi-async-"));
    const file = join(dir, "child.jsonl");
    try {
      await writeFile(
        file,
        '{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"DONE"}]}}\n',
      );
      const host = createPiExtensionHost();
      host.mapToolCall({
        callId: "call-1",
        toolName: "subagent",
        args: { agent: "scout", task: "Inspect", async: true },
        status: "completed",
        result: {
          details: { mode: "single", runId: "run-1", asyncId: "run-1", asyncDir: dir, results: [] },
        },
      });
      const notice = host.mapCustomMessage({
        role: "custom",
        customType: "subagent-notify",
        content: [
          "Background task completed: **scout**",
          "",
          "Session file: /tmp/not-the-session-line.jsonl",
          "",
          `Retention-managed async directory: ${dir}`,
          "",
          `Session file: ${file}`,
        ].join("\n"),
      });
      expect(notice?.subagents).toEqual([{ type: "upsert", id: "call-1", status: "completed" }]);
      expect(hasChildTimeline(await notice!.hydration)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("maps completed subagent calls with task input to sub-agent detail", () => {
    const toolCall = parseToolArgs("subagent", {
      agent: "reviewer",
      task: "Review the Pi mapper change",
    });
    const result = parseToolResult({
      content: [{ type: "text", text: "The mapper change preserves provider status." }],
    });

    expect(mapToolDetail(toolCall, result)).toEqual({
      type: "sub_agent",
      subAgentType: "reviewer",
      description: "Review the Pi mapper change",
      log: "The mapper change preserves provider status.",
    });
  });

  test("maps the captured foreground run and child Pi timeline live and on replay", async () => {
    const raw = readSubagentFixture(new URL("./fixtures/foreground.json", import.meta.url));
    const result = raw.events.find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "subagent" &&
        event.result &&
        typeof event.result === "object" &&
        "details" in event.result &&
        Array.isArray(event.result.details?.results) &&
        event.result.details.results.length > 0,
    );
    if (!result || result.type !== "tool_execution_end")
      throw new Error("Missing captured child session");
    const original = (result.result as { details: { results: Array<{ sessionFile: string }> } })
      .details.results[0].sessionFile;
    const fixture = readSubagentFixture(new URL("./fixtures/foreground.json", import.meta.url), {
      from: original,
      to: fileURLToPath(new URL("./fixtures/child-session.jsonl", import.meta.url)),
    });
    const events = await verifySubagentFixture(fixture);
    expect(
      events
        .filter((event) => event.event.type === "upsert")
        .map((event) => (event.event.type === "upsert" ? event.event.status : null)),
    ).toContain("completed");
    expect(events.filter((event) => event.event.type === "timeline").length).toBeGreaterThan(0);
  });

  test("settles captured async runs from the completion notice live and on replay", async () => {
    const fixture = readSubagentFixture(new URL("./fixtures/background.json", import.meta.url));
    const events = await verifySubagentFixture(fixture);
    expect(events.findLast((event) => event.event.type === "upsert")?.event).toEqual(
      expect.objectContaining({ status: "completed" }),
    );
  });

  test("maps bg_wait completion to the original async child", async () => {
    const raw = readSubagentFixture(new URL("./fixtures/wait.json", import.meta.url));
    const wait = raw.events.find(
      (event) => event.type === "tool_execution_end" && event.toolName === "bg_wait",
    );
    if (!wait || wait.type !== "tool_execution_end")
      throw new Error("Missing captured bg_wait result");
    const original = (
      wait.result as {
        details: { completions: Array<{ results: Array<{ sessionFile: string }> }> };
      }
    ).details.completions[0].results[0].sessionFile;
    const fixture = readSubagentFixture(new URL("./fixtures/wait.json", import.meta.url), {
      from: original,
      to: fileURLToPath(new URL("./fixtures/child-session.jsonl", import.meta.url)),
    });
    const events = await verifySubagentFixture(fixture);
    const upserts = events
      .filter((event) => event.event.type === "upsert" && event.event.status)
      .map((event) => (event.event.type === "upsert" ? event.event : null));
    // bg_wait settles the child; the later completion notice repeats it. Activity-only upserts
    // (Task 03) carry no status and are not part of the lifecycle sequence.
    expect(upserts.map((event) => event?.status)).toEqual([
      "running",
      "running",
      "completed",
      "completed",
    ]);
    expect(new Set(upserts.map((event) => event?.id)).size).toBe(1);
    expect(events.filter((event) => event.event.type === "timeline").length).toBeGreaterThan(0);
  });

  test("missing child file produces no timeline", async () => {
    expect(await mapPiChildSession("child", "/does-not-exist/pi-child.jsonl")).toEqual([]);
  });

  test("does not emit child timeline after session close", async () => {
    const raw = readSubagentFixture(new URL("./fixtures/foreground.json", import.meta.url));
    const completion = raw.events.find(
      (event) => event.type === "tool_execution_end" && event.toolName === "subagent",
    );
    if (!completion || completion.type !== "tool_execution_end") throw new Error("No completion");
    const original = (completion.result as { details: { results: Array<{ sessionFile: string }> } })
      .details.results[0].sessionFile;
    const fixture = readSubagentFixture(new URL("./fixtures/foreground.json", import.meta.url), {
      from: original,
      to: fileURLToPath(new URL("./fixtures/child-session.jsonl", import.meta.url)),
    });
    const pi = new FakePi();
    const client = new PiRpcAgentClient({ logger: pino({ level: "silent" }), runtime: pi });
    const session = await client.createSession({
      provider: "pi",
      cwd: "/tmp/paseo-pi-child-close",
    });
    const events: AgentStreamEvent[] = [];
    session.subscribe((event) => events.push(event));
    await session.startTurn("Delegate work");
    for (const event of fixture.events) pi.latestSession().emit(event);
    await session.close();
    expect(
      events.some((event) => event.type === "provider_subagent" && event.event.type === "upsert"),
    ).toBe(true);
    expect(
      events.some((event) => event.type === "provider_subagent" && event.event.type === "timeline"),
    ).toBe(false);
  });

  test("a failed spawn without result rows finishes its descriptor", () => {
    const host = createPiExtensionHost();
    const args = { agent: "scout", task: "Inspect" };
    host.mapToolCall({
      callId: "failed",
      toolName: "subagent",
      args,
      status: "running",
      result: null,
    });
    expect(
      host.mapToolCall({
        callId: "failed",
        toolName: "subagent",
        args,
        status: "failed",
        result: { content: [{ type: "text", text: "spawn failed" }] },
      })?.subagents,
    ).toEqual([
      {
        type: "upsert",
        id: "failed",
        title: "scout",
        description: "Inspect",
        toolCallId: "failed",
        status: "failed",
      },
    ]);
  });

  test("reports per-step terminal states while sibling steps keep running", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-pi-async-"));
    const session = piSubagents.createSession();
    try {
      session.mapToolCall!({
        callId: "call-1",
        toolName: "subagent",
        args: { agent: "scout", task: "Inspect", async: true },
        status: "completed",
        result: {
          details: { mode: "single", runId: "run-1", asyncId: "run-1", asyncDir: dir, results: [] },
        },
      });
      await writeFile(
        join(dir, "status.json"),
        JSON.stringify({
          state: "running",
          steps: [
            { agent: "scout", status: "complete" },
            { agent: "builder", status: "running" },
          ],
        }),
      );
      expect(session.poll?.().subagents).toEqual([
        { type: "upsert", id: "call-1:0", title: "scout", status: "completed" },
        { type: "upsert", id: "call-1:1", title: "builder", status: "running" },
      ]);
      // A repeat observation of the same state emits nothing and never claims the run finished.
      expect(session.poll?.()).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("reports a stopped run as canceled and stops polling it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-pi-async-"));
    const session = piSubagents.createSession();
    try {
      session.mapToolCall!({
        callId: "call-1",
        toolName: "subagent",
        args: { agent: "scout", task: "Inspect", async: true },
        status: "completed",
        result: {
          details: { mode: "single", runId: "run-1", asyncId: "run-1", asyncDir: dir, results: [] },
        },
      });
      await writeFile(
        join(dir, "status.json"),
        JSON.stringify({ state: "stopped", steps: [{ agent: "scout", status: "pending" }] }),
      );
      expect(session.poll?.().subagents).toEqual([
        { type: "upsert", id: "call-1", title: "scout", status: "canceled" },
      ]);
      // Terminal: no further polling or upserts.
      expect(session.poll?.()).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("missing or partial status files never manufacture a failure", async () => {
    const dir = await mkdtemp(join(tmpdir(), "paseo-pi-async-"));
    const session = piSubagents.createSession();
    try {
      session.mapToolCall!({
        callId: "call-1",
        toolName: "subagent",
        args: { agent: "scout", task: "Inspect", async: true },
        status: "completed",
        result: {
          details: { mode: "single", runId: "run-1", asyncId: "run-1", asyncDir: dir, results: [] },
        },
      });
      // No status file yet, then a truncated write: the child keeps its prior state.
      expect(session.poll?.()).toBeUndefined();
      await writeFile(join(dir, "status.json"), '{"state":"run');
      expect(session.poll?.()).toBeUndefined();
      // A valid later observation still reports.
      await writeFile(
        join(dir, "status.json"),
        JSON.stringify({ state: "running", steps: [{ agent: "scout", status: "running" }] }),
      );
      expect(session.poll?.().subagents).toEqual([
        { type: "upsert", id: "call-1", title: "scout", status: "running" },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("an unjudged result row is a neutral finish, not a failure", () => {
    const host = createPiExtensionHost();
    const out = host.mapToolCall({
      callId: "call-1",
      toolName: "subagent",
      args: { agent: "scout", task: "Inspect" },
      status: "completed",
      result: {
        details: {
          mode: "single",
          runId: "run-x",
          results: [{ agent: "scout", sessionFile: "/tmp/paseo-pi-unjudged.jsonl" }],
        },
      },
    });
    expect(out?.subagents).toEqual([
      {
        type: "upsert",
        id: "call-1",
        title: "scout",
        description: "Inspect",
        toolCallId: "call-1",
        status: "completed",
      },
    ]);
  });
});
