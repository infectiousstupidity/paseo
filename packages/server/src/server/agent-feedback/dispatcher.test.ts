import { afterEach, describe, expect, test, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FeedbackStore, type FeedbackNote } from "./store.js";
import { FeedbackDispatcher, type FeedbackParent } from "./dispatcher.js";

const roots: string[] = [];
function harness() {
  const home = mkdtempSync(join(tmpdir(), "feedback-dispatch-"));
  const cwd = mkdtempSync(join(tmpdir(), "feedback-seicho-git-"));
  roots.push(home, cwd);
  execFileSync("git", ["init", "-q", cwd]);
  execFileSync("git", ["-C", cwd, "remote", "add", "origin", "https://github.com/infectiousstupidity/seicho.git"]);
  const calls: Array<{ role: string; task: string; requestId: string }> = [];
  const parent: FeedbackParent = {
    id: "parent-1", provider: "pi", cwd, sessionId: "pi-session",
    spawn: async (input) => {
      calls.push(input);
      return { ok: true, requestId: input.requestId, runId: "run-" + calls.length };
    },
  };
  const dispatcher = new FeedbackDispatcher(new FeedbackStore(home));
  const note = (id: string, comment: string): FeedbackNote => ({
    sourceApp: "seicho-dev", sourceNamespace: "stable-session",
    annotationId: id, screen: "inbox", comment,
  });
  return { home, cwd, calls, parent, dispatcher, note };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("Per-annotation dispatcher", () => {
  test("two notes -> two isolated fresh child requests; duplicate does not spawn", async () => {
    const h = harness();
    const notes = [h.note("a", "Fix spacing"), h.note("b", "Fix contrast")];
    const receipts = await h.dispatcher.submit(h.parent, "stable-session", notes);
    expect(receipts).toHaveLength(2);
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));
    expect(h.calls[0]!.role).toBe("investigate");
    expect(h.calls[1]!.role).toBe("investigate");
    expect(h.calls[0]!.task).toContain("Fix spacing");
    expect(h.calls[0]!.task).not.toContain("Fix contrast");
    expect(h.calls[1]!.task).toContain("Fix contrast");
    expect(h.calls[1]!.task).not.toContain("Fix spacing");
    await h.dispatcher.submit(h.parent, "stable-session", notes);
    expect(h.calls).toHaveLength(2);
  });

  test("approval starts a fresh implementer only for approved record", async () => {
    const h = harness();
    const receipts = await h.dispatcher.submit(h.parent, "stable-session", [
      h.note("a", "Fix spacing"), h.note("b", "Fix contrast"),
    ]);
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));
    const { recordId, revision } = receipts[0]!;
    await vi.waitFor(() => expect(h.dispatcher.get(recordId).events.some(e => e.kind === "spawn_accepted")).toBe(true));
    h.dispatcher.recordProposal(recordId, revision, "Change the shared spacing token");
    h.dispatcher.approve(h.parent, recordId, revision);
    await vi.waitFor(() => expect(h.calls).toHaveLength(3));
    expect(h.calls[2]!.role).toBe("implement");
    expect(h.calls[2]!.task).toContain("Change the shared spacing token");
    expect(h.calls[2]!.task).not.toContain("Fix contrast");
    h.dispatcher.approve(h.parent, recordId, revision);
    expect(h.calls).toHaveLength(3);
    expect(h.dispatcher.get(receipts[1]!.recordId).events.some(e => e.kind === "approved")).toBe(false);
  });

  test("refuses foreign repository or wrong screen/namespace", async () => {
    const h = harness();
    execFileSync("git", ["-C", h.cwd, "remote", "set-url", "origin", "https://github.com/other/repo.git"]);
    await expect(h.dispatcher.submit(h.parent, "stable-session", [h.note("a", "Test")])).rejects.toThrow(/expected SEICHO/);
  });

  test("never starts more than two investigations without a resolved proposal", async () => {
    const h = harness();
    const notes = [h.note("a", "One"), h.note("b", "Two"), h.note("c", "Three")];
    const receipts = await h.dispatcher.submit(h.parent, "stable-session", notes);
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));
    h.dispatcher.recordProposal(receipts[0]!.recordId, receipts[0]!.revision, "Adjust one");
    await vi.waitFor(() => expect(h.calls).toHaveLength(3));
    expect(h.calls[2]!.task).toContain("Three");
  });
});
