# Upstream sync 01: take upstream's rendered-tail cache

Status: **Done — merged in `69359e8cb`.** Historical resolution for the first merge in the [upstream sync plan](../plans/upstream-sync-2026-10.md). Do not apply it again.

## Outcome

The merge took upstream's `packages/app/src/agent-stream/model.ts` at `23e388b05`, replacing the fork's per-window rendered-tail Map from `160a887ba` with upstream's single-entry cache and incremental turn timing (#7052).

## Verification

- `git diff 23e388b05 69359e8cb -- packages/app/src/agent-stream/model.ts` is empty.
- At the 2026-10-19 refresh, `git diff HEAD upstream/main -- packages/app/src/agent-stream/model.ts` is also empty; upstream `9a0b95aa1` has not changed this file since the merge.
- The original resolution check recorded 27 passing tests in `src/agent-stream/strategy-web.test.tsx` and `src/agent-stream/model.test.ts`, including the fork's committed-history identity regression. The later merge verification recorded 55 files / 734 tests across the five focused app directories. These are historical results, not tests re-run during the task-doc refresh.

For future changes, run the two files from `packages/app`, not the repository root:

`npx vitest run src/agent-stream/strategy-web.test.tsx src/agent-stream/model.test.ts --bail=1`

## Constraints retained for later syncs

Keep upstream's model when both sides solve the same tail-identity problem. Do not restore the competing cache without performance evidence. The next sync's conflict is covered by [Task 08](upstream-sync-08-subagents-compact-feedback.md), not this task.
