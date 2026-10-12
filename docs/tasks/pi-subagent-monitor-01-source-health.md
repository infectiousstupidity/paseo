# Pi subagent monitor 01 — Remove status churn and preserve source truth

Status: **ready; not implemented**. Depends on [plan](../plans/pi-subagent-monitor.md); independent of Tasks 02–03.

## Outcome

Repeated observations of the *same* async run must not repeatedly publish equivalent child descriptors or manufacture a new "last updated" time. Status transitions, first-known session files, fan-out identities, completion, failure, cancellation, replay and full-session linking still work.

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

Commit this task alone, update its status and note test output in this file. Do not start task 02 until it passes.
