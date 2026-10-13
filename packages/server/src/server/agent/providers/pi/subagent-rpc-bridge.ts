/** Narrow, correlated Pi subagent RPC bridge. No generic method/path dispatch. */
export const PI_SUBAGENT_RPC_COMMAND = "paseo_subagent_rpc";
export const PI_SUBAGENT_RPC_MARKER = "PASEO_SUBAGENT_RPC";
export const PI_SUBAGENT_RPC_TIMEOUT_MS = 8_000;
export const PI_SUBAGENT_RPC_MAX_BYTES = 16 * 1024;

export type PiSubagentRpcMethod = "ping" | "status" | "stop" | "steer";
export type PiSubagentRpcFailureReason = "busy" | "unavailable" | "timeout" | "unsupported" | "invalid_target" | "closed" | "invalid_reply" | "error";
export type PiSubagentRpcResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: PiSubagentRpcFailureReason; message: string };

const reasons = new Set<PiSubagentRpcFailureReason>([
  "busy", "unavailable", "timeout", "unsupported", "invalid_target", "closed", "invalid_reply", "error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validPiSubagentRunId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(id);
}

export function parsePiSubagentRpcReply(
  raw: unknown,
  requestId: string,
  method: PiSubagentRpcMethod,
  parentSessionId: string,
): PiSubagentRpcResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: "invalid_reply", message: "Pi subagent RPC reply is not an object." };
  }
  if (raw.version !== 1) {
    return { ok: false, reason: "unsupported", message: "Unsupported pi-subagents RPC protocol version." };
  }
  if (raw.requestId !== requestId || raw.method !== method) {
    return { ok: false, reason: "invalid_reply", message: "Pi subagent RPC reply did not match the request." };
  }
  if (raw.success === false) {
    const reason = raw.reason;
    return {
      ok: false,
      reason: typeof reason === "string" && reasons.has(reason as PiSubagentRpcFailureReason)
        ? (reason as PiSubagentRpcFailureReason) : "error",
      message: typeof raw.message === "string" ? raw.message.slice(0, 240) : "Pi subagent RPC failed.",
    };
  }
  if (raw.success !== true || !isRecord(raw.data)) {
    return { ok: false, reason: "invalid_reply", message: "Pi subagent RPC returned an invalid response." };
  }
  try {
    if (Buffer.byteLength(JSON.stringify(raw.data), "utf8") > PI_SUBAGENT_RPC_MAX_BYTES) {
      return { ok: false, reason: "invalid_reply", message: "Pi subagent RPC response exceeded the size limit." };
    }
  } catch {
    return { ok: false, reason: "invalid_reply", message: "Pi subagent RPC returned non-JSON data." };
  }
  if (method === "ping" && (
    raw.data.version !== 1 ||
    !Array.isArray(raw.data.methods) ||
    !raw.data.methods.includes("ping") || !raw.data.methods.includes("status") ||
    !isRecord(raw.data.session) || raw.data.session.sessionId !== parentSessionId
  )) {
    return { ok: false, reason: "unsupported", message: "No compatible pi-subagents RPC in this parent session." };
  }
  if (method === "stop" && (
    raw.data.state !== "stopping" || typeof raw.data.childId !== "string"
  )) {
    return { ok: false, reason: "invalid_reply", message: "Pi stop did not acknowledge an exact child." };
  }
  if (method === "steer" && !(
    (isRecord(raw.data.details) && (raw.data.details.deliveryStatus === "queued" || raw.data.details.deliveryStatus === "delivered")) ||
    raw.data.deliveryStatus === "queued" || raw.data.deliveryStatus === "delivered"
  )) {
    return { ok: false, reason: "invalid_reply", message: "Pi steer receipt lacks a delivery status." };
  }
  if (method === "status" && typeof raw.data.text !== "string") {
    return { ok: false, reason: "invalid_reply", message: "Pi subagent RPC status is missing its result." };
  }
  return { ok: true, data: raw.data };
}

/** Runs inside the trusted Paseo integration extension; pi and its event bus are local. */
export const piSubagentRpcRuntimeBridge = String.raw`
  const paseoSubagentRpcPending = new Set();
  let paseoSubagentRpcClosed = false;

  pi.on("session_start", () => {
    // Pi can reopen or switch sessions without recreating its loaded extensions.
    paseoSubagentRpcClosed = false;
  });

  pi.on("session_shutdown", () => {
    paseoSubagentRpcClosed = true;
    for (const cancel of paseoSubagentRpcPending) cancel();
    paseoSubagentRpcPending.clear();
  });

  pi.registerCommand("paseo_subagent_rpc", {
    description: "Internal Paseo scoped subagent RPC bridge",
    handler: async (args, ctx) => {
      const marker = "PASEO_SUBAGENT_RPC ";
      const notify = (reply) => {
        const encoded = JSON.stringify(reply);
        ctx.ui.notify(marker + (Buffer.byteLength(encoded, "utf8") <= 16384
          ? encoded : JSON.stringify({ version: 1, requestId: reply.requestId, method: reply.method,
            success: false, reason: "invalid_reply", message: "Pi subagent RPC response exceeded the size limit." })), "info");
      };
      let input;
      try {
        if (args.length > 2048) return;
        input = JSON.parse(Buffer.from(args.trim(), "base64url").toString("utf8"));
      } catch {
        return;
      }
      if (!input || input.version !== 1 || typeof input.requestId !== "string" ||
          !/^[a-f0-9-]{36}$/i.test(input.requestId) ||
          (input.method !== "ping" && input.method !== "status" && input.method !== "stop" && input.method !== "steer")) return;
      const { requestId, method } = input;
      if (paseoSubagentRpcClosed) {
        notify({ version: 1, requestId, method, success: false, reason: "closed", message: "Pi session closed." });
        return;
      }
      if (method === "ping" && (input.runId !== undefined || input.childId !== undefined ||
          input.index !== undefined || input.message !== undefined)) return;
      if (method !== "ping" && (typeof input.runId !== "string" ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(input.runId))) return;
      if (method === "status" && (input.childId !== undefined || input.message !== undefined)) return;
      if (method === "stop" && (typeof input.childId !== "string" ||
          !input.childId.trim() || input.childId.length > 256 || /[\r\n]/.test(input.childId) ||
          !Number.isSafeInteger(input.index) || input.index < 0)) return;
      if (method === "steer" && (typeof input.childId !== "string" ||
          !input.childId.trim() || !Number.isSafeInteger(input.index) || input.index < 0 ||
          typeof input.message !== "string" || !input.message.trim() ||
          Buffer.byteLength(input.message, "utf8") > 360)) return;

      const reply = await new Promise((resolve) => {
        const eventName = "subagents:rpc:v1:reply:" + requestId;
        let unsubscribe;
        let timer;
        let finished = false;
        const finish = (value) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (typeof unsubscribe === "function") unsubscribe();
          paseoSubagentRpcPending.delete(cancel);
          resolve(value);
        };
        const cancel = () => finish({
          version: 1, requestId, method, success: false, reason: "closed", message: "Pi session closed."
        });
        paseoSubagentRpcPending.add(cancel);
        try {
          // Install the listener BEFORE emission; synchronous ping replies are valid.
          unsubscribe = pi.events.on(eventName, (raw) => {
            if (!raw || raw.version !== 1 || raw.requestId !== requestId ||
                raw.method !== method || typeof raw.success !== "boolean") {
              finish({ version: 1, requestId, method, success: false,
                reason: raw?.version !== 1 ? "unsupported" : "invalid_reply",
                message: "Pi subagent RPC returned an incompatible envelope." });
              return;
            }
            if (!raw.success) {
              finish({ version: 1, requestId, method, success: false, reason: "error",
                message: typeof raw.error?.message === "string" ? raw.error.message.slice(0, 240) : "Pi subagent RPC failed." });
              return;
            }
            finish({ version: 1, requestId, method, success: true, data: raw.data });
          });
          timer = setTimeout(() => finish({
            version: 1, requestId, method, success: false,
            reason: "unavailable", message: "pi-subagents RPC is missing or did not respond."
          }), 8000);
          pi.events.emit("subagents:rpc:v1:request", {
            version: 1, requestId, method,
            ...(method === "status" ? { params: { runId: input.runId } } :
              method === "stop" ? { params: { runId: input.runId, childId: input.childId } } :
              method === "steer" ? { params: {
                runId: input.runId, index: input.index, message: input.message, mode: "steer"
              } } : {})
          });
        } catch {
          finish({ version: 1, requestId, method, success: false,
            reason: "unavailable", message: "Pi subagent RPC event bus is unavailable." });
        }
      });
      if (!paseoSubagentRpcClosed) notify(reply);
    }
  });
`;
