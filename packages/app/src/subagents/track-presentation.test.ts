import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@/i18n/i18next";
import type { PaseoSubagentRow, ProviderSubagentRow, SubagentRow } from "./select";
import { isFinishedSubagent } from "./archive-finished";
import {
  buildSubagentPillPresentation,
  buildSubagentRowPresentationData,
  countFinishedSubagents,
  orderSubagentRows,
  resolveRowLabel,
  resolveSubagentState,
} from "./track-presentation";

function row(
  overrides: Partial<PaseoSubagentRow> & Pick<PaseoSubagentRow, "id">,
): PaseoSubagentRow {
  return {
    kind: "paseo",
    id: overrides.id,
    provider: overrides.provider ?? "codex",
    title: overrides.title ?? `Agent ${overrides.id}`,
    description: null,
    subtitle: null,
    status: overrides.status ?? "idle",
    turn:
      overrides.turn ??
      (overrides.status === "running"
        ? { phase: "open", turnId: null, startedAt: null, cancellationRequestId: null }
        : { phase: "idle", cancellationRequestId: null }),
    requiresAttention: overrides.requiresAttention ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-04-20T00:00:00.000Z"),
  };
}

describe("buildSubagentPillPresentation", () => {
  // The real instance, so a label that names a key nobody added renders as that key and fails.
  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await i18n.init();
    }
    await i18n.changeLanguage("en");
  });

  const pill = (rows: SubagentRow[]) => buildSubagentPillPresentation(i18n.t, rows);

  it("counts the children that are working, not the fan-out", () => {
    expect(pill([row({ id: "a" }), row({ id: "b", status: "running" })])).toEqual({
      segments: [{ bucket: "running", text: "1 working" }],
      accessibilityLabel: "1 working",
    });
  });

  it("counts every child in the state it reports", () => {
    expect(
      pill([
        row({ id: "a", status: "running" }),
        row({ id: "b", status: "running" }),
        row({ id: "c" }),
      ]),
    ).toEqual({
      segments: [{ bucket: "running", text: "2 working" }],
      accessibilityLabel: "2 working",
    });
  });

  it("keeps a working child visible behind a failed one instead of collapsing to the worst", () => {
    expect(
      pill([
        row({ id: "a", status: "running" }),
        row({ id: "b", status: "error", requiresAttention: true }),
        row({ id: "c", status: "error" }),
      ]),
    ).toEqual({
      segments: [
        { bucket: "failed", text: "2 failed" },
        { bucket: "running", text: "1 working" },
      ],
      accessibilityLabel: "2 failed, 1 working",
    });
  });

  it("names what it opens once every child is done", () => {
    expect(pill([row({ id: "a" }), row({ id: "b" })])).toEqual({
      segments: [{ bucket: null, text: "2 subagents" }],
      accessibilityLabel: "2 subagents",
    });
  });

  it("keeps the singular for a lone child", () => {
    expect(pill([row({ id: "a" })])).toEqual({
      segments: [{ bucket: null, text: "1 subagent" }],
      accessibilityLabel: "1 subagent",
    });
  });

  it("has nothing to mark without rows", () => {
    expect(pill([])).toEqual({
      segments: [{ bucket: null, text: "0 subagents" }],
      accessibilityLabel: "0 subagents",
    });
  });
});

describe("countFinishedSubagents", () => {
  it("counts eligible managed and terminal provider-owned children", () => {
    const providerRows: SubagentRow[] = [
      {
        kind: "provider",
        id: "native-running",
        parentAgentId: "parent",
        provider: "claude",
        title: "running",
        description: null,
        subtitle: null,
        status: "running",
        requiresAttention: false,
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
      },
      {
        kind: "provider",
        id: "native-failed",
        parentAgentId: "parent",
        provider: "claude",
        title: "failed",
        description: null,
        subtitle: null,
        status: "failed",
        requiresAttention: true,
        createdAt: new Date("2026-04-20T00:00:01.000Z"),
      },
    ];

    expect(
      countFinishedSubagents([
        row({ id: "managed-running", status: "running" }),
        row({ id: "managed-idle", status: "idle" }),
        ...providerRows,
      ]),
    ).toBe(2);
  });

  it("excludes running and initializing managed children", () => {
    expect(
      countFinishedSubagents([
        row({ id: "running", status: "running" }),
        row({ id: "initializing", status: "initializing" }),
        row({ id: "finished", status: "idle" }),
      ]),
    ).toBe(1);
  });
});

describe("resolveRowLabel", () => {
  it("returns null when title is not a string", () => {
    expect(resolveRowLabel(null as unknown as SubagentRow["title"])).toBe(null);
  });

  it("returns null for whitespace-only titles", () => {
    expect(resolveRowLabel("   ")).toBe(null);
  });

  it("returns null for the placeholder 'new agent' regardless of case", () => {
    expect(resolveRowLabel("new agent")).toBe(null);
    expect(resolveRowLabel("New Agent")).toBe(null);
    expect(resolveRowLabel("  NEW AGENT  ")).toBe(null);
  });

  it("returns the trimmed title for real names", () => {
    expect(resolveRowLabel("  Build the thing  ")).toBe("Build the thing");
  });
});

describe("buildSubagentRowPresentationData", () => {
  it("namespaces the key with a subagent prefix", () => {
    expect(buildSubagentRowPresentationData(row({ id: "child-a" })).key).toBe(
      "paseo_subagent_child-a",
    );
  });

  it("marks the row ready when the title resolves to a real label", () => {
    const presentation = buildSubagentRowPresentationData(row({ id: "a", title: "Build it" }));
    expect(presentation.titleState).toBe("ready");
    expect(presentation.label).toBe("Build it");
  });

  it("marks the row loading and blanks the label for the placeholder title", () => {
    const presentation = buildSubagentRowPresentationData(row({ id: "a", title: "new agent" }));
    expect(presentation.titleState).toBe("loading");
    expect(presentation.label).toBe("");
  });

  it("maps a running row to the running status bucket so callers render the synced loader", () => {
    expect(buildSubagentRowPresentationData(row({ id: "a", status: "running" })).statusBucket).toBe(
      "running",
    );
  });

  it("maps an idle row to the done status bucket so callers render the static provider icon", () => {
    expect(buildSubagentRowPresentationData(row({ id: "a", status: "idle" })).statusBucket).toBe(
      "done",
    );
  });

  it("ignores requiresAttention on the source row when computing the bucket", () => {
    expect(
      buildSubagentRowPresentationData(row({ id: "a", status: "idle", requiresAttention: true }))
        .statusBucket,
    ).toBe("done");
  });
});

describe("buildSubagentRowPresentationData for provider rows", () => {
  function providerRow(overrides: Partial<ProviderSubagentRow> = {}): ProviderSubagentRow {
    return {
      kind: "provider",
      id: overrides.id ?? "toolu_1",
      parentAgentId: "parent",
      provider: "claude",
      title: "title" in overrides ? (overrides.title ?? null) : "general-purpose",
      description: overrides.description ?? null,
      subtitle: overrides.subtitle ?? null,
      status: overrides.status ?? "running",
      requiresAttention: false,
      createdAt: overrides.createdAt ?? new Date("2026-07-26T00:00:00.000Z"),
    };
  }

  it("names the row after the task and demotes the subagent type", () => {
    const presentation = buildSubagentRowPresentationData(
      providerRow({ title: "general-purpose", description: "Reply with banana" }),
    );
    expect(presentation.label).toBe("Reply with banana");
    expect(presentation.subtitle).toBe("general-purpose");
  });

  it("tells two siblings of the same type apart", () => {
    const left = buildSubagentRowPresentationData(
      providerRow({ id: "a", description: "Summarize the docs" }),
    );
    const right = buildSubagentRowPresentationData(
      providerRow({ id: "b", description: "Reply with banana" }),
    );
    expect(left.label).not.toBe(right.label);
  });

  it("keeps type-as-label and an empty subtitle when a provider reports no task", () => {
    const presentation = buildSubagentRowPresentationData(
      providerRow({ title: "Provider child", description: null }),
    );
    expect(presentation.label).toBe("Provider child");
    expect(presentation.subtitle).toBe("");
  });

  it("stays in the loading state when neither field is known", () => {
    const presentation = buildSubagentRowPresentationData(
      providerRow({ title: null, description: null }),
    );
    expect(presentation.titleState).toBe("loading");
  });

  it("leaves managed subagent rows with no subtitle", () => {
    expect(buildSubagentRowPresentationData(row({ id: "a", title: "Managed" })).subtitle).toBe("");
  });
});

describe("provider-owned row subtitles", () => {
  function providerRow(overrides: Partial<ProviderSubagentRow> = {}): ProviderSubagentRow {
    return {
      kind: "provider",
      id: "toolu_1",
      parentAgentId: "parent",
      provider: "claude",
      title: "general-purpose",
      description: "Reply with banana",
      subtitle: null,
      status: "running",
      requiresAttention: false,
      createdAt: new Date("2026-07-26T00:00:00.000Z"),
      ...overrides,
    };
  }

  it("displays provider context without interpreting it", () => {
    expect(
      buildSubagentRowPresentationData(
        providerRow({ subtitle: "general-purpose · Opus 5 · High · 16.5k tokens" }),
      ).subtitle,
    ).toBe("general-purpose · Opus 5 · High · 16.5k tokens");
  });

  it("falls back to the type when an older provider sends no subtitle", () => {
    expect(buildSubagentRowPresentationData(providerRow()).subtitle).toBe("general-purpose");
  });

  it("does not duplicate the type when it is already the primary label", () => {
    expect(
      buildSubagentRowPresentationData(
        providerRow({ description: null, subtitle: null, title: "general-purpose" }),
      ).subtitle,
    ).toBe("");
  });
});

describe("resolveSubagentState", () => {
  function providerRow(overrides: Partial<ProviderSubagentRow> & { id: string }): SubagentRow {
    return {
      kind: "provider",
      id: overrides.id,
      parentAgentId: "parent",
      provider: "claude",
      title: "general-purpose",
      description: null,
      subtitle: null,
      status: overrides.status ?? "running",
      requiresAttention: false,
      createdAt: new Date("2026-07-26T00:00:00.000Z"),
    };
  }

  it("maps provider statuses to neutral lifecycle words", () => {
    expect(resolveSubagentState(providerRow({ id: "a", status: "running" }))).toBe("running");
    expect(resolveSubagentState(providerRow({ id: "a", status: "completed" }))).toBe("finished");
    expect(resolveSubagentState(providerRow({ id: "a", status: "failed" }))).toBe("failed");
    expect(resolveSubagentState(providerRow({ id: "a", status: "canceled" }))).toBe("canceled");
  });

  it("never calls a completed child anything other than finished", () => {
    expect(
      resolveSubagentState(
        providerRow({ id: "a", status: "completed", description: "Review the change" }),
      ),
    ).toBe("finished");
  });

  it("derives managed children from their turn and status", () => {
    expect(resolveSubagentState(row({ id: "a", status: "running" }))).toBe("running");
    expect(resolveSubagentState(row({ id: "a", status: "error" }))).toBe("failed");
    expect(resolveSubagentState(row({ id: "a" }))).toBe("finished");
    // Still starting up: nothing to name yet, so the word stays absent.
    expect(resolveSubagentState(row({ id: "a", status: "initializing" }))).toBeNull();
  });
});

describe("orderSubagentRows", () => {
  function providerRow(
    id: string,
    status: "running" | "completed" | "failed" | "canceled",
  ): ProviderSubagentRow {
    return {
      kind: "provider",
      id,
      parentAgentId: "parent",
      provider: "claude",
      title: null,
      description: null,
      subtitle: null,
      status,
      requiresAttention: false,
      createdAt: new Date("2026-07-26T00:00:00.000Z"),
    };
  }

  it("keeps running and failed children ahead of terminal ones", () => {
    const rows = [
      providerRow("f1", "completed"),
      providerRow("r1", "running"),
      providerRow("f2", "completed"),
      providerRow("x1", "failed"),
      providerRow("c1", "canceled"),
      providerRow("f3", "completed"),
    ];
    expect(orderSubagentRows(rows).map((r) => r.id)).toEqual(["r1", "x1", "f1", "f2", "c1", "f3"]);
  });

  it("orders by attention, not archiving: a failed child sorts first but still counts as finished", () => {
    const failed = providerRow("x1", "failed");
    const done = providerRow("f1", "completed");
    expect(orderSubagentRows([done, failed]).map((r) => r.id)).toEqual(["x1", "f1"]);
    expect(isFinishedSubagent(failed)).toBe(true);
  });

  it("preserves creation order inside each group", () => {
    const base = Date.parse("2026-07-26T00:00:00.000Z");
    const at = (minutes: number) => new Date(base + minutes * 60_000);
    const oldDone: SubagentRow = { ...providerRow("old-done", "completed"), createdAt: at(1) };
    const oldRun: SubagentRow = { ...providerRow("old-run", "running"), createdAt: at(2) };
    const newDone: SubagentRow = { ...providerRow("new-done", "completed"), createdAt: at(3) };
    const newRun: SubagentRow = { ...providerRow("new-run", "running"), createdAt: at(4) };
    expect(orderSubagentRows([oldDone, oldRun, newDone, newRun]).map((r) => r.id)).toEqual([
      "old-run",
      "new-run",
      "old-done",
      "new-done",
    ]);
  });

  it("moves a row only when it crosses the finished boundary", () => {
    const a = providerRow("a", "running");
    const b = providerRow("b", "completed");
    const c = providerRow("c", "running");
    const before = orderSubagentRows([a, b, c]);
    const finishedA: ProviderSubagentRow = { ...a, status: "completed" };
    const after = orderSubagentRows([finishedA, b, c]);
    expect(before.map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(after.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("mixes provider and managed children in one fan-out without inventing groupings", () => {
    const base = Date.parse("2026-07-26T00:00:00.000Z");
    const at = (minutes: number) => new Date(base + minutes * 60_000);
    // A realistic fan-out: one running provider child, two finished siblings of the same type,
    // a failed provider child, a canceled one, a running managed child, and a finished managed
    // child.
    const rows: SubagentRow[] = [
      { ...providerRow("p-done-1", "completed"), createdAt: at(1), title: "reviewer" },
      { ...providerRow("p-run", "running"), createdAt: at(2), title: "reviewer" },
      { ...providerRow("p-done-2", "completed"), createdAt: at(3), title: "reviewer" },
      { ...providerRow("p-failed", "failed"), createdAt: at(4), title: "fixer" },
      { ...providerRow("p-canceled", "canceled"), createdAt: at(5), title: "explorer" },
      { ...row({ id: "m-run", status: "running" }), createdAt: at(6) },
      { ...row({ id: "m-done" }), createdAt: at(7) },
    ];
    const ordered = orderSubagentRows(rows);
    // Working and failed children first (in creation order), terminal ones after.
    expect(ordered.map((r) => r.id)).toEqual([
      "p-run",
      "p-failed",
      "m-run",
      "p-done-1",
      "p-done-2",
      "p-canceled",
      "m-done",
    ]);
    // The repeated agent type does not create a group; siblings keep creation order.
    const reviewers = ordered.filter((r) => r.kind === "provider" && r.title === "reviewer");
    expect(reviewers.map((r) => r.id)).toEqual(["p-run", "p-done-1", "p-done-2"]);
  });
});
