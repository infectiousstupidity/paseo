import { describe, expect, test } from "vitest";
import { AgentFeedbackRequestSchema, AgentFeedbackResponseSchema } from "./messages.js";

const submit = {
  type: "agent.feedback.request", requestId: "req-1", action: "submit",
  parentAgentId: "parent", sourceNamespace: "stable-session", screen: "inbox",
  annotations: [{ id: "a", comment: "Increase contrast" }, { id: "b", comment: "Reduce padding" }],
};

describe("Agent feedback protocol", () => {
  test("accepts a bounded explicit two-note submission", () => {
    expect(AgentFeedbackRequestSchema.parse(submit)).toEqual(submit);
  });
  test("rejects bulk or private page data", () => {
    expect(AgentFeedbackRequestSchema.safeParse({ ...submit,
      annotations: [{ id: "a", comment: "Test", nearbyText: "personal contents" }] }).success).toBe(false);
    expect(AgentFeedbackRequestSchema.safeParse({ ...submit, selectedText: "private" }).success).toBe(false);
    expect(AgentFeedbackRequestSchema.safeParse({ ...submit,
      annotations: Array.from({length: 13}, (_, i) => ({id: String(i),comment: "Test"})) }).success).toBe(false);
    expect(AgentFeedbackRequestSchema.safeParse({ ...submit,
      annotations: [{id:"a",comment:"x".repeat(1201)}] }).success).toBe(false);
  });
  test("approval identifies a specific record and exact revision", () => {
    expect(AgentFeedbackRequestSchema.safeParse({
      type: "agent.feedback.request", requestId: "req-2", action: "approve",
      parentAgentId: "parent", recordId: "a".repeat(40),
      revision: "sha256:" + "f".repeat(64),
    }).success).toBe(true);
  });
  test("response distinguishes accepted work from an error", () => {
    expect(AgentFeedbackResponseSchema.safeParse({
      type: "agent.feedback.response", payload: {
        requestId: "req-1", success: false, error: "not authorized",
      },
    }).success).toBe(true);
  });
});
