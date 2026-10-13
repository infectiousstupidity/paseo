# Agentation 03 — SEICHO opt-in submission and end-to-end acceptance

Status: **blocked on [02](./agentation-02-paseo-dispatcher.md)**. [Plan](../plans/agentation-per-annotation-agents.md). **Cross-repo handoff:** implementation of Agentation renderer/Electron lives in `infectiousstupidity/seicho`; only the Paseo side and this coordination document belong in Paseo. Do not mark done with only Paseo changes.

## Outcome

In `pnpm start` development mode, the user can choose to submit saved annotations **individually to isolated Paseo Pi subagents** with clear per-note receipts, rather than starting LLM watch mode. Existing SEICHO Task-document export remains available and unchanged by default. No production annotation API or automatic Shiori start.

## Implement

1. Re-read SEICHO `docs/tasks/task_0043.md`, `AGENTS.md`, `apps/desktop/src/renderer/dev/dev-annotation-host.tsx`, `apps/desktop/src/shared/dev-annotations.ts`, `apps/desktop/src/main/dev-annotation-ipc.ts` and `apps/desktop/src/main/dev-annotation-export.ts`. Preserve DEV-only toggle (OFF at each launch), screen-specific hash location, source-hint sanitization, Electron context isolation, caller/origin verification, clipboard fallback, and current explicit `Send Annotations` -> local Shiori Task exporter. Do not silently replace, auto-run or change Task 0043's supervised approval policy.
2. Add the **smallest** opt-in dispatch affordance to existing DEV controls, using Agentation's structured `onSubmit` saved annotations and only the *Task 01-proven* authenticated handoff. Do not introduce a second picker/annotation engine, local unauthenticated control server, LLM watcher, background SSE polling, filesystem spool or browser-stored Paseo secrets. If UI cannot safely distinguish export vs dispatch using the existing Send callback, show a concise explicit choice before forwarding; failure retains the annotations.
3. For each selected note show an unambiguous per-note receipt (queued/investigating/proposal/needs approval/working/verified/blocked/uncertain), linking to its existing Paseo child where supported. Do not dump full agent conversations into the overlay. Approval and retry must be explicit, authenticated, and revision-bound via the actual Paseo owner control; no approval from ordinary thread comments. Keep every unresolved note visible.
4. Update SEICHO `AGENTS.md` only after tested to describe **both** modes: old opt-in `watch mode` instructions if still supported, and explicit dispatched isolated annotation mode. Correct the existing task-0043 wording inconsistency about the already configured Agentation `endpoint` without rewriting Task 0043's historical acceptance. No automatic Git commits/pushes and no invented Shiori intake shortcut.
5. Run a real `pnpm start` app and connected local Paseo/Pi/Agentation installation. Submit 2 actual non-sensitive UI notes on one screen; verify exactly 2 separate investigation child sessions, no parent turn; approve only one and verify only its code changes, targeted tests and visual before/after evidence. The other stays pending. Repeat Send, update a note, switch Inbox -> Today -> Inbox, disconnect/reconnect, restart and verify no duplicate/ghost child. Verify private Inbox content and screenshots are excluded. Try a malformed/synthetic submission from the wrong frame and confirm denial.
6. The child may suggest CSS/file changes but must inspect real source; a selector/area rectangle is only a hint. Visual acceptance should follow SEICHO's existing isolated QA screenshot procedure, not manipulate the user's focused desktop or trust an unverified image.
7. Preserve manual Task-document export for bigger work, and confirm it remains discoverable but cannot start via Shiori until a clean committed checkout and supervised human review. The new ad hoc path must not pretend to satisfy or bypass Shiori's task preflight.

## Acceptance

- User can select the dispatch mode explicitly; default export flow, DEV toggle, standard navigation, packaged-app security and other screens are unchanged.
- Exactly one fresh **read-only investigator** per annotation; after explicit per-note approval, one fresh implementer. Concise progress and meaningful evidence; no child thread overwrites another; no auto-resolve on partial work.
- No unattended Git actions; no leaked personal content; no unauthenticated cross-app control; no spontaneous jobs from a mere `annotation.created` event.
- Focused SEICHO renderer/IPC/export tests and Paseo dispatcher tests pass; live Electron/Pi visual and model-usage evidence is recorded with actual artifact paths. Mark anything that cannot be verified **UNVERIFIED**, not passed.
- Commit changes logically in their **own** repositories. Update statuses and link the SEICHO commit(s) here after validation.
