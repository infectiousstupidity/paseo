# Pi subagent controls 05 — Resolve exact targets; expose Status, Stop and Steer

Status: **implemented in code; live acceptance and verification unproven**. Depends on [04](./pi-subagent-controls-04-pi-rpc-bridge.md). [Plan](../plans/pi-subagent-controls.md).

## Deliverable

End-to-end *typed* app → Paseo daemon → parent Pi RPC for **Status, Stop and Steer**, scoped to one verified child. No user-supplied run IDs/paths or arbitrary RPC methods in the wire API.

## Implement

1. Extend the Pi subagent adapter to retain authoritative `runId` from spawn result/async status, stable native child identity from the actual status step, and ownership by managed `parentAgentId`. Re-check how single / multi-step / chain / workflow and replay map Paseo display row IDs to upstream run/child IDs. **IMPORTANT:** upstream `stop({runId,index})` without `childId` can stop the WHOLE run. For a multi-child run, require an exact `childId` accepted by upstream `resolveAsyncStatusChild`; if not provable, disable controls, don't guess `step:index`.
2. Store control target server-side behind `(serverId,parentAgentId,subagentId)` authorization; do not ask the client to supply `runId` or `asyncDir`. If the daemon must transmit a capability flag, add an **optional** feature-gated provider descriptor field only; the button must still revalidate at action time.
3. Expose narrow dotted WebSocket RPC request/response pairs consistent with `docs/rpc-namespacing.md` (`agent.provider_subagents.control.request` and `.response` under the established namespace) for `status`, `stop`, `steer`. Reject unknown action, absent or non-Pi target, archived/removed/wrong-parent/wrong-session child, stale target, unsupported version, and unauthorized caller. Implement standard client methods; no generic method or path passthrough.
4. `stop`: confirm that the exact selected child is stoppable from fresh targeted status; invoke upstream `stop` once with **required childId for multi-child runs**. Treat response `state: stopping` as acceptance only. Wait for authoritative terminal child status via existing Pi `status.json`/events; do not mark stopped optimistically. Do **not** retry a timed-out stop automatically.
5. `steer`: require trimmed, bounded user text; call upstream `steer` with `{runId,index?,message,mode:\"steer\"}` after target validation. Preserve returned `deliveryStatus: queued|delivered` and failures. Never submit it as a parent chat turn.
6. Keep old clients/daemons working with additive schemas, capability gate, generated validator rules, and scoped error handling; do not cause 250ms status subscription/fetches per row.

## Acceptance / tests

- Live one-child and multi-child async run: Stop the second running child and confirm first stays running; malicious/display-row index cannot make the daemon stop the whole run.
- Stale, already completed, wrong parent, wrong session, unknown extension/version, disconnect, uncertain acknowledgement, async stop still pending.
- Status is read-only; steer acknowledges queued vs delivered, no model usage. UI-gated actions unavailable for non-`pi-subagents` adapters (including Pi-compatible variants) until explicitly verified.
- Existing server provider-subagent store, agent-manager/session RPC, protocol/client and Pi adapter tests extended minimally. Run focused suites + typecheck, lint, format. Commit after task acceptance.

## Implementation status (2026-10-13)

Committed directly to `main` per request despite unverified acceptance. The native Pi adapter retains async run identity, maps status.json children to parent-owned Paseo rows, and stores exact native child IDs and snapshot IDs privately in the daemon. Controls remain disabled when those identities are missing, ambiguous or stale, or when a parent session is no longer active. The `agent.provider_subagents.control.request/response` protocol is strict and accepts only parent/row IDs, action and bounded steering text; native IDs/paths cannot be passed through. Authorized `workspace.write` requests route through the existing Pi bridge; replies distinguish Stop **accepted/stopping** from observed terminal state, and preserve Steer **queued/delivered**.

Files cover the Pi adapter/bridge, provider-subagent store, agent manager, session routing, protocol schemas, daemon client, permissions and server capability flag. The optional descriptor `controlEligible` flag is an advisory visibility hint, not authority: every operation revalidates its target against the live extension status. No per-row status polling or model-message fallback was added. Scope excludes the UI rework (task 06) and Interrupt/Resume (task 07).

**Verification:** focused code-level regression tests were added for multi-child native targeting, workflow identity mapping, ambiguous/missing targets, private target store, narrow protocol and stop/steer receipts. They have **not been executed** in this GitHub-only coding environment. There is no evidence here that the installed Pi + pi-subagents extension handshake, real parallel child stop/sibling survival, active-parent-turn restrictions, or acceptance screenshots pass. Task 04's live acceptance remains blocked and an active parent currently returns `busy` by design, not a model-token-free mid-turn control. Do not archive this task or claim end-to-end acceptance until the live checks pass.

For a checkout with dependencies: `npm exec --workspace=@getpaseo/server -- vitest run src/server/agent/providers/pi/agent.test.ts src/server/agent/providers/pi/extensions/pi-subagents/index.test.ts src/server/agent/providers/pi/subagent-rpc-bridge.test.ts src/server/agent/provider-subagents/store.test.ts`; `npm exec --workspace=@getpaseo/protocol -- vitest run src/messages.provider-subagents.test.ts`; server/client/protocol typechecks; lint; format check; live one-child and two-child stop plus steer acceptance. Code was pushed regardless of check outcome, per explicit instruction.
