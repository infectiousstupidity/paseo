# Pi subagent controls 04 — Prove a direct in-process RPC bridge

Status: **implemented in code; live acceptance blocked**. [Plan](../plans/pi-subagent-controls.md). No UI or stop control in this slice.

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

## Implementation and remaining live gate (2026-10-13)

Implemented on branch feat/pi-subagent-rpc-bridge-04, PR #4. The injected Paseo Pi integration registers the internal read-only /paseo_subagent_rpc command. The extension installs a request-specific reply event listener before emitting the request, validates correlated envelopes, applies size and time bounds, and unsubscribes on reply, timeout or session shutdown. Replies travel through the existing notify channel, whose internal marker is suppressed from the user transcript.

The Pi session adapter exposes typed internal pingSubagents() and statusSubagent(runId) operations only. Status permits a native async run ID observed from the exact parent's subagent tool result, never a browser-provided run directory. Pi-subagents still enforces its own current-session check. Missing integration and incompatible protocol produce typed failures. No generic event-bus tunnel, child mutating action, extra process, model-mediated fallback, or client RPC is implemented.

**Active turn limitation:** a registered extension command does not prove that Pi's host prompt RPC can safely run it mid-turn. The adapter returns busy without sending a slash prompt while the parent is active/streaming/compacting. An idle parent with background children remains eligible. This is deliberate until verified against an actual installed Pi version.

**Live acceptance is not proven:** this execution environment has no Pi binary, installed pi-subagents package, or access to the user's running Pi session. Neither the installed package/version and capability handshake nor real idle/active-turn or active-background-child behavior has been tested here. The fake-Pi command/event-bus tests are code-level evidence only. Do not archive this task until the live gate passes.

Focused checks for a checkout with dependencies:

    npm exec --workspace=@getpaseo/server -- vitest run src/server/agent/providers/pi/agent.test.ts
    npm run typecheck --workspace=@getpaseo/server
    npm run lint
    npm run format:check

These commands were not executed in the GitHub-only development environment; passing results must not be inferred.

For the real gate: inspect actual pi and pi-subagents versions and loaded get_commands, confirm a v1 ping with matching parent session ID and advertised methods, record model usage before/after an idle ping, start a genuine async child through Pi's ordinary subagent tool and obtain its native run ID, confirm a targeted status response while the parent is idle but that child runs, and try ping while a parent model turn is active (expect busy with no slash prompt or disruption). Verify no new model turn/tokens attributable to each control request, no notification markers leaked, and no reply listeners retained. Record environment, responses, versions, usage counters, and evidence before marking done.
