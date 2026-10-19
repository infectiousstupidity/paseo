# Upstream sync: merge getpaseo/paseo main

> Status: **Task 08 implemented on 2026-10-19; Tasks 09 and 07 remain.** The real merge includes pinned upstream `9a0b95aa1` (0.12.0), preserves the fork-remote reconciliation, and resolves compact subagent actions without replacing the fork inspector. [Task 08 completion evidence](../tasks/upstream-sync-08-subagents-compact-feedback.md#implementation-and-verification-2026-10-19) records install, typecheck, focused tests, and remaining native/CI evidence. The fetched upstream tip is now `c575464e8`; its extra workspace-layout commit is outside this pinned sync.

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

## Current verification and blockers

Evidence collected during this documentation refresh, on the existing checkout rather than a resolved merged tree:

- Root `npm run typecheck`: passes all workspaces.
- Panel-resource inspection: all eight non-English locales have all 29 keys and matching interpolation placeholders. This confirms Task 05 is implemented; it is not a new linguistic review.
- `node --test scripts/postinstall-patches.test.mjs`: 2 passed, 1 failed on Windows. Missing tool is misclassified as patch rejection; Task 06 owns it.
- Prospective upstream lint config/plugin, copied temporarily at the repo root: two new `paseo/no-raw-pressable` violations, in the track and expanded-details. Task 08 owns them. Existing app lint findings remain too.
- The new lint test's Windows spawn mechanism returns `ENOENT` for `node_modules/.bin/oxlint`. Task 09 owns it; the upstream test file itself is not installed on local main yet.
- Root `npm run lint`: **44 existing errors**, covering app, Pi/subagent/feedback server code, and proof/mockup scripts. This is an existing quality-gate blocker, not evidence that the next upstream merge regresses those files. Do not weaken lint or claim green CI. Task 07 records the baseline and stays blocked on green sign-off until the owning fork work clears it; a broad cleanup is outside these sync-resolution tasks.
- No browser, native, or full-suite run was performed for this refresh. Earlier recorded test results are historical and remain labeled as such.

## Integration rules and completion

- **Fork-only.** Push only to the fork; no PR to getpaseo is planned, including for Task 03.
- **Real merges.** Preserve both fork histories and upstream ancestry. Do not rebase published fork commits or manufacture a merge by assigning parents to a copied tree.
- **Preserve intentional deltas.** Upstream owns shared internals where it already supplies the same fix. That is not permission to erase the fork's accepted-state cache overlay, grouped inspector, Pi controls, Windows fixes, plugins, or package scripts.
- **Audit relative to the merge base.** Whole-file blob inequality cannot tell whether upstream work was dropped. The first real merge is `69359e8cb`; the discarded `553430f40` attempt on backup history is not the baseline.
- **Focused local tests only.** App Vitest commands run from `packages/app`. Full suites belong in CI. Browser specs use Chromium, not an emulator; native verification is separate. The real-provider project is not included by the default browser command.

The next sync is complete only when the reviewed fork-remote and upstream tips are ancestors of the final fork branch, the model remains upstream-identical, Task 03's only intentional cache delta survives, targeted checks and platform evidence are recorded, and CI is green on the published fork tip. Task 07 must not report completion while known quality gates or required platform checks remain unresolved.
