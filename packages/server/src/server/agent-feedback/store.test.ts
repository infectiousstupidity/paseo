import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FeedbackStore, feedbackId, type FeedbackNote } from "./store.js";

const roots: string[] = [];
function setup() {
  const root = mkdtempSync(join(tmpdir(), "paseo-feedback-test-"));
  roots.push(root);
  return { root, store: new FeedbackStore(root) };
}
const note: FeedbackNote = {
  sourceApp: "seicho-dev", sourceNamespace: "stable-instance",
  annotationId: "one", screen: "inbox", comment: "Improve the nav contrast",
};
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe("Global agent feedback ledger", () => {
  test("creates private, idempotent markdown before any child spawn", () => {
    const { root, store } = setup();
    const { record, revision } = store.submit(note);
    expect(record.recordId).toBe(feedbackId(note));
    expect(store.submit(note).record.events).toHaveLength(1);
    const file = readFileSync(join(root, ".agents", "feedback", "seicho", record.recordId + ".md"), "utf8");
    expect(file).toContain('schema: "agent-feedback/v1"');
    expect(file).toContain("> Improve the nav contrast");
    expect(store.load(record.recordId).revisions[0]?.digest).toBe(revision);
  });

  test("preserves original feedback on revised submission and separately scopes sources", () => {
    const { store } = setup();
    const first = store.submit(note);
    const second = store.submit({ ...note, comment: "# UI\\nMarkdown fences ``` should be safe" });
    expect(second.record.recordId).toBe(first.record.recordId);
    expect(second.record.original).toBe(note.comment);
    expect(second.record.events.map(e => e.kind)).toEqual(["submitted", "revision_submitted"]);
    expect(store.submit({ ...note, annotationId: "two" }).record.recordId).not.toBe(first.record.recordId);
    expect(store.submit({ ...note, sourceNamespace: "another-instance" }).record.recordId).not.toBe(first.record.recordId);
  });

  test("single durable irreversible claim; lost reply cannot spawn twice", () => {
    const { store } = setup();
    const { record, revision } = store.submit(note);
    expect(store.reserve(record.recordId, revision, "investigate", "req-1", "parent", "session")).toBe(true);
    expect(store.reserve(record.recordId, revision, "investigate", "req-2", "parent", "session")).toBe(false);
    expect(store.active("investigate")).toContain(record.recordId);
    store.append(record.recordId, { kind: "spawn_accepted", phase: "investigate",
      requestId: "req-1", revision, runId: "run-1" });
    store.append(record.recordId, { kind: "proposal_ready", revision, proposal: "Change CSS token" });
    expect(store.active("investigate")).not.toContain(record.recordId);
  });

  test("implement phase requires approval; only operator outcome closes it", () => {
    const { store } = setup();
    const { record, revision } = store.submit(note);
    expect(() => store.reserve(record.recordId, revision, "implement", "req-2", "parent", "session")).toThrow(/approval/);
    store.append(record.recordId, { kind: "approved", revision, proposal: "Change CSS token" });
    expect(store.reserve(record.recordId, revision, "implement", "req-2", "parent", "session")).toBe(true);
    expect(store.active("implement")).toContain(record.recordId);
    store.append(record.recordId, { kind: "verified", phase: "implement", revision, evidence: "Visual capture reviewed" });
    expect(store.active("implement")).not.toContain(record.recordId);
  });

  test("rejects injected fields, screen reuse, and symlinked feedback root", () => {
    const { store } = setup();
    store.submit(note);
    expect(() => store.submit({ ...note, screen: "today" })).toThrow(/collision/);
    expect(() => store.submit({ ...note, selectedText: "secret" } as unknown as FeedbackNote)).toThrow();
    expect(() => store.submit({ ...note, annotationId: "../traverse" })).toThrow();
    const other = setup();
    mkdirSync(join(other.root, ".agents"));
    symlinkSync(rootDir(), join(other.root, ".agents", "feedback"));
    expect(() => other.store.submit(note)).toThrow(/Unsafe feedback directory/);
  });
});
function rootDir() { return tmpdir(); }
