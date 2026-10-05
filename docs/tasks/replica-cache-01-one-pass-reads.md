# Replica cache 01: Make reads one-pass logical reads

## Outcome

`ReplicaCache` reads a requested cache row exactly once from durable storage, applies matching accepted pending changes in memory, and returns without forcing persistence or retrying because unrelated rows changed.

A read started under an old host activation is rejected after host remove, re-add, or identity reconciliation.

## Context

This implements the core change from [Replica cache one-pass reads](../plans/replica-cache-read-path.md) and fixes the starvation mechanism in [getpaseo/paseo#4813](https://github.com/getpaseo/paseo/issues/4813).

The current row store and pending-change maps are already row-keyed. Do not add a second cache model or preserve the host-wide read retry loop with finer revision counters.

## Implement

1. Add focused regression coverage in `packages/app/src/runtime/replica-cache/index.test.ts` before changing the production path.
2. Replace ordinary data-change use of the host-wide revision with a host-lifetime generation:
   - advance it when a host is added or removed;
   - advance the affected identities during `reconcileServerId()`;
   - do not advance it for agent, workspace, project, checkpoint, timeline, or directory-baseline commits.
3. Capture the host generation at the start of `readRows()`, before waiting behind any queued store operation.
4. Make `readRows()` perform one storage read only:
   - it may wait for a store operation that was already in flight;
   - it must not call `flush()`, `persist()`, or `syncPending()`;
   - it must not contain a retry loop.
5. Reuse/generalize the existing store-operation sequencing so a read cannot observe storage in the gap between draining pending changes and finishing their write. Keep this inside `ReplicaCache`; do not create a new queue abstraction.
6. Overlay only pending state relevant to the requested host/kinds/ids:
   - matching pending deletes hide durable rows;
   - matching pending upserts replace/add durable rows;
   - a pending directory baseline hides old durable non-timeline directory rows;
   - timeline rows remain independent of directory baseline replacement;
   - serialize/materialize only matching pending upserts.
7. Re-check the captured host generation before accepting the read result. A remove -> re-add of the exact same `serverId` must not make an old in-flight read current again.
8. Delete read-consistency helpers that become unnecessary, including the ordinary-data revision/retry checks. Do not retain dead compatibility paths.
9. Keep current deferred persistence behavior for commits. This Task changes what reads see, not the write schedule or storage failure policy.
10. Keep existing directory/timeline owner guards unchanged. They remain responsible for deciding whether a completed cache read may still enter live UI state.

## Acceptance

- Reading agent A while every storage read triggers a timeline commit for unrelated agent B completes with exactly one `rowStore.read()` and zero additional writes.
- A pending upsert for the requested row wins over its older durable value without forcing a write.
- A pending delete for the requested row prevents the durable row from reappearing.
- A same-row change accepted while the storage read is in flight is reflected in the returned logical cache result without a second storage read.
- A pending directory baseline returns the replacement directory while preserving independently stored timeline rows.
- Removing a host while a read is in flight makes that read a cache miss.
- Removing and then re-adding the same `serverId` while an old read is in flight still rejects the old read.
- `reconcileServerId()` invalidates reads started under the superseded identity.
- Existing corrupt-row repair, cache eviction, directory checkpoint, and timeline round-trip tests remain green.
- `readRows()` contains no retry loop and does not trigger persistence.

## Verify

Run the replica-cache unit suite only, then the repository-required static checks. The regression assertions must count reads and writes rather than infer success from elapsed time.

## Focused checks

```text
npx vitest run packages/app/src/runtime/replica-cache/index.test.ts --bail=1
npm run typecheck
npm run lint -- packages/app/src/runtime/replica-cache/index.ts packages/app/src/runtime/replica-cache/index.test.ts
npm run format:check
```

## Required context

- [Replica cache one-pass reads](../plans/replica-cache-read-path.md)
- [Data model](../data-model.md)
- [Testing rules](../testing.md)
- [Repository instructions](../../AGENTS.md)
- [Replica cache](../../packages/app/src/runtime/replica-cache/index.ts)
- [Replica cache tests](../../packages/app/src/runtime/replica-cache/index.test.ts)

## Required skills

- `boring-architecture`

## Constraints

- Prefer deleting the old synchronization rule over adding another invalidation layer.
- No per-row or per-kind revision map.
- No new cache/store class, service, manager, scheduler, or event layer.
- No per-host queue in this Task.
- No row-store schema or protocol changes.
- No persistence retry/backoff/logging changes.
- Do not weaken existing late-cache/live-state owner guards.
- Do not run the full test suite locally.

## Quality gates

- The production control flow should be easier to explain after the change than before it.
- The read path must have one obvious source for durable state and one obvious source for pending state.
- New tests must reproduce races deterministically with gates/hooks, not sleeps.

## Stop conditions

Stop and ask before continuing if the implementation appears to require:

- a persisted row-format/schema change;
- a new public `ReplicaRowStore` capability solely for this fix;
- changes to directory or timeline reconciliation semantics outside cache admission;
- weakening the rule that an old host activation cannot supply data to a new activation;
- bundling persistence failure recovery or another performance project into this Task.
