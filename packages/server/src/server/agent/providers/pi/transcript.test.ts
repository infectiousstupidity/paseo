import { describe, expect, test } from "vitest";

import { readPiTranscript } from "./transcript.js";

function jsonl(...entries: object[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}

describe("persisted Pi transcript ancestry", () => {
  test("preserves messages and native user IDs on both sides of compaction", () => {
    const transcript = readPiTranscript(
      jsonl(
        { type: "session", version: 3 },
        { type: "message", id: "u1", parentId: null, message: { role: "user", content: "before" } },
        {
          type: "message",
          id: "a1",
          parentId: "u1",
          message: { role: "assistant", content: [{ type: "text", text: "first" }] },
        },
        {
          type: "message",
          id: "abandoned",
          parentId: "a1",
          message: { role: "user", content: "abandoned branch" },
        },
        { type: "compaction", id: "compact", parentId: "a1", summary: "compressed" },
        {
          type: "message",
          id: "u2",
          parentId: "compact",
          message: { role: "user", content: "after" },
        },
        {
          type: "message",
          id: "a2",
          parentId: "u2",
          message: { role: "assistant", content: [{ type: "text", text: "second" }] },
        },
      ),
    );
    expect(transcript.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(transcript.userEntries).toEqual([
      { id: "u1", text: "before" },
      { id: "u2", text: "after" },
    ]);
  });

  test("keeps native rewind markers in ancestry and omits abandoned branches", () => {
    const transcript = readPiTranscript(
      jsonl(
        { type: "session", version: 3 },
        { type: "message", id: "u1", parentId: null, message: { role: "user", content: "first" } },
        { type: "message", id: "a1", parentId: "u1", message: { role: "assistant", content: [] } },
        {
          type: "message",
          id: "abandoned",
          parentId: "a1",
          message: { role: "user", content: "old" },
        },
        { type: "paseo_rewind", id: "rewind", parentId: "a1", data: { targetId: "a1" } },
        {
          type: "message",
          id: "u2",
          parentId: "rewind",
          message: { role: "user", content: "new" },
        },
      ),
    );
    expect(transcript.userEntries).toEqual([
      { id: "u1", text: "first" },
      { id: "u2", text: "new" },
    ]);
  });

  test("rejects missing ancestors rather than showing an incorrect branch", () => {
    expect(() =>
      readPiTranscript(
        jsonl(
          { type: "session", version: 3 },
          {
            type: "message",
            id: "u1",
            parentId: "missing",
            message: { role: "user", content: "bad" },
          },
        ),
      ),
    ).toThrow("Missing Pi transcript ancestor");
  });

  test("ignores native system messages on the active branch", () => {
    const transcript = readPiTranscript(
      jsonl(
        { type: "session", version: 3 },
        {
          type: "message",
          id: "system",
          parentId: null,
          message: {
            role: "system",
            content: [{ type: "text", text: "internal" }],
          },
        },
        {
          type: "message",
          id: "user",
          parentId: "system",
          message: { role: "user", content: "visible" },
        },
      ),
    );
    expect(transcript.userEntries).toEqual([{ id: "user", text: "visible" }]);
  });
});
