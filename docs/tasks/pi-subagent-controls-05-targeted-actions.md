# Pi subagent controls 05 — Resolve exact targets; expose Status, Stop and Steer

Status: **ready**. Depends on [04](./pi-subagent-controls-04-pi-rpc-bridge.md). [Plan](../plans/pi-subagent-controls.md).

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
