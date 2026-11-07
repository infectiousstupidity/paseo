import { describe, expect, test } from "vitest";

import {
  mapToolDetail,
  parseToolArgs,
  parseToolResult,
  splitPiToolResultImages,
} from "./tool-call-mapper.js";

describe("Pi tool call mapper", () => {
  test("maps bash args and result to shell detail", () => {
    const toolCall = parseToolArgs("bash", { command: "echo hello" });
    const result = parseToolResult({ output: "hello\n", exitCode: 0 });

    expect(mapToolDetail(toolCall, result)).toEqual({
      type: "shell",
      command: "echo hello",
      output: "hello\n",
      exitCode: 0,
    });
  });

  test("maps legacy edit args to edit detail with diff", () => {
    const toolCall = parseToolArgs("edit", {
      path: "app.ts",
      old_string: "before",
      new_string: "after",
    });
    const result = parseToolResult({ details: { diff: "-before\n+after" } });

    expect(mapToolDetail(toolCall, result)).toEqual({
      type: "edit",
      filePath: "app.ts",
      oldString: "before",
      newString: "after",
      unifiedDiff: "-before\n+after",
    });
  });

  test("preserves ordinary writes as write details", () => {
    const toolCall = parseToolArgs("write", {
      path: "notes.txt",
      content: "unchanged\n",
    });

    expect(mapToolDetail(toolCall, parseToolResult({ text: "Wrote notes.txt" }))).toEqual({
      type: "write",
      filePath: "notes.txt",
      content: "unchanged\n",
    });
  });

  test("preserves unknown tool input and parsed output", () => {
    const toolCall = parseToolArgs("custom_tool", { value: 42 });
    const result = parseToolResult({ text: "custom result" });

    expect(mapToolDetail(toolCall, result)).toEqual({
      type: "unknown",
      input: { value: 42 },
      output: { text: "custom result" },
    });
  });
});


test("extracts image blocks while retaining structured metadata and placeholders", () => {
  const result = splitPiToolResultImages(
    parseToolResult({
      content: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
      structuredContent: {
        kind: "snapshot",
        nested: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png", tag: "preserve" }],
      },
    }),
  );
  expect(result.images).toEqual([{ data: "aGVsbG8=", mimeType: "image/png" }]);
  expect(result.result).toMatchObject({
    content: [{ type: "text", text: "[image]" }],
    structuredContent: {
      kind: "snapshot",
      nested: [{ type: "image", data: "[image]", tag: "preserve" }],
    },
  });
});
