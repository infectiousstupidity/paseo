# Upstream sync 02: take upstream's replica cache

Status: **Done — merged in `69359e8cb`, see Verification.** Resolution for the largest merge conflict in [Upstream sync: merge getpaseo/paseo main](../plans/upstream-sync-2026-10.md). The follow-up that restores the fork's advantage is [Upstream sync 03](../tasks/upstream-sync-03-replica-cache-one-pass-read-restore.md).

## Outcome

The merged `packages/app/src/runtime/replica-cache/index.ts` and `index.test.ts` are identical to `upstream/main`. The fork's read-path rewrite from `0014432e6` is dropped from the merge and re-landed separately in Task 03.

## Evidence

11 conflict hunks: 8 in `index.ts` (merged-tree lines 903, 1026, 1180, 1225, 1243, 1343, 1390, 1403) and 3 in `index.test.ts` (557, 605, 1073). Both sides renamed the same internals.

Three-way state of `readRows()`:

| Version                      | Read behavior                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base `9ab99a6e1`             | `syncPending()`, one `rowStore.read()`, retry while the **host-wide** revision moved (`canReadHostRevision`).                                                                                                                       |
| Fork `0014432e6`             | No `syncPending()`. One `rowStore.read()` inside `queueStoreOperation`, then `overlayPendingRows` for the requested keys, guarded by `hostGenerations`.                                                                             |
| Upstream `e0de0fdf6` (#7074) | `syncPending()` still first, then one `rowStore.read()`, retried only when changes matching **this read's keys** arrive (`activeReads`, `hasPendingReadChanges`). Persist failures back off instead of re-serializing every second. |

Upstream fixed the starvation half of getpaseo/paseo#4813 (retry granularity) and left the forced-persist half (a read still drains the whole pending batch). The fork fixed both. Task 03 restores the second half.

Upstream also carries `c1558d29e` (`fix(app): keep background workspaces hidden after reload (#7141)`), which adds a required `background: z.boolean()` to `StoredWorkspaceSchema` (`index.ts:309-310`) so pre-existing cached workspace rows invalidate the workspace cursor and refresh the baseline. That behavior only exists in upstream's file.

## Proposed fix

```bash
git checkout --theirs packages/app/src/runtime/replica-cache/index.ts \
                      packages/app/src/runtime/replica-cache/index.test.ts
git add packages/app/src/runtime/replica-cache
git diff upstream/main -- packages/app/src/runtime/replica-cache   # must be empty
```

Do not hand-merge hunks. The two files are one unit: upstream's tests assert upstream's internals (`ReplicaRead`, `hasPendingReadChanges`, `persist` backoff), and the fork's tests assert the fork's (`queueStoreOperation`, `overlayPendingRows`, `hostGenerations`).

## Review

- **Accepting upstream means accepting a read that forces a persist** until Task 03 lands. Weigh that against keeping a private variant: every future sync re-conflicts this file, and the fork's version silently drops upstream's `background` row rejection and persist backoff.
- **Upstream's PR description overstates its merged code.** #7074 claims "A read never forces a persist and never waits for the host to go quiet" and "After: 1 read, 0 persists". The merged `readRows()` calls `syncPending()` before reading, and there is no pending-row overlay in the read path. Upstream's own tests prove only the narrower claim: "reads another cached agent/workspace/timeline without waiting for the stream to stop" (`index.test.ts:1048-1072`). Confirm this before deciding whether Task 03 should also go upstream as a PR.
- Check whether the fork has any local caller that depends on `flush()` semantics changed by upstream's `syncPending`/`persist` split.

## Acceptance

- `git diff upstream/main -- packages/app/src/runtime/replica-cache` is empty.
- Upstream's replica-cache suite is green, including the `background` reload cases and the "gives up a read instead of retrying while the store keeps rejecting writes" case.
- No fork-only replica-cache helper survives.

## Focused checks

```bash
npx vitest run packages/app/src/runtime/replica-cache/index.test.ts --bail=1
npx vitest run packages/app/src/timeline/replica.test.ts --bail=1
npm run typecheck
npm run lint -- packages/app/src/runtime/replica-cache/index.ts packages/app/src/runtime/replica-cache/index.test.ts
npm run format:check
```

## Constraints

- No hunk-level merge, no hybrid file.
- Do not port the fork's read path inside this Task; that is Task 03.
- No persistence failure-policy changes beyond what upstream already shipped.

## Stop conditions

Stop and ask if taking upstream's file requires changing directory or timeline owner guards, or if a fork feature depends on `hostGenerations` outside this module.

## Required context

- [Upstream sync plan](../plans/upstream-sync-2026-10.md)
- [Replica cache one-pass reads](../plans/replica-cache-read-path.md)
- [Data model](../data-model.md)
- [Replica cache](../../packages/app/src/runtime/replica-cache/index.ts)

## Verification (commands, evidence, commit hashes)

The merge that carries this resolution is `69359e8cb` (`Merge upstream/main (23e388b05) into main`); task 03's restore of the fork's read path is `f8d30c62d`. An earlier merge, `553430f40`, staged the payload onto the fork's tree instead of merging three-way, so it kept the fork's version of files upstream had rewritten. It is kept on the branch `sync-backup-2026-10` and is not an ancestor of `main`.

- `npm run typecheck` from the repo root: clean across all workspaces.
- From `packages/app`, `npx vitest run src/runtime/replica-cache src/agent-stream src/timeline src/subagents src/i18n`: **55 files, 734 tests passed**.
- Full app suite `npx vitest run`: 643 files, 6090 tests. Five files fail on this Windows machine, and the same five fail at the fork tip `b5f8b46ea` and at `23e388b05`: `src/git/forges/index.test.ts` (`ENOENT 'D:\D:\DEVELOPMENT\...'`, a `file://` pathname join), the two Markdown file-URI image tests (`src/utils/assistant-markdown-image-source.test.ts` and upstream's `src/components/markdown/image-source.test.ts`), `src/changelog/internal/parse-changelog.test.ts` (date locale), `src/composer/draft/input-draft.live.test.tsx` (IndexedDB unavailable, 10s hook timeout). None is a merge regression.
- Merge audit against the merge base `9ab99a6e1`, comparing `HEAD` with `23e388b05` for every path upstream changed: 0 upstream files deleted; upstream's version taken verbatim everywhere the fork did not touch the file; 28 files carry both sides; 47 fork-only files preserved.
- Where `HEAD` differs from upstream across those 28 files it adds 1119 lines and lacks 146, concentrated in `track.tsx` (87 — the fork's row layout, with upstream's facts line folded in by task 04) and `replica-cache/index.ts` (40 — task 03's read path). The rest are fork-side supersets, each with a reason in the file: `github-service.ts` keeps the GraphQL document on one argv line because Windows launches `gh` through `cmd.exe`; `plugin-process.ts` always consumes IPC send errors and guards `disconnect` on `process.connected`.
- The fork's 30-line `matchesReplicaRead` and 570-line test file are not in `main`; task 03 restored the read path on top of upstream's file.

## Upstreaming decision

Not upstreamed. Fork-only feature on top of upstream's file.
