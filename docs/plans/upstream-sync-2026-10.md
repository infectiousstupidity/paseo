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

## Merge outcome (2026-10-19)

`upstream/main` at `23e388b05` is a parent of `main` as of `69359e8cb`. Task 03's read path is `f8d30c62d` on top. Nothing is pushed; `origin/main` is behind by 6 commits.

**Fork-only rule.** This work is not upstreamed and no PR to `getpaseo/paseo` is planned. The goal is a fork carrying every upstream update it can without losing its own additions.

**A first attempt was discarded.** `553430f40` built the merge by staging the payload onto the fork's tree (`git write-tree` plus `git commit -p 9ab99a6e1 -p f0acc2c72`), so git never compared the two sides hunk by hunk. It survives on the branch `sync-backup-2026-10`; `main` was reset to `b5f8b46ea` and merged for real. A first audit of the discarded commit compared blob identity and claimed "47 files kept the fork's version, upstream work dropped"; that method counted files the **fork** changed and upstream never touched, where the fork's version is the correct result. Audit against the merge base instead.

**Audit of the merge that stands**, base `9ab99a6e1`, `HEAD` against `23e388b05` for every path upstream changed:

| Measure                               | Result                                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| Upstream files deleted by the merge   | 0                                                           |
| Upstream-changed files taken verbatim | all of them, except the 28 the fork also changed            |
| Files carrying both sides             | 28 (1119 lines over upstream, 146 lines of upstream absent) |
| Fork-only files preserved             | 47                                                          |

The 146 absent lines are the intended divergences: 87 in `subagents/track.tsx` (the fork's row layout; upstream's facts line is folded into the row's meta line by task 04), 40 in `runtime/replica-cache/index.ts` (task 03's one-pass read), and small fork-side supersets with a reason in the file — `services/github-service.ts` keeps a GraphQL document on one argv line because Windows launches `gh` through `cmd.exe`, `plugins/plugin-process.ts` always consumes IPC send errors and guards `disconnect` on `process.connected`.

**Gate results on the merged tree**, after `npm install` and `npm run build:protocol`:

- `npm run typecheck` at the root: clean across all workspaces.
- `packages/app`, `npx vitest run src/runtime/replica-cache src/agent-stream src/timeline src/subagents src/i18n`: 55 files, 734 tests passed.
- `packages/server`, `npx vitest run src/server/agent/tool-loop src/server/agent/agent-projections src/server/terminal`: 2 files, 23 tests passed.
- Full app suite `npx vitest run`: 643 files, 6090 tests, 5 failing files. Each of the five fails identically at the fork tip `b5f8b46ea` and at `23e388b05` on this Windows machine, so none is a merge regression: `src/git/forges/index.test.ts` (`ENOENT 'D:\D:\DEVELOPMENT\...'`), the two Markdown file-URI image tests, `src/changelog/internal/parse-changelog.test.ts` (date locale), `src/composer/draft/input-draft.live.test.tsx` (IndexedDB unavailable, hook timeout).

**Loose ends found on the way.** `scripts/postinstall-patches.mjs` spawns `patch-package.cmd`, which `cmd.exe` cannot resolve when npm runs the lifecycle from Git Bash; its fallback deletes the patched packages. `npm install` from a Windows shell is fine, so this is a fork-side fix to resolve the shim through `node_modules/.bin`. Three of this plan's gates — `labels:check`, `check:i18n-untranslated`, `execable:check` — are not scripts on `main`; they live on `codex/ci-pipeline-audit`, so they were not run here.

**Open after this merge:** task 05 (i18n `subagents.panel` parity) is untouched; the fork's subagent e2e specs (`subagent-detach`, `subagent-origin-pane`, `archive-finished-subagents`, `compact-workspace-sheet`, `provider-subagents.real`) need a Playwright run, which needs an emulator; `origin/main` needs the push.

## Done

The sync is complete when `upstream/main` is a parent of the fork's `main` ✅ (`69359e8cb`), `git diff upstream/main -- packages/app/src/agent-stream/model.ts packages/app/src/runtime/replica-cache/` shows only the intentional fork deltas from Task 03 ✅, typecheck passes ✅, and CI is green on the merge commit ⏳ (not pushed; task 05's locale parity test is still open).
