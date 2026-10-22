# Agentation 02 — Paseo: isolated per-annotation job and Pi spawn

Status: **implemented in code on main; automated and live acceptance UNVERIFIED (2026-10-13)**. Task 01 gates deliberately bypassed at user's request. [Plan](../plans/agentation-per-annotation-agents.md). Paseo repo only.

## Outcome

Create a narrowly opt-in, owner-authorized dispatcher that **durably records each submitted annotation under `~/.agents/feedback/` first**, then starts **one fresh async Pi subagent investigation per note** using the proven in-process spawn path. No continuously reasoning watcher and no silent edit permission. After human approval, spawn one fresh implementation child for that same note.

## Implement (smallest mechanism proven by Task 01)

1. Use the **proven** authenticated transport, not a guessed SEICHO credential, open loopback POST, arbitrary extension bridge or generic public RPC. Authorize caller as an operator with appropriate workspace write authority; bind server-side to the selected live parent Pi agent/session and canonical checkout. Feature is unavailable for other providers, wrong cwd, missing/old pi-subagents, unsupported capability, closed parent or mismatched context.
2. Extend `packages/server/src/server/agent/providers/pi/subagent-rpc-bridge.ts` and its session adapter **only as needed** for a typed internal `spawnAnnotationChild` operation. Keep existing 04 `ping`/`status` behavior untouched. Only permit the predetermined investigation/implementation role and a structured, bounded task (never caller-provided script, workflow, `cwd`, run path or arbitrary RPC method). Implement the proven direct process-local Pi event-bus path, not parent model chat. Register reply listener first, bound response sizes, check method/version/requestId, expire/clean listeners on shutdown and preserve child association with Paseo's native monitor.
3. Validate `sourceApp=seicho-dev`, explicit submission receipt, source route/screen, Agentation session/annotation IDs, immutable per-note payload hash, fixed repository identity, comment max 1200 chars, and safe hints only. Reject cross-screen/mixed/overlarge batches, selectedText, nearbyText, full HTML, computedStyles, screenshot bytes, URL credentials and unverified filesystem paths. No untrusted source hint is authority to edit.
4. Implement the **single canonical** versioned Markdown record defined in [global feedback record v1](../specs/global-agent-feedback-v1.md), defaulting to the authorized Paseo writer's `~/.agents/feedback/<project>/<record-id>.md`. Write the immutable original feedback and `submitted` event atomically **before** a spawn. One record per logical annotation; explicit edited/resubmitted feedback adds a new revision event, not a new history file. Append investigation/proposal/approval/implementation/check/outcome events with unique event IDs and exact native session references. Reject traversal, symlink escapes, concurrent writer conflicts, malformed records and unauthorized project selection. Preserve feedback on failures; no public repository writes.
5. Use this same record as the durable dispatch receipt/journal keyed by source/session/annotation/revision/phase; do **not** invent a second authoritative state database. Duplicate sends return existing state without launching extra children. Persist correlation/request ID before async spawn. On timeout, lost acknowledgement, daemon restart or duplicate submission, reconcile with native `runId` or `rpc-spawn-<requestId>` where supported; missing evidence -> `uncertain`, manual inspection, never automatic re-spawn. Bound event/queue sizes. Do not delete resolved records needed for longitudinal audits.
6. Investigation worker gets only the note, screen, safe source hints, repository rules and instruction to propose an exact change **without editing**. Capture its concise proposed action and verification intent, tied to the note. Child exit is not approval. Maintain at most 2 concurrent read-only investigations; max one code-changing child per SEICHO checkout (FIFO), no parallel conflicting edits.
7. Human approval comes from an authenticated owner action that names the current annotation ID/revision/proposal/receipt, **not** by interpreting Agentation thread text or auto-resolve events. On approval, spawn a *separate fresh* implementation child receiving the approved proposal plus task-local findings; enforce repository rules, source inspection, focused checks, privacy, and no automatic commit/push/merge. If implementation needs broad redesign or conflicting notes, block/escalate to Shiori Task export.
8. Return bounded, honest lifecycle summaries for each note: submitted, investigating, proposal, needs approval, implementing, verified, failed, blocked, cancelled, uncertain. Reuse existing Pi child/run tracking and user-visible Paseo review surfaces wherever applicable; avoid a new dashboard. Never mark Agentation resolved purely because a child process exited successfully.
9. Revalidate exact parent/cwd on every operation; honor explicit cancel/rejection and late completions. No retries of mutating RPCs. No automatic model fallback, hidden second Pi process, or in-memory-only pending ID that redispatches after restart.

## Acceptance / checks

- Explicit 2-note submission -> 2 private durable Markdown records in the correct global home, then 2 distinct fresh-context investigation children with distinct correlation IDs, minimal prompts and zero parent-model dispatch turns. Same submission twice -> no extra children; edited note needs a new explicit submission.
- Busy parent still dispatches (as actually proven in 01), or feature remains blocked; a dropped RPC reply cannot duplicate a child. Wrong principal, wrong parent, source screen, oversized fields and untrusted metadata rejected.
- Two proposals tracked separately; approving one causes exactly one fresh implementation child, other remains unmodified. A second approval is idempotent; same-checkout implementations don't overlap. No unauthorized Git or auto-resolution.
- Parent/session shutdown, queued child, active child, lost evidence and plugin unavailable show truthful state without unexpected spawns. Re-ingestion/restart and revised feedback cannot duplicate a logical record, event or spawn; histories and session references remain readable after completion.
- Add a few focused tests to existing Pi adapter/daemon protocol/auth/store tests; run relevant unit tests, typecheck, lint and format checks. Test actual Pi integration with 01's environment and record evidence. Avoid coverage inflation and unrelated feature work.

## Implementation status (2026-10-13)

Committed to `main` at the user's explicit direction to **ignore Task 01's required gates**. This is implementation, **not a claim that the Pi/Windows runtime or all acceptance checks passed**.

Implemented:
- Private, versioned canonical Markdown records in `~/.agents/feedback/seicho/<record-id>.md`, using a stable source namespace + annotation identity, immutable first feedback, submitted revisions, and append-only logical event history within atomic file replacements. Refuse symlinked directories/records, duplicate identities, untrusted extra note fields, path escape and unbounded files. Files are outside Git.
- `FeedbackStore.reserve` persists a request **before** any outbound Pi invocation. A duplicate or lost acknowledgment does not automatically spawn again. Unknown requests remain uncertain rather than faking completion. Queue reservations happen only when a worker slot is available, not at form submission.
- Narrow `agent.feedback.request` / `agent.feedback.response` schema with `workspace.write` authorization, an optional `server_info.features.agentFeedback` capability, exact parent Pi session binding and verified `infectiousstupidity/seicho` Git origin/cwd. Actions: `submit`, `get`, `record_proposal`, `approve`, `record_outcome`. No generic script/RPC URL/command field is accepted.
- Direct Pi-process IPC socket inside the existing Paseo-injected Pi extension (no new process, no parent model prompt). Local random pipe/socket identity, secret token, bounded request/reply, session identity check, request correlation, cleanup and timeouts. Registers a constrained read-only source-inspection runtime agent and a separate implementation agent, requesting upstream Pi async `spawn` with `context: "fresh"`. Acknowledged native run IDs are linked to parent Pi status.
- At most two investigations and one implementation attempt per SEICHO checkout, with FIFO in-process queue. Successful *spawn acknowledgments do not release slots*. Investigation slot release requires a recorded proposal; implementation release requires an explicit evidence-backed terminal outcome. Uncertain spawn records stay non-retryable. A daemon restart does not blindly replay queued or uncertain mutations.
- Human approval requires the latest annotation revision and an explicitly recorded proposal. Verification is never asserted merely because Pi exited. No auto-resolve, commit, push, merge or model fallback.
- Focused unit tests added for Markdown storage/idempotence/safety, two-note context isolation, duplicate submissions, approval and concurrency, and strict protocol shapes.

### Not yet proven / follow-up

- **Tests not executed here:** GitHub connector writes do not provide a checkout with Paseo's installed dependencies. No credible passing typecheck, lint, format or Vitest result is available. The local/CI implementer must run:
  - `npm exec --workspace=@getpaseo/server -- vitest run src/server/agent-feedback/store.test.ts src/server/agent-feedback/dispatcher.test.ts src/server/agent/providers/pi/subagent-rpc-bridge.test.ts`
  - `npm exec --workspace=@getpaseo/protocol -- vitest run src/messages.agent-feedback.test.ts`
  - `npm run typecheck --workspace=@getpaseo/server`, `npm run typecheck --workspace=@getpaseo/protocol`, `npm run lint`, `npm run format:check`
- **Live Pi acceptance remains unverified:** startup runtime-agent registration, installed upstream `spawn` reply identity, Windows named-pipe permissions, busy-parent execution, model-token neutrality, native child monitor/status, dropped replies, extension shutdown and restart.
- **SEICHO UI integration is Task 03**, not included here. There is no direct SEICHO credential handoff or annotation UX in this Paseo-only slice. The new authenticated Paseo RPC is dormant until a supported client requests it.
- Proposals are **explicitly recorded** through the authorized action after inspecting the linked Pi run; the code does not automatically extract a terminal child report and post back to the Agentation thread. A verified mapping of terminal native output to a trustworthy compact proposal is future work if needed.
- No automatic cross-host sync: the record is stored on the **Paseo daemon user's host**, which may not be the SEICHO desktop host. Current retention and crash-lock clearance are conservative/manual.

### Touched implementation

- `packages/server/src/server/agent-feedback/{store.ts,dispatcher.ts}` and targeted tests
- `packages/server/src/server/agent/providers/pi/{feedback-bridge.ts,agent.ts}`
- `packages/server/src/server/session.ts`, `websocket-server.ts`, `authorization/operation-permissions.ts`
- `packages/protocol/src/messages.ts`, `messages.agent-feedback.test.ts`

Do not archive this task as verified until focused checks and real Pi/Electron acceptance pass. Do not use this code path as a replacement for SEICHO's existing Task export until Task 03 is implemented.
