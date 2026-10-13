# Pi subagent controls 04 — Prove a direct in-process RPC bridge

Status: **ready**. [Plan](../plans/pi-subagent-controls.md). No UI or stop control in this slice.

## Deliverable

A tiny, safely correlated Pi-process control bridge providing **only `ping` and targeted `status`** to the Paseo daemon without sending a natural-language prompt to a model. Verify whether the Pi slash-command mechanism can execute while the parent model is busy versus idle with background children.

## Source references

- Upstream `nicobailon/pi-subagents/docs/extension-api.md` “In-process event-bus RPC”; `src/extension/rpc.ts` protocol v1 and reply event.
- Paseo `packages/server/src/server/agent/providers/pi/agent.ts` injected integration, `PASEO_PI_COMMAND_RESULT_MARKER`, `waitForExtensionResult`, `runtimeSession.prompt`, extension notification handling.
- `packages/server/src/server/agent/providers/pi/extensions/contract.ts`, `runtime.ts`, `cli-runtime.ts`; existing fake-Pi tests.

## Implement

1. Check the actual *installed* `pi-subagents` version, RPC availability, `ping` methods/capabilities and whether the package loads in the parent Pi session. Unavailable/old = typed unavailable state, not guessed support.
2. Inject only the local integration needed to subscribe to `subagents:rpc:v1:reply:<requestId>`, emit `subagents:rpc:v1:request`, forward the **bounded** reply through the existing Paseo notification channel, and unsubscribe after reply/timeout/session close. Register listener **before** emit. Use collision-safe request IDs; suppress event-bus ready/replies from the chat timeline. Validate envelope version/requestId/method/success.
3. Expose a typed internal `ping` and `status` method in the Pi agent-session adapter. Hard-allowlist only those methods in this slice, guard payload sizes and timeout, correlate requests despite simultaneous commands, and reject stale replies. `status` may only read a target attributable to the exact parent Pi session. Never accept an absolute run directory from the browser.
4. Test *real* Pi command execution with an idle parent and while another subagent is active. A command registered via `pi.registerCommand` is not proof it can be invoked mid-turn via `runtimeSession.prompt`; verify this. On unsupported/busy state, return accurate `unavailable` or `busy` without interrupting the parent. No fallbacks to `steer`/chat/model requests, filesystem edits, or a second Pi process.
5. Do not implement a generic RPC tunnel or expose upstream `spawn`, `manage`, `cost` simply because `ping` lists them. Preserve lifecycle cleanup and session restart recovery.

## Acceptance / focused checks

- Prove `ping` and one targeted `status` response through the daemon, with no model token consumption. Demonstrate idle and active-turn behavior (or document an explicitly blocking limitation).
- Missing extension, timeout, unsupported version, duplicate/mismatched/out-of-order reply, closed parent and long error are handled deterministically.
- No leaked event listeners; no captured markers in the user transcript.
- Extend existing Pi adapter/extension fake runtime tests only. Run focused tests, relevant server typecheck, lint and formatter scripts. Commit + update this status.
