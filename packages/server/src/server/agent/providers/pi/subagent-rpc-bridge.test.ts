import { describe, expect, test } from "vitest";
import { parsePiSubagentRpcReply } from "./subagent-rpc-bridge.js";

const requestId = "12345678-1234-1234-1234-123456789abc";
const reply = (method: string, data: Record<string, unknown>) => ({
  version: 1, requestId, method, success: true, data,
});

describe("scoped Pi subagent RPC receipts", () => {
  test("only accepts exact stop child acknowledgement, never a whole-run receipt", () => {
    expect(parsePiSubagentRpcReply(
      reply("stop", { runId: "run-1", state: "stopping", childId: "native-child" }),
      requestId, "stop", "session-1",
    )).toMatchObject({ ok: true });
    expect(parsePiSubagentRpcReply(
      reply("stop", { runId: "run-1", state: "stopping" }),
      requestId, "stop", "session-1",
    )).toMatchObject({ ok: false, reason: "invalid_reply" });
    expect(parsePiSubagentRpcReply(
      reply("stop", { runId: "run-1", state: "stopped", childId: "native-child" }),
      requestId, "stop", "session-1",
    )).toMatchObject({ ok: false, reason: "invalid_reply" });
  });

  test("steer preserves queued vs delivered and rejects unacknowledged delivery", () => {
    for (const deliveryStatus of ["queued", "delivered"]) {
      expect(parsePiSubagentRpcReply(
        reply("steer", { text: "", details: { deliveryStatus } }),
        requestId, "steer", "session-1",
      )).toMatchObject({ ok: true, data: { details: { deliveryStatus } } });
    }
    expect(parsePiSubagentRpcReply(
      reply("steer", { text: "Maybe delivered" }),
      requestId, "steer", "session-1",
    )).toMatchObject({ ok: false, reason: "invalid_reply" });
  });

  test("rejects mismatched, unsupported and oversized replies", () => {
    expect(parsePiSubagentRpcReply(
      { ...reply("status", { text: "running" }), version: 2 },
      requestId, "status", "session-1",
    )).toMatchObject({ ok: false, reason: "unsupported" });
    expect(parsePiSubagentRpcReply(
      reply("stop", { state: "stopping", childId: "native-child" }),
      "different", "stop", "session-1",
    )).toMatchObject({ ok: false, reason: "invalid_reply" });
  });
});
