# Upstream sync 03: restore barrier-free replica cache reads

Status: **Done — implemented in `f8d30c62d`, on top of the merge `69359e8cb`.** [Upstream sync 02](upstream-sync-02-replica-cache-take-upstream.md) is also complete. Design reference: [Replica cache one-pass reads](../plans/replica-cache-read-path.md).

At the 2026-10-19 refresh, upstream `23e388b05..9a0b95aa1` changes no replica-cache file, and the dry-run merge carries this task's delta without conflict. Do not re-land the patch or take upstream's cache over it. This work stays fork-only; no upstream PR is planned.

## Outcome

On top of upstream's replica cache, a valid cache read never persists pending state, and rows accepted in memory but not yet durable answer the read for the requested keys. Corrupt-row repair remains a separate pre-existing write path. Host-lifetime invalidation and upstream's persist backoff stay.

## Evidence

Upstream's `readRows()` (`packages/app/src/runtime/replica-cache/index.ts:1012-1045` on `upstream/main`) still begins with:

```ts
if (!(await this.syncPending()) && this.hasPendingHostChanges(serverId)) return [];
```

`syncPending()` → `persist()` → `drainPendingChanges()` → `rowStore.apply()`. During streaming there is always a pending batch, so opening agent A still serializes agent B's accepted-but-not-yet-durable rows. The fork's `0014432e6` removed that call and answered from memory instead.

Upstream's merged code is narrower than its PR description, which claims "A read never forces a persist" and "After: 1 read, 0 persists" (getpaseo/paseo#4813). Its tests assert the narrower result: "reads another cached agent/workspace/timeline without waiting for the stream to stop" (`index.test.ts:1048-1072`).

Upstream did solve the invalidation half, and better than the fork's plan proposed. `activeReads` plus `invalidateHostReads()` already covers host remove, re-add, and `reconcileServerId()` (`index.ts:1190, 1202-1203`), tested at `index.test.ts:606` and `:625`. The fork's `hostGenerations` map is therefore **not** worth re-landing.

## Original implementation plan

This is historical context, not work still to execute. The deviations below describe the implemented contract.

Keep upstream's structure; change one call and add one overlay.

1. In `readRows()`, drop the `syncPending()` line. Keep the `ReplicaRead` registration, the `read.invalidated` checks, and `hasPendingReadChanges(read)`.
2. After `rowStore.read(...)`, overlay pending state for the requested `serverId`/`kinds`/`ids`, reusing the existing `matchesReplicaRead()`:
   - a pending delete hides its durable row;
   - a pending upsert replaces or adds the row;
   - when `pendingBaselines` has the host, old durable non-timeline directory rows are hidden and the pending baseline rows become the visible directory; timelines stay independent.
3. Materialize only pending upserts matching the request. Reading agent A must not serialize agent B's timeline.
4. Keep upstream's persist backoff, budget fitting, corrupt-row repair, and eviction untouched.
5. Re-add the fork's counting tests from `0014432e6`: "reads once without persisting an unrelated pending change", "overlays an accepted deletion without persisting it during a read", "overlays a pending upsert without persisting it during a read", "overlays a same-row change accepted while storage is reading", "reads a pending directory baseline without hiding independent timelines".
6. Change upstream's "fails closed when an accepted deletion cannot be persisted before a read" (`index.test.ts:566`) to the overlay expectation. That test asserts the contract this Task removes: with the overlay, an accepted deletion hides the durable row whether or not it persisted, so the fail-closed branch is no longer needed.

## Review

- **Keep the fork delta through future merges.** The fork-only decision is settled. Compare against the last integrated upstream commit, not an empty-diff requirement that would erase the overlay. An unchanged upstream cache needs no manual reapplication.
- **Do not re-land `hostGenerations`.** Upstream's `activeReads` invalidation covers the same invariant with tests already in place. Re-adding a second invalidation net is the failure mode the fork's own plan warns about.
- Confirm no caller relies on a read forcing a flush. `flush()` remains the explicit way to persist.

## Verification (historical implementation runs)

These results predate the task-doc refresh; no full suite was re-run for it. Run future focused checks from `packages/app` (a root-level `vitest src/...` filter loads no app projects and dies with `SyntaxError: Unexpected token 'typeof'`). Task 02 landed in the merge `69359e8cb`; this task is `f8d30c62d`, cherry-picked onto it. The earlier merge `553430f40` (branch `sync-backup-2026-10`) staged the payload onto the fork's tree and is not an ancestor of `main`.

- `npx vitest run src/runtime/replica-cache` → **4 files, 71 tests passed** (45 in `index.test.ts`, up from 42).
- Counting evidence, no sleeps: the streaming cluster (`while another agent streams timeline|directory updates`) asserts exact store counts — `readAgent` 1 read / 0 writes, `readTimeline` 1 read / 0 writes, `readWorkspace` 2 reads / 0 writes (it reads the workspace row then the project row by construction), with the stream producing one chunk per read. The five ported counting tests assert 1 read + 0 writes for an accepted delete, an accepted upsert, an unrelated pending change (`textReads === 0` proves the unrelated timeline is never materialized), a same-row accept in flight, and a pending baseline that keeps timelines.
- `npx tsgo --noEmit` (app): clean. `npx oxlint packages/app/src/runtime/replica-cache` from the repo root: 0 warnings, 0 errors (from `packages/app` it errors on `options.typeAware` in the root `.oxlintrc.json` — run oxlint from the root). `npx oxfmt --check`: clean.
- Full app suite: 6066 passed, 7 skipped, 3 test failures in 5 files, all machine-environment: two Markdown image tests (Windows temp path `\\C:\Users\...\My Apps\Мои\test.png`), `parse-changelog` date locale (`8 September 2026` vs `September 8, 2026`), `input-draft.live` (IndexedDB unavailable, hook timeout), `git/forges` (`ENOENT 'D:\D:\DEVELOPMENT\...'` path join). Each of those five files imports zero `replica-cache` modules, so none is reachable from this change.
- Re-run on the real merge (`69359e8cb` + this commit) after `npm install`: focused replica-cache **10 files, 226 tests passed**; focused five-directory run 55 files, 734 tests; full app suite 643 files, 6090 tests with the same five machine-environment files failing, each of which fails identically at the fork tip `b5f8b46ea` and at upstream `23e388b05`.

## Deviations from the implementation section

- **`hasPendingReadChanges()` and `invalidateRowReads()` are removed**, not kept. With the overlay in place an accepted row is already reflected in the answer, so a same-row accept that marks the read invalid forces a second `rowStore.read()` — which the acceptance criteria forbid. `read.invalidated` now fires only on host-level events (`setHosts`, `reconcileServerId`) and on a directory baseline replacement, and the read's key matching uses `matchesReplicaRead()` as the constraints require. `queueUpsert`/`queueDelete` no longer touch active reads.
- **A store write is still reachable from a read path**, in one pre-existing case: `deleteInvalidRow()` repairs a row whose payload fails schema validation. It never drains pending state, and the acceptance criterion (one `read()` and zero `apply()` for a valid read) holds.
- **Streaming test retune:** `reads another cached workspace without waiting for the stream to stop` was `expectReads(2, 1)` — the second read and the write were the read-side persist. It is now `expectReads(2)`: two reads (workspace row, project row), zero writes.
- **Ported/renamed upstream tests:** `fails closed when an accepted deletion cannot be persisted before a read` → `overlays an accepted deletion without persisting it during a read` (1 read, 0 writes); `does not return an accepted agent that storage rejected` → `returns an accepted agent from memory when storage rejects its write`; `retries a timeline read when that same timeline changes in flight` → `overlays a same-row change accepted while storage is reading` (1 read, not 2); `reads the directory after persisting a pending baseline replacement` → `reads the directory from a pending baseline replacement without persisting it` (`storage.writes` 2 → 1). `gives up a read instead of retrying while the store keeps rejecting writes` needed no change: its assertions (`undefined`, reads ≤ 1) now hold through the overlay.
- `hasPendingHostChanges()` is removed with the read-side gate; `flush()` is the only explicit persist entry point left in the read path's neighbourhood.

## Upstreaming decision

Fork-only. No PR to `getpaseo/paseo` is planned. Preserve the overlay in the fork; revisit it only when upstream changes the same code or supplies equivalent behavior.

## Acceptance

- During a 200-commit stream on agent B, one `readAgent(A)` performs exactly one `rowStore.read()` and zero `rowStore.apply()` calls.
- A pending upsert or delete for a requested row wins over the older durable row without a write.
- A same-row change accepted while the storage read is in flight is reflected in the result without a second read.
- A pending directory baseline returns the replacement directory and preserves independent timeline rows.
- Host removal, re-add, and `reconcileServerId()` still discard an in-flight read.
- Upstream's persist backoff, eviction, and corrupt-row tests stay green.

## Focused checks

```bash
(cd packages/app && npx vitest run src/runtime/replica-cache/index.test.ts --bail=1)
(cd packages/app && npx vitest run src/timeline/replica.test.ts src/runtime/directory-sync/index.test.ts --bail=1)
npm run typecheck
npm run lint -- packages/app/src/runtime/replica-cache/index.ts packages/app/src/runtime/replica-cache/index.test.ts
npm run format:check
```

Counting assertions, not sleeps.

## Constraints

- No per-row or per-kind revision map, no `hostGenerations`.
- No new queue, scheduler, or cache class; reuse `writeQueue` and `matchesReplicaRead`.
- No row-store schema or protocol change.
- No persistence failure-policy change.
- Do not weaken directory or timeline owner guards that decide whether a late cached read may enter live UI state.

## Required context

- [Replica cache one-pass reads](../plans/replica-cache-read-path.md)
- [Upstream sync 02](../tasks/upstream-sync-02-replica-cache-take-upstream.md)
- [Data model](../data-model.md)
- [Testing rules](../testing.md)
- [Replica cache](../../packages/app/src/runtime/replica-cache/index.ts)
