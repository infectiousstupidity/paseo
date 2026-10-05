# Replica cache 02: Prove one-pass reads on real storage and the browser path

## Outcome

The one-pass replica-cache read contract from Task 01 is proven against the real SQLite adapter and the browser IndexedDB path, including the actual user scenario: open cached agent A while agent B on the same host is continuously streaming.

The durable documentation records the small read contract, and no unrelated persistence or queue redesign is added.

## Context

Task 01 establishes the in-memory behavior. This Task verifies that the same semantics survive real storage scheduling and the browser/Electron IndexedDB path instead of relying only on the `MemoryStorage` fake.

Reuse the existing SQLite test harnesses and `replica-cache-performance.spec.ts`. Do not create a parallel benchmark framework.

## Implement

1. Add focused real-SQLite coverage using the existing replica/directory test harnesses:
   - a read of A remains one-pass while unrelated B changes are accepted;
   - a requested-row replacement or deletion accepted during the durable read wins over the stored row;
   - an old read cannot survive host lifetime replacement.
2. Keep the tests deterministic. Use the existing read gates/hooks around the SQLite adapter. Do not use sleeps to create races.
3. Extend `packages/app/e2e/browser/replica-cache-performance.spec.ts` with the #4813 user journey:
   - seed two agents/workspaces on the same host as needed by the existing fixtures;
   - make agent B sustain a stream;
   - while B is still streaming, open cached agent A;
   - prove A paints before B finishes;
   - measure replica storage writes around the read/open action.
4. Reuse `packages/app/e2e/support/helpers/replica-cache-perf.ts` and `replica-cache-storage.ts`. Extend those helpers only when the assertion cannot be expressed with their existing read/write observer.
5. The browser regression must prove the causal invariant, not only "it felt fast":
   - opening A causes no immediate replica persist;
   - the number of durable reads for A is bounded to the requested read path;
   - B may continue to stream while A becomes usable.
6. If Task 01 reveals that counting IndexedDB reads requires instrumentation, add the smallest observer next to the existing write observer. Keep it test-only.
7. Update the "Replica row store" section of `docs/data-model.md` with the durable contract only:
   - reads are one-pass;
   - accepted pending changes for requested rows overlay older durable rows;
   - reads do not force persistence;
   - host lifetime changes invalidate old in-flight reads.
   Do not restate the implementation or copy the plan into the data-model doc.
8. Do not change production behavior in this Task unless a real-store test exposes a correctness bug in Task 01. Any production correction must stay within the Task 01 invariants.

## Acceptance

- The focused SQLite tests reproduce the important same-row, unrelated-row, and host-lifetime races against the real adapter.
- The browser performance test opens cached A while B is still streaming and A becomes usable before the stream ends.
- Opening A produces zero replica writes caused by the read itself.
- The browser test fails against the old read-side persistence/retry behavior or an equivalent controlled regression.
- The existing sustained-stream replica-cache performance assertions remain green.
- No new benchmark framework, cache layer, or platform-specific production branch is introduced.
- `docs/data-model.md` states the read contract once and remains concise.

## Verify

Run only the focused SQLite/cache files and the opt-in replica-cache browser performance spec, then the repository-required static checks. Keep Playwright at one worker.

## Focused checks

```text
npx vitest run packages/app/src/timeline/replica.test.ts --bail=1
npx vitest run packages/app/src/runtime/directory-sync/index.test.ts --bail=1
PASEO_REPLICA_CACHE_PERF_E2E=1 npm run test:e2e --workspace=@getpaseo/app -- e2e/browser/replica-cache-performance.spec.ts --workers=1
npm run typecheck
npm run lint -- packages/app/src/timeline/replica.test.ts packages/app/src/runtime/directory-sync/index.test.ts packages/app/e2e/browser/replica-cache-performance.spec.ts packages/app/e2e/support/helpers/replica-cache-perf.ts packages/app/e2e/support/helpers/replica-cache-storage.ts packages/app/src/runtime/replica-cache/index.ts
npm run format:check
```

## Required context

- [Replica cache one-pass reads](../plans/replica-cache-read-path.md)
- [Task 01](./replica-cache-01-one-pass-reads.md)
- [Data model](../data-model.md)
- [Testing rules](../testing.md)
- [QA rules](../qa.md)
- [Repository instructions](../../AGENTS.md)
- [SQLite timeline replica tests](../../packages/app/src/timeline/replica.test.ts)
- [Directory sync tests](../../packages/app/src/runtime/directory-sync/index.test.ts)
- [Replica-cache performance spec](../../packages/app/e2e/browser/replica-cache-performance.spec.ts)
- [Replica-cache performance helper](../../packages/app/e2e/support/helpers/replica-cache-perf.ts)
- [Replica-cache storage helper](../../packages/app/e2e/support/helpers/replica-cache-storage.ts)

## Required skills

- `boring-architecture`

## Constraints

- Task 01 must be complete first.
- Reuse existing real-store and browser harnesses.
- No arbitrary sleeps for race correctness.
- No new production platform branch.
- No persistence backoff/retry policy changes.
- No per-host queue work.
- No full local test suite.

## Quality gates

- The real-store tests must exercise the production row-store adapters, not a second fake that reproduces the same assumptions as Task 01.
- The browser assertion must prove that A opens while B is still streaming, not merely after a fixed timeout.
- Performance evidence must report concrete read/write counts where instrumentation supports them.

## Stop conditions

Stop and ask before continuing if:

- the real storage adapters cannot satisfy the Task 01 invariants without changing their public contract;
- browser proof requires invasive production instrumentation rather than a test-only observer;
- a failure points to the shared cross-host queue rather than read-triggered persistence;
- the fix expands into persistence failure recovery or another independent performance issue.
