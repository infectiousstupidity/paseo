# Upstream sync: merge getpaseo/paseo main

> Status: **Proposed.** A dry-run merge on 2026-10-16 found 4 conflicted files and 2 failures that merge cleanly but break the build. No merge was performed. Each finding has a task document with a proposed fix. Review each task, accept or revise it, then implement.

## Inputs

| Ref                  | Commit      | Notes                                                              |
| -------------------- | ----------- | ------------------------------------------------------------------ |
| `origin/main` (fork) | `c267f0cf2` | 232 commits ahead of upstream                                      |
| `upstream/main`      | `98559bf72` | 47 commits the fork does not have                                  |
| merge base           | `9ab99a6e1` | `feat(website): show sponsors on the homepage and website (#6870)` |

Working tree at review time: local `main` is 1 commit behind `origin/main`, and `docs/mockups/paseo-mock-old.html` and `docs/mockups/paseo-mock-old2.html` are staged. Commit or stash both before merging.

## Reproduce the dry run

```bash
git fetch upstream
git merge-tree --write-tree --name-only origin/main upstream/main
```

Exit code 1. The first output line is the merged tree (`6913321435da13da24c6ee1f8d1eeb5fe48085cf`); the next four are the conflicted paths. Read a conflicted file out of that tree without touching the working tree:

```bash
git cat-file -p 6913321435da13da24c6ee1f8d1eeb5fe48085cf:packages/app/src/subagents/track.tsx
```

`git merge-tree` reports textual conflicts only. Findings 05 and 06 surface at `npm run typecheck` and `npm install` time instead.

## Findings

| #   | Area                            | Why it does not merge cleanly                                                                                              | Proposed resolution                                     | Task                                                                                     |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 01  | `agent-stream/model.ts`         | Both sides added a rendered-tail cache for the same long-chat cost (fork `160a887ba`, upstream `8d424e039` / #7052)        | Take upstream, drop the fork's duplicate cache          | [Upstream sync 01](../tasks/upstream-sync-01-agent-stream-model-cache.md)                |
| 02  | `runtime/replica-cache/`        | The fork rewrote the read path (`0014432e6`); upstream rewrote the same module for #4813 (`e0de0fdf6` / #7074)             | Take upstream wholesale, no hunk-level merge            | [Upstream sync 02](../tasks/upstream-sync-02-replica-cache-take-upstream.md)             |
| 03  | Replica cache read overlay      | Upstream's fix keeps a read-triggered `syncPending()`; the fork's barrier-free read is the part that still matters         | Re-land the fork's one-pass read on top of upstream     | [Upstream sync 03](../tasks/upstream-sync-03-replica-cache-one-pass-read-restore.md)     |
| 04  | `subagents/track.tsx`           | The fork rewrote the track; upstream added the `opensInSheet` sheet-stack rule (`e5124b039` / #6958)                       | Keep the fork's file, thread the new prop through       | [Upstream sync 04](../tasks/upstream-sync-04-subagents-track-opens-in-sheet.md)          |
| 05  | i18n `subagents.panel` keys     | Merges cleanly; the fork's English-only keys already fail typecheck and the locale parity test                             | Add the 29 keys to the 8 other locales                  | [Upstream sync 05](../tasks/upstream-sync-05-i18n-subagents-panel-parity.md)             |
| 06  | App dependencies and `patches/` | Merges cleanly; upstream replaced the markdown renderer and added a patch for a dependency the fork's `node_modules` lacks | Reinstall, rebuild declarations, re-verify              | [Upstream sync 06](../tasks/upstream-sync-06-markdown-dependency-and-patch-reconcile.md) |
| 07  | The merge commit itself         | —                                                                                                                          | One merge commit with the accepted resolutions, then CI | [Upstream sync 07](../tasks/upstream-sync-07-merge-integration-verification.md)          |

## Decisions

**Upstream owns shared app internals; the fork keeps its product features.** Where both sides fixed the same defect, take upstream's version and re-land the fork's improvement on top as a separate commit (01, 02, 03). Keeping a private variant of `agent-stream/model.ts` or `runtime/replica-cache/index.ts` means re-resolving the same file at every future sync, and upstream's version is the one its tests assert.

**Never hand-merge a rewritten module hunk by hunk.** The replica-cache conflict is 8 hunks in the module and 3 in its tests, with both sides renaming internals. Hunk-level resolution produces a file neither side tests.

**Fix the pre-existing red before merging.** Finding 05 fails `npm run typecheck` and `packages/app/src/i18n/resources.test.ts` on `origin/main` today. Landing it first keeps the merge's verification signal clean.

## Ordered tasks

1. [05 — i18n `subagents.panel` parity](../tasks/upstream-sync-05-i18n-subagents-panel-parity.md) — independent, lands before the merge.
2. [01 — agent-stream model cache](../tasks/upstream-sync-01-agent-stream-model-cache.md), [02 — replica cache to upstream](../tasks/upstream-sync-02-replica-cache-take-upstream.md), [04 — subagents track `opensInSheet`](../tasks/upstream-sync-04-subagents-track-opens-in-sheet.md) — resolutions applied inside the merge commit.
3. [06 — dependency and patch reconcile](../tasks/upstream-sync-06-markdown-dependency-and-patch-reconcile.md) — after the conflicts are resolved.
4. [07 — merge integration and verification](../tasks/upstream-sync-07-merge-integration-verification.md) — depends on 01, 02, 04, 05, 06.
5. [03 — replica cache one-pass read restore](../tasks/upstream-sync-03-replica-cache-one-pass-read-restore.md) — after the merge lands.

## Verification bar

- Focused vitest files only, never the full suite locally; push to CI for the broad run.
- `npm run typecheck`, `npm run lint`, `npm run format:check` clean in `packages/app`.
- The fork's subagent e2e specs pass: `subagent-detach`, `subagent-origin-pane`, `archive-finished-subagents`, `compact-workspace-sheet`, `provider-subagents.real`.
- The three typecheck artifacts caused by a stale `node_modules` (see 06) are gone after `npm install`.

## Done

The sync is complete when `upstream/main` is a parent of the fork's `main`, `git diff upstream/main -- packages/app/src/agent-stream/model.ts packages/app/src/runtime/replica-cache/` shows only the intentional fork deltas from Task 03, typecheck and the locale parity test pass, and CI is green on the merge commit.
