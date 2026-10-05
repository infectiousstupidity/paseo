# Replica cache one-pass reads

> Status: Current implementation plan for [getpaseo/paseo#4813](https://github.com/getpaseo/paseo/issues/4813).

## Goal

Opening a cached agent, workspace, directory, or timeline must not force pending replica-cache writes or restart because unrelated rows on the same host are changing.

A read should return the newest logical cache value available to the client:

```text
stored rows
    +
pending accepted changes
    =
logical cache read
```

The fix must keep stale reads from an old host lifetime from being accepted after that host is removed, renamed, or re-added.

## Root cause

The row store is already keyed by `(serverId, kind, id)`, and pending upserts/deletes are already tracked at that same granularity.

The read path throws away that precision. `readRows()` currently:

1. forces pending writes through `syncPending()`;
2. reads from storage;
3. rejects the result if the host-wide revision changed;
4. retries until the entire host is quiet.

A timeline commit for agent B therefore invalidates a cache read for unrelated agent A. During sustained streaming, the read can repeatedly serialize and persist unrelated work and may not finish until streaming pauses.

The fix is to remove the read-side persistence barrier rather than make the retry loop more elaborate.

## Decision

Use one-pass logical reads:

```text
read requested
     |
capture host lifetime generation
     |
wait only for an already-running store operation
     |
one rowStore.read()
     |
overlay matching pending deletes/upserts/baseline
     |
host lifetime still current?
     | yes
     v
return
```

### Stored rows plus pending changes

`ReplicaCache` already owns everything needed:

- `rowStore` contains durable rows;
- `pendingUpserts` contains accepted values not durable yet;
- `pendingDeletes` contains accepted removals not durable yet;
- `pendingBaselines` says the old durable directory baseline must not leak into a replacement baseline.

Do not add a second cache representation.

For a requested key, a pending delete hides the stored row and a matching pending upsert replaces it. During a pending directory baseline replacement, old non-timeline directory rows are ignored and the pending baseline rows become the visible directory. Timelines remain independent, matching the existing baseline-replacement contract.

Only materialize pending upserts that match the requested host, kind, and optional id. Reading agent A must not serialize a pending timeline for agent B.

### Keep a host lifetime generation

The current host revision mixes two unrelated jobs:

- ordinary cache data changed;
- the identity/lifetime of the host changed.

Only the second job needs a generation barrier.

Keep a small per-host generation and advance it only when host lifetime changes, such as:

- host added;
- host removed;
- `reconcileServerId()`.

Capture the generation when the read is requested, before it waits on the store queue. Re-check it before returning. A read started under an old activation must stay invalid even if the same `serverId` is removed and then re-added before the storage operation completes.

Normal agent, workspace, project, checkpoint, and timeline commits must not advance this generation.

### Keep one store-operation queue

Do not let a read race through the gap between draining pending changes and finishing their storage transaction.

A read may wait for a storage operation that was already in flight when the read was requested. It must not start a persist itself.

Reuse the existing sequencing mechanism. Rename/generalize it only as much as needed to make the ownership clear. Do not introduce a queue class, scheduler, per-host queue, or new service layer.

### Keep live-vs-cache reconciliation in the existing owners

Directory and timeline owners already reject or merge late cached state against newer live state. Do not move that logic into `ReplicaCache`.

`ReplicaCache` owns one thing here: return a coherent logical cache snapshot for the requested rows.

## Invariants

The implementation is correct when all five rules hold:

1. A cache read never causes a cache write.
2. One logical cache read performs at most one `rowStore.read()`.
3. Pending changes to requested rows beat older durable rows.
4. Changes to unrelated rows do not invalidate or restart a read.
5. Removing, re-adding, or renaming a host invalidates reads from the previous host lifetime.

## Rejected approaches

### Finer host, kind, or row revisions

Do not keep the current `flush -> read -> revision check -> retry` algorithm and make its revision key more precise.

That would still make reads force persistence, still leave same-row reads able to starve, and add another bookkeeping structure despite pending changes already being keyed by row.

### Raw one-pass durable reads

Do not return `rowStore.read()` directly. A durable row can already have a newer accepted pending replacement or deletion. Returning the old durable row can resurrect stale state.

### Cache miss whenever requested data is pending

This is safe but unnecessarily discards useful cache state and becomes awkward for directory reads. Use it only if maintainers explicitly reject in-process reads of accepted-but-not-yet-durable cache values.

### Broad persistence retry work

Do not fold persistence backoff, logging, IndexedDB recovery, poisoned initialization promises, or circuit-breaker behavior into this change. Those are separate failure-policy work and make #4813 harder to reason about.

### Per-host queues

The existing shared queue can make one host wait behind another host's store operation, but that is separate from read-triggered persistence and retry starvation. Measure it after this fix rather than expanding this patch.

## Ordered tasks

1. [Make replica-cache reads one-pass logical reads](../tasks/replica-cache-01-one-pass-reads.md)
2. [Prove the read contract on real storage and the browser path](../tasks/replica-cache-02-real-store-validation.md)

Task 02 depends on Task 01.

## Done

This plan is complete when:

- `readRows()` has no retry loop and never calls `flush()`, `persist()`, or `syncPending()`;
- opening agent A while agent B streams performs one durable read for A and zero read-triggered writes;
- same-row pending replacements and deletes are reflected without forcing persistence;
- pending directory baseline replacement remains coherent;
- remove -> re-add of the same server id cannot admit a read from the old host activation;
- focused in-memory, real SQLite, and browser performance checks pass;
- `docs/data-model.md` states the durable read contract without restating implementation details;
- no persistence failure-policy, protocol, or unrelated queue redesign is included.
