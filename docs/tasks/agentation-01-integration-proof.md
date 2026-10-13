# Agentation 01 — Prove explicit dispatch and fresh Pi child spawn

Status: **partially executed; LIVE GATE BLOCKED/UNVERIFIED (2026-10-13)**. [Plan](../plans/agentation-per-annotation-agents.md) · [Source audit and proof results](../evaluations/agentation-01-proof-status.md). **Do not implement production wiring** until this gate passes.

## Outcome

Demonstrate on the actual user's Windows/Paseo/Pi/SEICHO development environment that one *explicitly submitted* annotation can be safely persisted as a global Markdown feedback record and cause exactly one true async Pi subagent with `context: "fresh"`, while consuming no parent-model tokens for dispatch. Prove that the submitter is authorized and that parent busy/idle behavior is understood. The disposable probe must not change application files or persist a broad API.

## Investigate and test

1. Re-read the current Paseo and SEICHO sources (including installed versions). Confirm `docs/tasks/pi-subagent-controls-04-pi-rpc-bridge.md` live gate first: which Pi and pi-subagents versions are actually loaded, which RPC methods `ping` advertises, and which process owns `pi.events`. The fact that upstream documents `spawn` does **not** prove the installed runtime supports it.
2. Verify which durable annotation provenance fields actually exist: current SEICHO `DevAnnotationBatch` has screen and per-note IDs but no guaranteed Agentation session ID. Prove how the chosen source/instance namespace remains stable across restarts, retries and multiple running copies; never invent an upstream session ID or silently conflate identical note IDs. Verify SEICHO's actual `onSubmit` behavior for a 2-note batch: it is an intentional user action, waits for its handler, and currently exports a Task; `onAnnotationAdd` and SSE `annotation.created` are not dispatch permission. Identify a clean opt-in alternative to the existing exporter without adding a second picker or silently starting two workflows.
3. Map the authenticated SEICHO Electron-main -> Paseo daemon path. Check real daemon credentials/session ownership, `docs/permissions.md`, IPC sender validation and the existing RPC/plugin API before proposing a transport. Never use unauthenticated `localhost` or browser-provided absolute paths. If no safe direct handoff exists, evaluate a **user-initiated authenticated Paseo action** selecting exact pending notes; record the simplest proven alternative.
4. Verify the storage path and ownership in [global feedback record v1](../specs/global-agent-feedback-v1.md): `~/.agents/feedback/<project>/<id>.md` on the **authorized writer's host/user**, not implicitly on the SEICHO client. Prove that a record with immutable original comment and initial `submitted` event is written atomically **before** spawning; duplicate submissions use the same record and no extra spawn; a failed/readonly/full/denied directory cannot silently succeed. Confirm project namespaces and private, untracked local files. If SEICHO and Paseo are on different hosts, document the actual canonical location and no-sync behavior. Do not build a second canonical feedback store.

5. In a disposable target with no write tools, use the existing injected Pi extension's process-local `subagents:rpc:v1:request` to call a **single fixed/allowlisted** `spawn` payload (`agent` + short bounded `task`, async, fresh). Listen for the correlated reply before emitting; capture native `requestId`, `runId`, status, child output and cleanup. Do not enable generic RPC forwarding or accept raw JS `script` in user-facing APIs.
6. Exercise idle parent, parent actively streaming, parent with other async child running, parent disconnected/restarted, missing extension. Measure whether the event-bus call inside the Pi extension can work while busy **without** `runtimeSession.prompt`. Compare parent usage before/after to detect accidental model invocation. A daemon slash-command call returning `busy` is not an acceptable workaround for the busy-parent target.
7. Intentionally suppress/delay a spawn reply, then check upstream `status({id:"rpc-spawn-<requestId>"})` reconciliation when supported. Confirm missing evidence is *uncertain*, not safe to spawn again. Confirm exact parent-session attribution, and no event/notification markers shown in chat.
8. Verify Agentation's event/submit payload is restricted to the SEICHO screen and annotation identity; do not copy real personal application content into fixtures.

## Acceptance / stop

- Record actual versions, transport, writer machine/home, file permissions/atomicity, permission model, exact manual commands, model usage evidence, busy-parent results, correlation shape, and limitations in this task. No mock-only "proof".
- A short disposable subagent receives just its fixed instruction and finishes; parent does not reason to dispatch or watch in a loop.
- If direct Pi spawn cannot run in the intended parent state, authorization cannot be established, or the callback route would bypass SEICHO's explicit approval contract: **mark BLOCKED**, do not paper over with a parent chat prompt, generic RPC, independent Pi process, speculative HTTP listener or unsafe local token.
- Focused tests may cover probe code only. No broad refactor, UI redesign, persistent daemon service, or Git/working-tree mutation.
- Before starting Task 02, write the selected safe transport and actual API/capability constraints in the plan. Update the original bridge 04 *only if its own separately verified live gate passes*.

## Current execution and handoff (2026-10-13)

Reviewed current SEICHO/Paseo sources, upstream Agentation and pi-subagents APIs, and produced a standalone [storage probe](../../scripts/agentation-01-storage-proof.mjs). The disposable Linux Node 22.16.0 probe passed 5 focused tests for record creation/idempotence/revisions/namespace separation/unsafe paths/permissions. The source audit identified Agentation's optional `onSessionCreated` callback, but the installed package semantics and stable identity across routes/restarts have **not** been demonstrated. It also confirmed that SEICHO currently lacks a Paseo-authenticated handoff and Paseo's implemented Pi bridge does not offer `spawn`.

**Blocking live evidence:** No access to the user's active Pi/Paseo daemon, installed pi-subagents extension, Windows Electron app, actual home directory or authenticated session was available in this execution environment. Therefore **no live spawn, busy-parent, parent-model usage, Windows file/permission, cross-app auth or lost-reply recovery test passed**. The full truth table, exact remaining checks and limitations are in [the evidence report](../evaluations/agentation-01-proof-status.md).

**Next action:** Execute the live gate on the actual host with the required access. Keep Task 02 blocked. Do not substitute fake-Pi/unit tests for installed-runtime acceptance, promote the proof script into production, or start the dispatcher.
