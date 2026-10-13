import { describe, expect, test } from "vitest";
import { SessionInboundMessageSchema, SessionOutboundMessageSchema } from "./messages.js";

describe("provider subagent protocol", () => {
  test("accepts only scoped actions without native IDs or RPC passthrough", () => {
    const base = {
      type: "agent.provider_subagents.control.request",
      parentAgentId: "parent", subagentId: "display-row", requestId: "request",
      action: "stop",
    };
    expect(SessionInboundMessageSchema.safeParse(base).success).toBe(true);
    expect(SessionInboundMessageSchema.safeParse({ ...base, action: "spawn" }).success).toBe(false);
    expect(SessionInboundMessageSchema.safeParse({ ...base, runId: "native-run" }).success).toBe(false);
    expect(SessionInboundMessageSchema.safeParse({ ...base, asyncDir: "/tmp/stale" }).success).toBe(false);
    expect(SessionInboundMessageSchema.safeParse({ ...base, method: "stop" }).success).toBe(false);
    expect(SessionOutboundMessageSchema.parse({
      type: "agent.provider_subagents.control.response",
      payload: {
        requestId: "request", parentAgentId: "parent", subagentId: "display-row",
        action: "steer", success: true, deliveryStatus: "queued", error: null,
      },
    }).payload).toMatchObject({ deliveryStatus: "queued" });
  });

  test("rejects unproven interrupt and resume controls at the wire boundary", () => {
    for (const action of ["interrupt", "resume"]) {
      const request = {
        type: "agent.provider_subagents.control.request",
        parentAgentId: "parent",
        subagentId: "display-row",
        requestId: "request",
        action,
        message: "Resume this selected child with the next task",
      };
      // A nonempty instruction must never make an unverified action admissible.
      expect(SessionInboundMessageSchema.safeParse(request).success).toBe(false);
      // The response schema must not advertise an action unavailable in the daemon.
      expect(SessionOutboundMessageSchema.safeParse({
        type: "agent.provider_subagents.control.response",
        payload: {
          requestId: "request",
          parentAgentId: "parent",
          subagentId: "display-row",
          action,
          success: true,
          error: null,
        },
      }).success).toBe(false);
    }
  });

  test("accepts a scoped timeline request and structured live update", () => {
    expect(
      SessionInboundMessageSchema.parse({
        type: "agent.provider_subagents.timeline.get.request",
        parentAgentId: "parent-1",
        subagentId: "child-1",
        requestId: "request-1",
      }),
    ).toMatchObject({ parentAgentId: "parent-1", subagentId: "child-1" });

    expect(
      SessionOutboundMessageSchema.parse({
        type: "agent.provider_subagents.update",
        payload: {
          kind: "timeline",
          parentAgentId: "parent-1",
          subagentId: "child-1",
          provider: "claude",
          epoch: "epoch-1",
          seq: 4,
          timestamp: "2026-07-12T10:00:00.000Z",
          item: { type: "assistant_message", text: "Found it." },
        },
      }),
    ).toMatchObject({
      payload: {
        kind: "timeline",
        parentAgentId: "parent-1",
        subagentId: "child-1",
        seq: 4,
      },
    });
  });

  test("accepts a provider child working directory while remaining compatible when absent", () => {
    const descriptor = {
      id: "child-1",
      parentAgentId: "parent-1",
      provider: "opencode",
      title: "Explore",
      description: null,
      status: "running",
      createdAt: "2026-07-12T10:00:00.000Z",
      updatedAt: "2026-07-12T10:00:00.000Z",
      toolCallId: null,
    };

    expect(
      SessionOutboundMessageSchema.parse({
        type: "agent.provider_subagents.list.response",
        payload: {
          requestId: "request-1",
          parentAgentId: "parent-1",
          subagents: [{ ...descriptor, cwd: "/workspace/child" }],
          error: null,
        },
      }),
    ).toMatchObject({ payload: { subagents: [{ cwd: "/workspace/child" }] } });

    expect(
      SessionOutboundMessageSchema.parse({
        type: "agent.provider_subagents.list.response",
        payload: {
          requestId: "request-2",
          parentAgentId: "parent-1",
          subagents: [descriptor],
          error: null,
        },
      }),
    ).toMatchObject({ payload: { subagents: [{ id: "child-1" }] } });
  });

  test("accepts bounded subagent activity while remaining compatible when absent", () => {
    const descriptor = {
      id: "child-1",
      parentAgentId: "parent-1",
      provider: "pi",
      title: "Explore",
      description: null,
      status: "running",
      createdAt: "2026-07-12T10:00:00.000Z",
      updatedAt: "2026-07-12T10:00:00.000Z",
      toolCallId: null,
    };

    // Older daemons omit the field entirely; pre-existing clients ignore it when present.
    expect(
      SessionOutboundMessageSchema.parse({
        type: "agent.provider_subagents.update",
        payload: { kind: "upsert", subagent: descriptor },
      }),
    ).toMatchObject({ payload: { subagent: { id: "child-1" } } });

    expect(
      SessionOutboundMessageSchema.parse({
        type: "agent.provider_subagents.update",
        payload: {
          kind: "upsert",
          subagent: {
            ...descriptor,
            activity: { kind: "tool", label: "edit track.tsx", at: "2026-07-12T10:00:01.000Z" },
          },
        },
      }),
    ).toMatchObject({
      payload: { subagent: { activity: { kind: "tool", label: "edit track.tsx" } } },
    });
  });
});
