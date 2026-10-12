# Pi subagent monitor 01 — Remove status churn and preserve source truth

Status: **done** (2026-07-22). Depends on [plan](../plans/pi-subagent-monitor.md); independent of Tasks 02–03.

## Outcome

Repeated observations of the _same_ async run must not repeatedly publish equivalent child descriptors or manufacture a new "last updated" time. Status transitions, first-known session files, fan-out identities, completion, failure, cancellation, replay and full-session linking still work.

## Code to inspect

- `packages/server/src/server/agent/providers/pi/extensions/pi-subagents/index.ts`: `poll`, `mapSpawn`, `collectRows`, `mapWait`, `mapCustomMessage`, `asyncChildStatus`.
- `packages/server/src/server/agent/providers/pi/extensions/host.ts`: existing 250ms follow cadence, child hydration/follower lifecycle.
- `packages/server/src/server/agent/provider-subagents/store.ts`: partial upsert preserves unspecified fields but stamps `updatedAt` on each applied upsert.
- `packages/server/src/server/agent/providers/pi/extensions/pi-subagents/index.test.ts`: captured foreground/background and grouped fixtures.

## Implement

1. Demonstrate with the existing test fixture that unchanged running `status.json` is being mapped repeatedly. Distinguish descriptor-upsert messages from child-timeline events and record the before/after counts.
2. At the Pi async adapter boundary, emit a step upsert only for first observation or **material changes**: authoritative lifecycle, available agent title, child identity, newly discovered session-file attachment, etc. Still register a newly available session file even when status has not changed. Reuse existing follow cadence; no new interval, file watcher, global store or RPC. Consider cheap file-stat gating only if it really reduces measurable reads without missing updates on coarse timestamps.
3. Respect per-step terminal states when supported by captured status data; distinguish a child that has finished from sibling steps still running. Do not infer success from absent result fields. Inspect the existing `collectRows` fallback when `success` and `exitCode` are missing; change behavior only with fixture-backed semantics (unknown must not silently become failed). Treat canceled/stopped separately. Preserve stable IDs through initial async, fan-out, completion notice, `bg_wait`, and replay.
4. Preserve the provider store's sticky partial-upsert contract and current timestamps for actual transitions. Do **not** use descriptor `updatedAt` as a user-facing proof of last meaningful work. Avoid changing shared store or protocol unless tests prove adapter-only dedup insufficient.
5. No broad refactor of Pi, shared provider adapters, or the full history pipeline. The UI must still be able to show "running" when real activity is temporarily unavailable.

## Acceptance and minimal tests

- Over ~1 s of unchanged async status, no repeated equivalent `provider_subagent` descriptor updates from polling. New transcript timeline events remain possible.
- One status transition is reported once (or only on actual material change); starting, completing, failing, canceling, repeated notice, and session-file discovery still hydrate/open correctly.
- Multi-step async run with one step finished and another running is not falsely reported as all completed. Missing/partial status files never manufacture a failure.
- Reconnect/replay continues to settle children; existing independent provider paths stay unchanged.
- Add focused adapter fixture assertions to the existing Pi adapter test file and run targeted Vitest, server typecheck, formatting/lint for changed files. No exhaustive mocks or new test harness.

## Result

Committed on `main` (see git log for `fix(pi): stop repeating unchanged async subagent status`). Adapter-only dedup proved sufficient; the provider store, protocol, and shared history pipeline are unchanged.

### Measured churn (1.2 s, unchanged running `status.json`, one child session file)

|        | descriptor upserts (child `call-1`) | child timeline events |
| ------ | ----------------------------------- | --------------------- |
| before | 4 (one per 250 ms tick)             | 1                     |
| after  | 1 (first observation only)          | 1                     |

Transcript events kept flowing in both runs, so dedup suppressed only the equivalent descriptor upserts.

### Behavior decisions

1. **Dedup at the adapter boundary.** Each registered async run keeps a `last` map of child id → last emitted `{status, title}`. `poll()` emits a step upsert only on first observation or a material change (lifecycle, agent title, newly attached session file). A newly discovered `sessionFile` still registers `childSessions` even when the status is unchanged. No new interval, watcher, store, or RPC; the existing 250 ms follow cadence is reused. File-stat gating was considered and rejected: the 250 ms read of a small JSON file is the cheap part, atomic-write timestamps make mtime gating unreliable, and it would not remove the wire churn.
2. **Per-step terminal states win.** `asyncChildStatus` now checks the step's own `status` first (`complete`/`completed` → completed, `stopped` → canceled, `failed`/`error`/`rejected`/`partial` → failed) and falls back to the run state, so a finished child is distinct from sibling steps still running even while the run state is still `running`.
3. **Terminal run states.** `complete`, `failed`, `partial`, `rejected`, `stopped` stop polling. pi-subagents ≥ 0.77 introduced `partial`/`rejected`, which the old terminal set missed, so such a run was polled every 250 ms forever. `paused` stays live: a paused run can be resumed, and the steering call re-registers the run. `stopped` maps to `canceled` (previously a stopped run with no steps was reported as `failed`).
4. **Unjudged rows are a neutral finish.** A result row missing both `success` and `exitCode` now maps to `completed`, not `failed`. The pi-subagents producer records `success: false` and/or a nonzero `exitCode` on every failure path, so absent fields are not failure evidence; the protocol has no unknown bucket, and `completed` is the neutral "finished" state the UI presents without success claims.
5. **Missing/partial `status.json`** (absent file, truncated JSON, schema mismatch) keeps the prior descriptor state; a valid later observation still reports. Nothing manufactures a failure.

### Verification evidence

- `npx vitest run packages/server/src/server/agent/providers/pi/extensions/pi-subagents/index.test.ts --bail=1` → 14/14 passed (9 pre-existing incl. foreground/background/wait fixtures, replay, close, failed-spawn; 5 new: unchanged-status dedup, per-step terminal while siblings run, stopped→canceled + polling stop, missing/partial status file, unjudged row).
- `npm run typecheck --workspace=packages/server` → clean.
- `npm run lint -- <changed files>` → 0 warnings/errors; `npm run format:files -- <changed files>` applied.

Commit this task alone, update its status and note test output in this file. Do not start task 02 until it passes.
