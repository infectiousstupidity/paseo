# Upstream sync 07: run the merge and verify it

Status: **Proposed — awaiting review.** Depends on [05](../tasks/upstream-sync-05-i18n-subagents-panel-parity.md) landing first and on the accepted resolutions from [01](../tasks/upstream-sync-01-agent-stream-model-cache.md), [02](../tasks/upstream-sync-02-replica-cache-take-upstream.md), [04](../tasks/upstream-sync-04-subagents-track-opens-in-sheet.md), and [06](../tasks/upstream-sync-06-markdown-dependency-and-patch-reconcile.md). Plan: [Upstream sync: merge getpaseo/paseo main](../plans/upstream-sync-2026-10.md).

## Outcome

`upstream/main` is a parent of the fork's `main` through one merge commit, the focused checks pass locally, and CI is green.

## Preconditions

- Task 05 is merged, so `npm run typecheck` and the i18n parity test are green before the merge starts.
- The working tree is clean. At plan time `docs/mockups/paseo-mock-old.html` and `docs/mockups/paseo-mock-old2.html` are staged and local `main` is 1 commit behind `origin/main`:

  ```bash
  git add docs/mockups && git commit -m "docs(mockups): capture reference prototypes"
  git pull --ff-only
  git status --short   # empty
  ```

- Re-run the dry run and confirm the conflict set is still exactly the four files. If upstream moved, redo [the plan's dry run](../plans/upstream-sync-2026-10.md) before merging.

## Steps

```bash
git fetch upstream
git merge-tree --write-tree --name-only HEAD upstream/main   # expect the same four paths
git merge upstream/main                                      # stops on the four conflicts
```

Apply the accepted resolutions:

```bash
git checkout --theirs packages/app/src/agent-stream/model.ts
git checkout --theirs packages/app/src/runtime/replica-cache/index.ts \
                      packages/app/src/runtime/replica-cache/index.test.ts
# track.tsx: keep ours, then add the two edits from Task 04
git add packages/app
git status --short   # only the intended paths staged
```

Then Task 06's install step, then the focused checks, then:

```bash
git commit   # merge commit; message lists the four resolutions and why
git push
```

## Verification

Local, focused only:

```bash
npx vitest run packages/app/src/runtime/replica-cache/index.test.ts --bail=1
npx vitest run packages/app/src/agent-stream/strategy-web.test.tsx packages/app/src/agent-stream/model.test.ts --bail=1
npx vitest run packages/app/src/subagents --bail=1
npx vitest run packages/app/src/i18n/resources.test.ts --bail=1
npx vitest run packages/app/src/components/markdown/renderer.test.ts --bail=1
npm run typecheck
npm run lint
npm run format:check
```

CI, not local: the fork's subagent e2e specs (`subagent-detach`, `subagent-origin-pane`, `archive-finished-subagents`, `compact-workspace-sheet`, `provider-subagents.real`), the markdown specs, and the full unit suites.

## Acceptance

- `git rev-list --count HEAD..upstream/main` is 0.
- `git diff upstream/main -- packages/app/src/agent-stream/model.ts packages/app/src/runtime/replica-cache` is empty.
- `git diff upstream/main --stat` shows only fork-owned areas: `docs/`, `packages/app/src/subagents/`, `packages/app/src/panels/`, plugins, mockups, and the fork's other features.
- The focused checks above pass, and CI on the merge commit is green.

## Review

- **One merge commit, not a rebase.** 232 fork commits rebased over 47 upstream commits re-resolves the same conflicts repeatedly and rewrites history that other machines already have.
- Confirm the merge commit message names each resolution and links the upstream PR numbers (#7052, #7074, #7141, #6958, #6973) so the next sync can find why.
- If a conflict appears in a file no task covers, stop. Do not resolve it by feel; record it in the plan and write a task.

## Rollback

Before committing: `git merge --abort`. After pushing: `git revert -m 1 <merge-sha>` — never force-push the fork's `main` to undo a merge.

## Constraints

- Never run the full test suite locally; use CI for broad runs.
- Do not restart the dev or packaged daemon as part of verification.
- Do not push anything to `upstream`.
- Do not fold Task 03 (replica cache read restore) into the merge commit.

## Required context

- [Upstream sync plan](../plans/upstream-sync-2026-10.md)
- [QA evidence bar](../qa.md)
- [Testing rules](../testing.md)
- [Repository instructions](../../CLAUDE.md)
