# Upstream sync: merge getpaseo/paseo main

> Status: **Tasks 06, 08, and 09 implemented; Task 07 blocked at refreshed upstream scope.** The real merge includes pinned upstream `9a0b95aa1` (0.12.0) and preserves the fork inspector and fork-remote reconciliation. Refreshed upstream is `b6dde61a7`, three unintegrated commits ahead. [Task 07 preflight evidence](../tasks/upstream-sync-07-merge-integration-verification.md#preflight-evidence) records the ancestry/cache checks and outstanding delivery gates.

## Reviewed refs (historical planning snapshot)

| Ref                                             | Commit      | State at refresh                                                   |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| Local `main` / `HEAD`                           | `999d51cb2` | Contains the first real upstream merge and replica-cache follow-up |
| `origin/main` (fork)                            | `7c35c4a8f` | One commit absent locally: archive fencing for automated prompts   |
| `upstream/main` (getpaseo)                      | `9a0b95aa1` | Seven commits absent locally                                       |
| Last integrated upstream / merge base with HEAD | `23e388b05` | Parent of merge `69359e8cb`                                        |

Local `main` is **123 commits ahead and 1 behind** `origin/main` by ancestry, not six unpublished commits ahead. These counts include the upstream history. Fetch both remotes before implementation and recheck the refs; never infer synchronization from the old counts.

The checkout has unrelated tracked and untracked documentation/tool-policy changes. Preserve them. Do not stage everything, reset the checkout, automatically stash another worker's edits, or run an install here. Use a clean integration checkout after the operator decides which fork work belongs in the sync.

## What is already done

| Task                                                                                                 | Completion  | Retained result                                            |
| ---------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| [01 — model cache](../tasks/upstream-sync-01-agent-stream-model-cache.md)                            | `69359e8cb` | Upstream's model; no current delta                         |
| [02 — replica cache base](../tasks/upstream-sync-02-replica-cache-take-upstream.md)                  | `69359e8cb` | Upstream's cache at the merge commit                       |
| [03 — accepted-state read overlay](../tasks/upstream-sync-03-replica-cache-one-pass-read-restore.md) | `f8d30c62d` | Intentional fork delta on top; preserve it                 |
| [04 — sheet-stack navigation](../tasks/upstream-sync-04-subagents-track-opens-in-sheet.md)           | `69359e8cb` | Fork inspector plus upstream sheet/tab rule and facts line |
| [05 — locale parity](../tasks/upstream-sync-05-i18n-subagents-panel-parity.md)                       | `6fc9e613e` | All 29 panel keys in all nine locales                      |

Upstream's seven new commits change none of the model cache, replica cache, or locale resources. Do not repeat Tasks 01–05 or check out upstream's cache over Task 03. The renderer migration originally covered by Task 06 is also merged; its remaining installer defect is described in that task.

## New upstream commits

| Commit      | Change                                                    | Integration handling                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `644d66ba4` | Complete Korean terminal words on long press (#7353)      | Clean merge; unit selection coverage plus Android evidence                                                                                                                                                                    |
| `d61dcaf1d` | Compact subagent rows and standard press feedback (#7364) | [Task 08](../tasks/upstream-sync-08-subagents-compact-feedback.md) resolves the track and adapts the fork-only disclosure; [09](../tasks/upstream-sync-09-windows-lint-rule-runner.md) repairs the new test runner on Windows |
| `b8bcd204a` | Dismiss touch composer focus when switching tabs (#7352)  | Clean merge; retain fork modifier-key additions                                                                                                                                                                               |
| `8dd3e2e34` | Prepare 0.12.0 changelog                                  | Take upstream metadata                                                                                                                                                                                                        |
| `cafe4b01c` | Cut 0.12.0                                                | Take release versions while preserving fork scripts                                                                                                                                                                           |
| `9be154774` | Show promoted git action once in compact menu (#7355)     | Clean merge; policy tests and compact-menu browser spec                                                                                                                                                                       |
| `9a0b95aa1` | Update lockfile signatures and Nix hash                   | Keep paired lockfile/hash updates; verify on merged manifests                                                                                                                                                                 |

Forty paths change upstream. Six also differ on the fork since the merge base: `docs/design.md`, `packages/app/src/composer/input/input.tsx`, `packages/app/src/composer/tracks.tsx`, `packages/app/src/subagents/track.tsx`, `packages/desktop/package.json`, and `packages/server/package.json`. Only the track conflicts textually. Inspect the clean overlaps too, including the operator's current design-doc changes when they are ready to integrate.

## Reproduce without touching the working tree

```bash
git fetch origin
git fetch upstream
git rev-parse HEAD origin/main upstream/main
git merge-base HEAD upstream/main
git log --oneline HEAD..upstream/main
git merge-tree --write-tree --name-only HEAD origin/main
git merge-tree --write-tree --name-only HEAD upstream/main
```

For the pinned refs above, the origin dry run exits 0, tree `d9ad391d8a6f1e4b9580696abc7649df384fe39a`. The upstream dry run exits 1, tree `cefd4ccaab8474aedb13ce5310c92fcf20ac6b53`, with only `packages/app/src/subagents/track.tsx` conflicted (three regions). The tree contains conflict markers; it is evidence, not a tree to commit.

```bash
git cat-file -p cefd4ccaab8474aedb13ce5310c92fcf20ac6b53:packages/app/src/subagents/track.tsx
git diff 23e388b05 upstream/main --stat
```

Textual merge success does not establish semantic compatibility. In the track, clean hunks add required props while the surviving fork call site lacks them. The raw-pressable rule also rejects a fork-only file that never conflicts. Task 08 covers both.

## Remaining tasks and order

1. [06 — dependency/patch reconciliation](../tasks/upstream-sync-06-markdown-dependency-and-patch-reconcile.md): fix the confirmed Windows unavailable-tool failure in the existing installer; land separately before merging.
2. [08 — compact subagent integration](../tasks/upstream-sync-08-subagents-compact-feedback.md): reconcile the fork remote, merge the seven upstream commits, resolve the one track conflict, and adapt the expanded-details disclosure to the new lint rule. Depends on 06 and the completed 04.
3. [09 — Windows lint-rule runner](../tasks/upstream-sync-09-windows-lint-rule-runner.md): fix the new test's extensionless executable-shim invocation. Depends on 08.
4. [07 — final integration verification](../tasks/upstream-sync-07-merge-integration-verification.md): validate preserved fork deltas, merged versions/lockfile, focused tests, browser/native evidence, and fork CI. Depends on 06, 08, 09 and the completed 01–05.

Task numbers retain their original identities; they are not execution order. No task requires Task 07 to complete before it can run.

## Refreshed upstream delta

Task 07 fetched both remotes at `HEAD=567a91d0d` (Task 09). Origin matches HEAD; upstream is `b6dde61a7`. The reviewed `7c35c4a8f` and `9a0b95aa1` remain ancestors, but `HEAD..upstream/main` contains three commits:

| Commit      | Change                                          | Scope needing review before another merge                                                                                                 |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `c575464e8` | Skip saving unchanged workspace layouts (#7358) | Validated persistence and workspace-layout store; deduplicates saves and changes persistence bookkeeping.                                 |
| `1e0e56c72` | Unify built-in file panel selection (#7366)     | Moves preview ownership to `file-panels`, introduces a catalog/resolver, and changes file-pane selection and stored settings.             |
| `b6dde61a7` | Inline SVG and component plugin icons (#7368)   | Broad plugin SDK/client icon contract and rendering changes, shared SVG validation, server compiler SVG loader, and plugin examples/docs. |

`git log --oneline --stat HEAD..upstream/main`, the three commit diffs, and `git diff --stat 9a0b95aa1 upstream/main` were inspected: 65 paths, 1,449 insertions, 366 deletions overall. This is a scope inventory, not merge-resolution or semantic-compatibility approval. No additional commits were merged.

Choose one before resuming Task 07:

- Keep the sync pinned to `9a0b95aa1` and explicitly revise the refreshed-tip acceptance gate to exclude these commits.
- Authorize a reviewed follow-up merge task for the new persistence, file-panel, and plugin changes, then verify the resulting combined tree. Do not fold these changes into the verification-only task.

## Current verification and blockers

- Prerequisites are committed: 06 `8bad0df74`, 08 `ab40481df`, 09 `567a91d0d`. Their task documents own the detailed implementation/check evidence.
- Task 07's [preflight evidence](../tasks/upstream-sync-07-merge-integration-verification.md#preflight-evidence) confirms the pinned ancestry, empty model delta, and unchanged Task 03 replica-cache overlay. The current upstream ancestry gate fails with three missing commits.
- Task 08 reports passing install and targeted unit/browser checks. Task 07 reran root typecheck (passed), lint (35 baseline errors), and format check (65 baseline files); see its [preflight evidence](../tasks/upstream-sync-07-merge-integration-verification.md#preflight-evidence). No quality-gate waiver applies.
- Task 09 reports passing Windows rule tests, including a path with spaces; POSIX execution remains for CI. Its CI-contract check reports 12 passing tests and one Windows path-prefix failure.
- Required real-provider, Android terminal/native feedback, other platform coverage, merged-graph Nix hash verification, and green CI on the exact delivered tip remain unestablished. No final delivery sign-off or push occurred in Task 07's preflight attempt.

## Integration rules and completion

- **Fork-only.** Push only to the fork; no PR to getpaseo is planned, including for Task 03.
- **Real merges.** Preserve both fork histories and upstream ancestry. Do not rebase published fork commits or manufacture a merge by assigning parents to a copied tree.
- **Preserve intentional deltas.** Upstream owns shared internals where it already supplies the same fix. That is not permission to erase the fork's accepted-state cache overlay, grouped inspector, Pi controls, Windows fixes, plugins, or package scripts.
- **Audit relative to the merge base.** Whole-file blob inequality cannot tell whether upstream work was dropped. The first real merge is `69359e8cb`; the discarded `553430f40` attempt on backup history is not the baseline.
- **Focused local tests only.** App Vitest commands run from `packages/app`. Full suites belong in CI. Browser specs use Chromium, not an emulator; native verification is separate. The real-provider project is not included by the default browser command.

The next sync is complete only when the reviewed fork-remote and upstream tips are ancestors of the final fork branch, the model remains upstream-identical, Task 03's only intentional cache delta survives, targeted checks and platform evidence are recorded, and CI is green on the published fork tip. Task 07 must not report completion while known quality gates or required platform checks remain unresolved.
