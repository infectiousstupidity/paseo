import { describe, expect, it } from "vitest";

import {
  buildLineDiff,
  parseUnifiedDiff,
  extractTaskEntriesFromToolCall,
} from "./tool-call-parsers";

describe("tool-call-parsers", () => {
  it("builds line diff for text changes", () => {
    const diff = buildLineDiff("old\nline\n", "new\nline\n");

    expect(diff.some((entry) => entry.type === "remove")).toBe(true);
    expect(diff.some((entry) => entry.type === "add")).toBe(true);
  });

  it("parses unified diff", () => {
    const parsed = parseUnifiedDiff("@@\n-old\n+new\n");

    expect(parsed.find((entry) => entry.type === "remove")?.content).toBe("-old");
    expect(parsed.find((entry) => entry.type === "add")?.content).toBe("+new");
  });

  it("preserves file boundaries in a multi-file unified diff", () => {
    const diff = [
      "diff --git a/alpha.txt b/alpha.txt",
      "--- a/alpha.txt",
      "+++ b/alpha.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "diff --git a/beta.txt b/beta.txt",
      "--- a/beta.txt",
      "+++ b/beta.txt",
      "@@ -1 +1 @@",
      "-before",
      "+after",
    ].join("\n");
    const parsed = parseUnifiedDiff(diff);
    expect(parsed.filter((line) => line.type === "header").map((line) => line.content)).toEqual([
      "diff --git a/alpha.txt b/alpha.txt",
      "@@ -1 +1 @@",
      "diff --git a/beta.txt b/beta.txt",
      "@@ -1 +1 @@",
    ]);
    expect(parsed.filter((line) => line.type === "add").map((line) => line.content)).toEqual([
      "+new",
      "+after",
    ]);
  });

  it("extracts TodoWrite task entries", () => {
    const tasks = extractTaskEntriesFromToolCall("TodoWrite", {
      todos: [
        { content: "Task 1", status: "pending" },
        { content: "Task 2", status: "completed" },
      ],
    });

    expect(tasks?.map((task) => task.text)).toEqual(["Task 1", "Task 2"]);
    expect(tasks?.map((task) => task.completed)).toEqual([false, true]);
  });
});
