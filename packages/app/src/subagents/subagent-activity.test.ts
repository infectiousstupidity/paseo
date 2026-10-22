import { describe, expect, it } from "vitest";
import type { ToolCallDetail } from "@getpaseo/protocol/agent-types";
import { deriveSubagentActivity, formatSubagentAge } from "./subagent-activity";
import type {
  AssistantMessageItem,
  StreamItem,
  ThoughtItem,
  ToolCallItem,
  UserMessageItem,
} from "@/types/stream";

let idCounter = 0;
const nextId = () => `item-${idCounter++}`;

type ToolStatus = "running" | "completed" | "failed" | "canceled";

function tool(name: string, detail: ToolCallDetail, status: ToolStatus = "running"): StreamItem {
  const item: ToolCallItem = {
    kind: "tool_call",
    id: nextId(),
    timestamp: new Date("2026-07-22T12:00:00.000Z"),
    payload: {
      source: "agent",
      data: {
        provider: "pi",
        callId: nextId(),
        name,
        status,
        error: null,
        detail,
      },
    },
  };
  return item;
}

function assistant(text: string): StreamItem {
  const item: AssistantMessageItem = {
    kind: "assistant_message",
    id: nextId(),
    text,
    timestamp: new Date("2026-07-22T12:00:01.000Z"),
  };
  return item;
}

function thought(text: string): StreamItem {
  const item: ThoughtItem = {
    kind: "thought",
    id: nextId(),
    text,
    timestamp: new Date("2026-07-22T12:00:02.000Z"),
    status: "ready",
  };
  return item;
}

function userPrompt(text: string): StreamItem {
  const item: UserMessageItem = {
    kind: "user_message",
    id: nextId(),
    text,
    timestamp: new Date("2026-07-22T12:00:03.000Z"),
  };
  return item;
}

describe("deriveSubagentActivity", () => {
  it("reports a running child's newest tool call with a short file target", () => {
    const tail = [
      assistant("Let me look at the source."),
      tool("edit", { type: "edit", filePath: "/very/long/path/to/src/foo.ts" }),
    ];
    expect(deriveSubagentActivity(tail, true)).toEqual({ kind: "tool", label: "edit foo.ts" });
  });

  it("stays stable while assistant text streams around the same tool call", () => {
    const call = tool("bash", { type: "shell", command: "npm test\nextra output" });
    const before = deriveSubagentActivity([call], true);
    const after = deriveSubagentActivity([call, assistant("partial answer")], true);
    expect(after).toEqual(before);
    expect(after).toEqual({ kind: "tool", label: "bash npm test" });
  });

  it("reports a finished child's last explicit response, first line only", () => {
    const tail = [
      tool("read", { type: "read", filePath: "a.ts" }, "completed"),
      assistant("Found 3 defects.\nSecond paragraph of the report.\nThird."),
    ];
    expect(deriveSubagentActivity(tail, false)).toEqual({
      kind: "response",
      text: "Found 3 defects.",
    });
  });

  it("skips Markdown-only headings and fences instead of presenting TL;DR as findings", () => {
    expect(deriveSubagentActivity([assistant("## TL;DR\n\n\`\`\`text\nFound two concrete failures.\n\`\`\`")], false))
      .toEqual({ kind: "response", text: "Found two concrete failures." });
    expect(deriveSubagentActivity([assistant("## Review\n### Findings")], false))
      .toEqual({ kind: "none" });
  });

  it("ignores boilerplate completion preambles before reporting an actual result", () => {
    expect(deriveSubagentActivity([assistant("All done. Summary of the run:\nFixed two layout defects.")], false))
      .toEqual({ kind: "response", text: "Fixed two layout defects." });
  });

  it("caps a long response at the excerpt limit", () => {
    const long = "x".repeat(200);
    expect(deriveSubagentActivity([assistant(long)], false)).toEqual({
      kind: "response",
      text: `${"x".repeat(79)}…`,
    });
  });

  it("collapses multiline commands and queries to their first line", () => {
    expect(
      deriveSubagentActivity(
        [tool("bash", { type: "shell", command: "  ls -la \n  cat foo" })],
        true,
      ),
    ).toEqual({ kind: "tool", label: "bash ls -la" });
  });

  it("never surfaces reasoning", () => {
    const tail = [thought("Planning the fix, considering options…")];
    expect(deriveSubagentActivity(tail, true)).toEqual({ kind: "none" });
    expect(deriveSubagentActivity(tail, false)).toEqual({ kind: "none" });
  });

  it("never surfaces the user prompt as progress", () => {
    const tail = [userPrompt("Review this change and report defects")];
    expect(deriveSubagentActivity(tail, true)).toEqual({ kind: "none" });
    expect(deriveSubagentActivity(tail, false)).toEqual({ kind: "none" });
  });

  it("falls back to the last tool call when a finished child gave no response", () => {
    const tail = [tool("search", { type: "search", query: "TODO" }, "completed")];
    expect(deriveSubagentActivity(tail, false)).toEqual({ kind: "tool", label: "search TODO" });
  });

  it("names the tool alone when the detail carries no short target", () => {
    const tail = [
      tool("todo_write", { type: "plain_text", label: "Todo", text: "a\nb\nc", icon: "sparkles" }),
    ];
    expect(deriveSubagentActivity(tail, true)).toEqual({ kind: "tool", label: "todo_write" });
  });

  it("reports none when no timeline has been observed", () => {
    expect(deriveSubagentActivity(undefined, true)).toEqual({ kind: "none" });
    expect(deriveSubagentActivity([], false)).toEqual({ kind: "none" });
  });

  it("scans only the bounded tail, newest event first", () => {
    const tail: StreamItem[] = [];
    for (let i = 0; i < 100; i += 1) tail.push(assistant(`older line ${i}`));
    tail.push(tool("edit", { type: "edit", filePath: "src/new.ts" }, "completed"));
    expect(deriveSubagentActivity(tail, false)).toEqual({ kind: "tool", label: "edit new.ts" });
  });

  it("moves a child's label from its running tool call to its last response exactly once", () => {
    const call = tool("edit", { type: "edit", filePath: "src/review.ts" });
    expect(deriveSubagentActivity([call], true)).toEqual({ kind: "tool", label: "edit review.ts" });

    // Tokens stream into an assistant message while the child is still running: no change.
    const streaming: StreamItem[] = [call, assistant("Drafting the report…")];
    expect(deriveSubagentActivity(streaming, true)).toEqual({
      kind: "tool",
      label: "edit review.ts",
    });

    // The child finishes: the row reports what it actually said, not a status word.
    const doneCall = tool("edit", { type: "edit", filePath: "src/review.ts" }, "completed");
    expect(
      deriveSubagentActivity([doneCall, assistant("2 defects found in the change.")], false),
    ).toEqual({
      kind: "response",
      text: "2 defects found in the change.",
    });
  });

  describe("daemon descriptor activity (Task 03)", () => {
    const desc = (label: string, at: string) => ({ kind: "tool" as const, label, at });
    const tailTool = tool("edit", { type: "edit", filePath: "src/review.ts" }); // 12:00:00Z

    it("prefers a newer descriptor while the child is running", () => {
      expect(
        deriveSubagentActivity([tailTool], true, desc("bash npm test", "2026-07-22T12:00:05.000Z")),
      ).toEqual({ kind: "tool", label: "bash npm test" });
    });

    it("keeps the timeline tail when the descriptor is older", () => {
      expect(
        deriveSubagentActivity([tailTool], true, desc("ls .", "2026-07-22T11:00:00.000Z")),
      ).toEqual({ kind: "tool", label: "edit review.ts" });
    });

    it("treats a tied timestamp as the daemon's (it observes every row)", () => {
      expect(
        deriveSubagentActivity(
          [tailTool],
          true,
          desc("write notes.md", "2026-07-22T12:00:00.000Z"),
        ),
      ).toEqual({ kind: "tool", label: "write notes.md" });
    });

    it("keeps a finished child's newer final response over the descriptor's tool", () => {
      const done = tool("edit", { type: "edit", filePath: "src/review.ts" }, "completed");
      expect(
        deriveSubagentActivity(
          [done, assistant("2 defects found in the change.")], // 12:00:01Z
          false,
          desc("edit review.ts", "2026-07-22T12:00:00.000Z"),
        ),
      ).toEqual({ kind: "response", text: "2 defects found in the change." });
    });

    it("prefers a newer descriptor over a stale pre-cap response in the retained tail", () => {
      // Beyond the caps the retained tail only holds early history; the daemon's descriptor is
      // the only signal that keeps advancing.
      expect(
        deriveSubagentActivity(
          [assistant("early scratch note")],
          false,
          desc("bash npm test", "2026-07-22T12:00:02.000Z"),
        ),
      ).toEqual({ kind: "tool", label: "bash npm test" });
    });

    it("reports the descriptor when no timeline has been observed at all", () => {
      expect(
        deriveSubagentActivity([], false, desc("read spec.md", "2026-07-22T12:00:00.000Z")),
      ).toEqual({ kind: "tool", label: "read spec.md" });
    });

    it("falls back to the timeline when the daemon omits the field", () => {
      expect(deriveSubagentActivity([tailTool], true, undefined)).toEqual({
        kind: "tool",
        label: "edit review.ts",
      });
      expect(deriveSubagentActivity([tailTool], true, null)).toEqual({
        kind: "tool",
        label: "edit review.ts",
      });
    });
  });
});

describe("formatSubagentAge", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");

  it("formats seconds, minutes, hours, and days", () => {
    expect(formatSubagentAge(new Date("2026-07-22T11:59:15.000Z"), now)).toBe("45s");
    expect(formatSubagentAge(new Date("2026-07-22T11:57:00.000Z"), now)).toBe("3m");
    expect(formatSubagentAge(new Date("2026-07-22T10:00:00.000Z"), now)).toBe("2h");
    expect(formatSubagentAge(new Date("2026-07-17T12:00:00.000Z"), now)).toBe("5d");
  });

  it("returns null for an invalid timestamp instead of inventing one", () => {
    expect(formatSubagentAge(new Date("not-a-date"), now)).toBeNull();
  });

  it("clamps a future timestamp to zero", () => {
    expect(formatSubagentAge(new Date("2026-07-22T12:00:30.000Z"), now)).toBe("0s");
  });
});
