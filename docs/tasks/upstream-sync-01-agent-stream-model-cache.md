# Upstream sync 01: take upstream's rendered-tail cache

Status: **Accepted — verified, not applied.** Resolution for one of the four merge conflicts in
[Upstream sync: merge getpaseo/paseo main](../plans/upstream-sync-2026-10.md). It is a merge-commit
resolution, not a commit of its own: apply it inside the merge that task 07 creates. No merge is in
progress on `main`, so nothing lands from this task alone — see [Blocked on](#blocked-on).

## Outcome

The merged `packages/app/src/agent-stream/model.ts` is identical to `upstream/main`. Upstream's
rendered-tail cache stays; the fork's competing cache from `160a887ba` is gone.

## Evidence

One conflict hunk: `model.ts` lines 66–93 in the merged tree.

Both sides solved the same problem — a streamed delta rebuilds the render model over the same tail,
and everything downstream is keyed on the rendered tail's identity, so `tail.slice(historyStart)`
must be reused rather than recomputed:

- Fork `160a887ba` (`perf(stream): preserve history identity during head updates`, 20 insertions in
  `model.ts` only): `renderedTailCache = WeakMap<StreamItem[], Map<number, StreamItem[]>>` plus
  `getRenderedTail`. Every window start ever used stays cached.
- Upstream `8d424e039` (`Reduce rendering cost in long chats (#7052)`, fixes getpaseo/paseo#4816):
  `renderedTailCache = WeakMap<StreamItem[], { historyStart, rendered }>` plus its own
  `getRenderedTail`, which replaces the single entry when the window changes so old windows collect.
  The same commit deletes the base's `turnTimingCache`/`getTurnTiming` and splits the turn-timing
  walk: the tail is walked once per tail identity, the head per delta from the carried open turn,
  and the timing Map keeps its identity while the head completes no turn.

`git diff 9ab99a6e1 origin/main -- packages/app/src/agent-stream/model.ts` is 20 insertions
(`renderedTailCache` + `getRenderedTail`) and touches nothing else. `getTurnTiming` has no callers
outside `model.ts` on `origin/main` — grep confirms it — so upstream deleting it breaks no fork code.

## Verification (2026-10-19)

The plan's refs are stale; the finding survived the drift. Re-ran the dry run on current tips:

| Ref                            | Commit at plan review | Commit now  |
| ------------------------------ | --------------------- | ----------- |
| `origin/main` / local `main`   | `c267f0cf2`           | `0fb2316ce` |
| `upstream/main`                | `98559bf72`           | `f0acc2c72` |
| merge base                     | `9ab99a6e1`           | `9ab99a6e1` |
| merged tree (`git merge-tree`) | `6913321435`          | `835909b11` |

```bash
git merge-tree --write-tree --name-only main upstream/main   # exit 1
```

Same four conflicted paths, and the `model.ts` conflict is still lines 66–93 of the merged tree
(`git cat-file -p 835909b11...:packages/app/src/agent-stream/model.ts`).

Applied upstream's file to the fork's tree in place — `git checkout upstream/main -- packages/app/src/agent-stream/model.ts`,
checks run, then `git restore --source=HEAD --staged --worktree -- <path>`; `main` was left untouched:

- `npx vitest run src/agent-stream/strategy-web.test.tsx src/agent-stream/model.test.ts` from
  `packages/app`: **27 passed**, including the fork-only case
  `createWebStreamStrategy > does not rerender bounded committed history when only the live head grows`.
- Wider signal, same state: `npx vitest run src/agent-stream` — **26 files, 269 tests passed**.
- `npx tsgo --noEmit` in `packages/app`: clean. Whole-repo typecheck adds nothing here — the file
  exports no symbol the fork uses outside `packages/app`.
- `npx oxlint packages/app/src/agent-stream/model.ts` and `npx oxfmt --check` on the same file: clean.
- `git grep -n "renderedTailCache\|getTurnTiming"`: only `model.ts` (upstream's single-entry shape)
  and this document. No fork-shaped cache remains.

Gotcha for the merge session: the root `vitest.config.ts` has no app projects or `setupFiles`, so
`npx vitest run packages/app/src/agent-stream/...` from the repo root dies with
`SyntaxError: Unexpected token 'typeof'`. Run vitest from `packages/app` with `src/...` paths.

## Proposed fix

```bash
git checkout --theirs packages/app/src/agent-stream/model.ts
git add packages/app/src/agent-stream/model.ts
git diff upstream/main -- packages/app/src/agent-stream/model.ts   # must be empty
```

## Review

- **Does the fork's per-window Map buy anything?** It only helps a view that alternates between two
  `historyStart` values on the same tail array. Upstream's single entry covers the one-active-window
  case and releases the superseded window's arrays. Deviating from upstream here means re-resolving
  this file at every future sync; require a bench number before doing it. Upstream's reported numbers
  (200 deltas over a 2,000-item timeline): 5.68ms → 2.82ms at the default mounted window,
  16.95ms → 1.81ms with history fully revealed.
- **The fork's own regression test survives.** `packages/app/src/agent-stream/strategy-web.test.tsx`
  gained a fork-only case, "does not rerender bounded committed history when only the live head
  grows" (72 lines, merges cleanly — it is not in the conflicted set). It asserts the identity
  property upstream also targets, and it passes against upstream's model: that is the check that
  upstream's version is good enough, and it is green.

## Acceptance

- `git diff upstream/main -- packages/app/src/agent-stream/model.ts` is empty. — checkable only in
  the merge commit.
- The fork's `strategy-web.test.tsx` identity case passes against upstream's model. — **met**, see
  Verification.
- No `renderedTailCache` variant of the fork's shape remains anywhere. — **met** in the applied
  state, see Verification.

## Focused checks

Run from `packages/app`:

```bash
npx vitest run src/agent-stream/strategy-web.test.tsx src/agent-stream/model.test.ts --bail=1
npx tsgo --noEmit
npx oxlint src/agent-stream/model.ts
npm run format:check          # repo root
```

## Constraints

- No hunk-level merge of this file.
- No new cache layer to keep both designs.
- Not a standalone commit on `main`: the resolution ships inside the merge commit.

## Blocked on

- Task 07 (`git merge upstream/main` in progress) — the file resolution has no home before it.
  Task 05 (i18n locale parity), the one prerequisite that lands before the merge, is done:
  `6fc9e613e`, and `src/i18n/resources.test.ts` passes 39 tests on `main`.
- Tasks 02 and 04 resolve the other three conflicted paths in that same commit; the merge cannot be
  committed with only this resolution.

## Required context

- [Upstream sync plan](../plans/upstream-sync-2026-10.md)
- [Agent stream performance](../agent-stream-performance.md)
- [Agent stream model](../../packages/app/src/agent-stream/model.ts)
