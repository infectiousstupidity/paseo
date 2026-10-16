# Upstream sync 01: take upstream's rendered-tail cache

Status: **Proposed — awaiting review.** Resolution for one of the four merge conflicts in [Upstream sync: merge getpaseo/paseo main](../plans/upstream-sync-2026-10.md). Apply it inside the merge commit, not as a follow-up.

## Outcome

The merged `packages/app/src/agent-stream/model.ts` is identical to `upstream/main`. Upstream's rendered-tail cache stays; the fork's competing cache from `160a887ba` is gone.

## Evidence

One conflict hunk: `model.ts` lines 66–93 in the merged tree `6913321435`.

Both sides solved the same problem — a streamed delta rebuilds the render model over the same tail, and everything downstream is keyed on the rendered tail's identity, so `tail.slice(historyStart)` must be reused rather than recomputed:

- Fork `160a887ba` (`perf(stream): preserve history identity during head updates`, 20 insertions in `model.ts` only): `renderedTailCache = WeakMap<StreamItem[], Map<number, StreamItem[]>>` plus `getRenderedTail`. Every window start ever used stays cached.
- Upstream `8d424e039` (`Reduce rendering cost in long chats (#7052)`, fixes getpaseo/paseo#4816): `renderedTailCache = WeakMap<StreamItem[], { historyStart, rendered }>` plus its own `getRenderedTail`, which replaces the single entry when the window changes so old windows collect. The same commit deletes the base's `turnTimingCache`/`getTurnTiming` and splits the turn-timing walk: the tail is walked once per tail identity, the head per delta from the carried open turn, and the timing Map keeps its identity while the head completes no turn.

`git diff 9ab99a6e1 origin/main -- packages/app/src/agent-stream/model.ts` is 20 insertions and touches nothing else. `getTurnTiming` has no callers outside `model.ts` on `origin/main`, so upstream deleting it breaks no fork code.

## Proposed fix

```bash
git checkout --theirs packages/app/src/agent-stream/model.ts
git add packages/app/src/agent-stream/model.ts
git diff upstream/main -- packages/app/src/agent-stream/model.ts   # must be empty
```

## Review

- **Does the fork's per-window Map buy anything?** It only helps a view that alternates between two `historyStart` values on the same tail array. Upstream's single entry covers the one-active-window case and releases the superseded window's arrays. Deviating from upstream here means re-resolving this file at every future sync; require a bench number before doing it. Upstream's reported numbers (200 deltas over a 2,000-item timeline): 5.68ms → 2.82ms at the default mounted window, 16.95ms → 1.81ms with history fully revealed.
- **The fork's own regression test survives.** `packages/app/src/agent-stream/strategy-web.test.tsx` gained a fork-only case, "does not rerender bounded committed history when only the live head grows" (72 lines, merges cleanly). It asserts the identity property upstream also targets, so it is the check that upstream's version is good enough.

## Acceptance

- `git diff upstream/main -- packages/app/src/agent-stream/model.ts` is empty.
- The fork's `strategy-web.test.tsx` identity case passes against upstream's model.
- No `renderedTailCache` variant of the fork's shape remains anywhere.

## Focused checks

```bash
npx vitest run packages/app/src/agent-stream/strategy-web.test.tsx packages/app/src/agent-stream/model.test.ts --bail=1
npm run typecheck
npm run lint -- packages/app/src/agent-stream/model.ts
npm run format:check
```

## Constraints

- No hunk-level merge of this file.
- No new cache layer to keep both designs.

## Required context

- [Upstream sync plan](../plans/upstream-sync-2026-10.md)
- [Agent stream performance](../agent-stream-performance.md)
- [Agent stream model](../../packages/app/src/agent-stream/model.ts)
