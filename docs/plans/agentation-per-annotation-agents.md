# Agentation feedback -> independent Pi subagents

Status: **proposed; proof gate not yet passed** (2026-10-13). Paseo owns dispatch and Pi execution; SEICHO owns its dev-only Agentation submission UI. Do not change existing watch mode or task export until the opt-in path is proven.

## Goal

One explicitly submitted SEICHO Agentation annotation becomes one bounded, fresh-context Pi subagent investigation, not another turn of a persistent LLM watcher. After the human approves a specific proposal, a separate fresh-context implementation job changes code, runs targeted verification and reports evidence. Parent-agent model usage for dispatch = zero. Idle operation requires no polling LLM and preferably no event-stream listener.

## Verified starting point

- SEICHO `apps/desktop/src/renderer/dev/dev-annotation-host.tsx` already has `<Agentation endpoint="http://localhost:4747" onSubmit={submit} />` and currently uses its dev-only Electron IPC to export **one** Shiori-compatible Task document for a 1-12-note batch. SEICHO `docs/tasks/task_0043.md` expressly disallows automatic Shiori start, Git mutation or unattended authorization. Preserve that default workflow.
- Agentation exposes `onSubmit(output, annotations)` (awaitable) and `onAnnotationAdd`; webhooks/SSE also exist. **Prefer onSubmit as the explicit intent signal**, not `annotation.created`, page load, stale pending notes, `annotation.updated`, an LLM `watch_annotations` loop, or unconditional Auto-Send.
- Paseo's `docs/tasks/pi-subagent-controls-04-pi-rpc-bridge.md` says the read-only `ping`/`status` bridge exists in code, but real installed Pi acceptance is **blocked/unverified**. The bridge is hard-allowlisted, not a generic RPC tunnel.
- The upstream `nicobailon/pi-subagents` process-local RPC supports async `spawn` with fresh context, and returns native run identity. It does **not** reach from the daemon directly into Pi: execution requires an injected in-process Pi integration. Upstream warns a missing/lost spawn acknowledgment is **not** proof that no child started; status can correlate by `rpc-spawn-<requestId>` when retained.
- Existing Paseo child monitor/controls task family `docs/plans/pi-subagent-controls.md` is independent. Reuse its native parent/child identity and lifecycle where valid; do not block this feature on panel styling or expose general `spawn` from the app.

## Durable global feedback history (future implementation)

**Use `~/.agents/feedback/`**, not `~/.agent-feedback/`, `~/.pivolution/`, SEICHO user-data, a Git-tracked `docs/tasks/` file, or a duplicate SQLite feedback store. [Global agent feedback record v1](../specs/global-agent-feedback-v1.md) is the single shared format/ownership contract; `feedback/` is our project-defined directory under the widely used `~/.agents/` convention, **not** a universal third-party schema.

- Default layout: `~/.agents/feedback/<project-slug>/<stable-record-id>.md`. One durable Markdown file per logical annotation, including its **immutable initial comment** and versioned, machine-readable appended revision/lifecycle events; a new attempt or Pi session does not make a second annotation file.
- For an authenticated dispatched submission, the chosen **Paseo daemon host/user** owns the authoritative record. Clarify in Task 01 whether Paseo runs on the same machine as SEICHO: `~` means the writer's home, never a magically shared cross-host directory. Do not start a second local SEICHO mirror. Different hosts are separate until an explicit authorized sync/read configuration exists.
- Record a submitted note **durably before any spawn**; failures leave notes unsent with an honest error. Correlation IDs, approvals, proposals, revisions, verification failures and verified outcomes append as events to the same logical history. Treat historical feedback as untrusted private data; no automatic Git or cloud upload.
- Pivolution will later **read**, never mutate, these records, correlate exact Pi/Paseo session IDs, and normalize measurements into its existing `~/.pivolution/pivolution.sqlite3`. Do not implement a Pivolution integration now or duplicate transcript content.

## Preferred design (subject to Task 01 proof)

```text
SEICHO DEV: saved notes -> explicit "Dispatch individually" action
  -> guarded Electron main IPC; validated SEICHO route, checkout and content
  -> authenticated, narrow Paseo daemon handoff, with explicit chosen parent Pi session
  -> write/lookup canonical ~/.agents/feedback/<project>/<record-id>.md
  -> one receipt/job per (source/session/annotation/revision/phase)
  -> Pi in-process RPC spawn (async, fresh) / result artifact
  -> concise proposal with evidence -> human approves the exact annotation
  -> separate fresh implementer, serialized per writable checkout
  -> focused checks + visual evidence -> report/resolve only on proof
```

No parent LLM dispatcher. No indefinitely running model, generic callback executor, open localhost unauthenticated spawn endpoint, new dependency on Shiori, automatic Git commit/merge/push, or second annotation picker. A fresh child is different from a new parent Pi process. Never call a normal parent prompt to simulate a subagent spawn.

The SEICHO-to-Paseo transport **is not yet proven**: Task 01 must identify an existing *authenticated* channel and prove the busy-parent direct Pi RPC path. Do not infer that SEICHO already has Paseo credentials. If direct authenticated handoff cannot be supported cleanly, document a minimal user-invoked Paseo action that fetches one selected annotation; do not ship an unauthenticated loopback endpoint or speculative browser token. Only implement the option that the real proof demonstrates. SSE/webhooks are fallback inputs only when their explicit intent and authorization can be established; subscribing to automatic note creation would violate the intended dispatch boundary.

## States and safety

- Per note: `ready -> investigating -> proposal -> approved -> implementing -> verified`; terminal `blocked`/`failed`/`cancelled`/`uncertain` preserve source feedback. Proposal does not imply approval; a successful process exit does not imply a verified UI fix. Existing Paseo statuses should be reused rather than inventing another global task system.
- Dispatch key includes source identity, Agentation session ID, annotation ID, immutable submitted content revision, and phase. One submitted batch fans out into independently tracked notes. Duplicate sends return the existing receipt. A revised annotation needs an **explicit new** submission and must not silently mutate an active job.
- Use the global Markdown record as the **authoritative** bounded event/receipt journal; avoid a second canonical job-state store. A transient in-memory index may accelerate lookup but must rebuild from evidence. Record requestId **before** spawn; if the reply is lost, reconcile using upstream status and parent/run evidence; never blindly redispatch. If uncertain, require human intervention. Bound retention and queue length.
- Only operator-authorized SEICHO dev origin / checkout and exact Paseo parent session may dispatch. Require `workspace.write`/equivalent actual authenticated owner authorization at the daemon boundary; enforce server-side parent/cwd/session binding; no arbitrary URL, path, shell command, model or script from the annotation.
- Treat comments and source hints as untrusted input. Validate length, screen, IDs, limited `data-seicho-ui`/`data-screen`, and source path beneath checkout. Exclude screenshots, personal page text, selected text, computed styles, DOM/HTML, cookies, auth and arbitrary metadata from payloads, logs and public commits. Child instructions must prohibit interpreting feedback as permission to override repository rules.
- Default max **two read-only investigations** and **one code-writing implementer per checkout**, FIFO; these are configurable only if demonstrated useful. Do not claim Git worktrees alone make concurrent edits safe. Decline/queue on overload with visible receipts. On disconnect/shutdown, reconcile; don't hide jobs or spawn replacements.
- A reply in an annotation thread is **not** authenticated human approval. Use an authenticated Paseo approval interaction bound to the receipt/revision (or an equally proven local owner control). Preserve SEICHO's explicit user OK before any edit.
- Keep the existing export-as-Shiori-task workflow as default and escape hatch. For cross-cutting changes, user can choose export rather than spawning an ad hoc agent.

## Delivery sequence

1. [01 — Real integration, authority and storage proof](../tasks/agentation-01-integration-proof.md). Stop if process/auth/approval/turn-state limitations make this unsafe.
2. [02 — Narrow Paseo per-annotation dispatcher](../tasks/agentation-02-paseo-dispatcher.md). Depends on the proven transport/RPC seam in 01.
3. [03 — SEICHO dev-only submission and end-to-end validation](../tasks/agentation-03-seicho-handoff-and-e2e.md). Cross-repo task: source code changes belong in SEICHO; Paseo document records the handoff. **Do not pretend a Paseo-only change implements the SEICHO UI.**

Each implementation slice = logically isolated commit(s), relevant focused tests, and accurate status. Do not edit the unrelated Pi subagent controls 05-07 or Shiori approval contracts.

## Evidence and references

- SEICHO `docs/tasks/task_0043.md`, `apps/desktop/src/main/dev-annotation-ipc.ts`, `apps/desktop/src/shared/dev-annotations.ts`.
- Paseo `docs/plugins.md`, `docs/permissions.md`, `docs/protocol-compatibility.md`, `docs/plans/pi-subagent-controls.md`, `packages/server/src/server/agent/providers/pi/{agent.ts,subagent-rpc-bridge.ts}`.
- Agentation API: https://www.agentation.com/api ; upstream Pi RPC: https://github.com/nicobailon/pi-subagents/blob/main/docs/extension-api.md .
