# Upstream sync 02: take upstream's replica cache

Status: **Done — merged in `69359e8cb`.** Historical resolution in the [upstream sync plan](../plans/upstream-sync-2026-10.md). Do not replace the current cache with upstream's file again: [Task 03](upstream-sync-03-replica-cache-one-pass-read-restore.md) has already restored the fork's read overlay on top.

## Outcome

At the merge commit, `packages/app/src/runtime/replica-cache/index.ts` and `index.test.ts` were identical to upstream `23e388b05`. This replaced the fork's rewrite from `0014432e6` as one unit rather than hand-merging eleven conflict hunks.

Upstream supplied matching-key read invalidation and persist-failure backoff (#7074), plus rejection of old workspace rows missing `background` (#7141). Its read path still called `syncPending()`; Task 03 removed that read-triggered persistence without restoring the fork's duplicate host-generation mechanism.

## Verification

- `git diff 23e388b05 69359e8cb -- packages/app/src/runtime/replica-cache` is empty. This is a merge-commit check, not an expectation for current `HEAD`.
- The original merged-tree verification recorded root typecheck clean and 55 files / 734 tests across replica cache, agent stream, timeline, subagents, and i18n. No broad suite was re-run for the task-doc refresh.
- Upstream `23e388b05..9a0b95aa1` changes no replica-cache file. The 2026-10-19 dry run reports no cache conflict; Task 03's delta carries forward automatically.

## Follow-up

Task 03 is implemented in `f8d30c62d`. Preserve its accepted-state overlay, host-lifetime guards, backoff, eviction, and corrupt-row repair at the next sync. Do not use this completed task's historical take-upstream resolution to erase it.

## Required context

- [Replica cache one-pass reads](../plans/replica-cache-read-path.md)
- [Task 03](upstream-sync-03-replica-cache-one-pass-read-restore.md)
- [Data model](../data-model.md)
