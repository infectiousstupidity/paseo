# PASEO-01 — Final Pi usage must be complete at turn completion

**Priority:** P1  
**Status:** Planned  
**Owner:** Paseo (Pi provider/daemon and client usage contract)  
**Related Shiori task:** [EFF-03 prospective telemetry](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/tasks/harness-efficiency-03-prospective-telemetry.md)  
**Tracking plan:** [Shiori harness follow-ups](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/tasks/harness-followups-20261016.md)

## Outcome

When Paseo reports a Pi turn as completed, the reported cumulative usage for that completed turn must include its final model response (and other supported usage), or explicitly signal that usage is incomplete. Subscribers must not mistake stale `lastUsage` for settled final accounting. The fix belongs at the Paseo provider/daemon boundary; Shiori's verified Pi JSONL correction is a bounded downstream safeguard, not a substitute for a correct source contract.

## Verified context and limits

In the October 15 [Shiori efficiency investigation](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/harness/EFFICIENCY-FINDINGS.md), 104/145 historical verified invocations showed stored usage matching an earlier Pi response prefix. The report identifies a likely timing defect: Pi `completeTurn` starts asynchronous final usage collection, while completion can be emitted before the snapshot settles. In 100 of 105 usage disagreements, one trailing assistant response explained the gap; four missed two or three responses. One historical overcount remains unexplained and must not be attributed to the same cause. Reproduce against **current Paseo HEAD** before changing behavior.

The same report distinguishes provider/Paseo session-wide cumulative usage from verified Pi assistant-only message usage and full-session ledger usage. Shiori's prospective byte-zero ledger reconciliation does not justify retroactively correcting historical records or changing billing claims.

## Investigation and implementation

1. Find the current Pi provider's `completeTurn`, `lastUsage`, final assistant response processing, usage collection, daemon event emission and client subscription APIs. Map ordering for ordinary turn completion, cancellation, partial/failed provider returns, compaction/extension usage, session resume and reconnect.
2. Write a deterministic reproducer in which the final response arrives after a usage refresh begins, and inspect whether subscribers receive completion with the prior cumulative total. Distinguish final assistant-only accounting from total Pi session usage and per-turn delta.
3. Define one consistent completion/usage barrier: either await a bounded final usage snapshot before publishing the complete event or publish an explicit subsequent final usage revision with settled/partial semantics. Choose the smallest solution compatible with existing clients. Do not introduce an unbounded await that can freeze terminal lifecycle events or mask errors.
4. Ensure usage is monotonic where the underlying semantics require it, idempotent across callback replay/reconnection, and correctly scoped for resumed sessions. Avoid double counting provider reasoning, cache reads/writes or tool/extension events. Preserve `unknown` rather than converting it to zero when fields are unavailable.
5. Add focused tests covering trailing response arriving late, no final usage, thrown/timed-out usage read, cancelled turn, duplicate/reordered callback, session resume, multiple turns, provider disconnect and other provider implementations sharing the event contract.
6. Document exactly when usage is considered final, when it is partial, and how subscribers can distinguish those states. Coordinate with Shiori's read-only prospective telemetry test; do not copy Pi JSONL parsing logic into a second consumer as a workaround.

## Acceptance

- For a deterministic two-response fixture, the turn's final observable usage includes the last response exactly once, or a clearly flagged incomplete snapshot is eventually reconciled by a defined terminal update.
- Turn completion cannot hang indefinitely on telemetry; failures remain visible and never silently claim completeness.
- Resume/reconnect and duplicate callbacks do not overcount; cached and reasoning tokens retain original provider semantics.
- Existing agent lifecycle, other providers and UI subscribers keep working; focused tests and the repository's canonical checks pass.

## Constraints

No production daemon restart, live agent interruption, Shiori historical DB rewrites or paid provider calls without explicit permission. This is an implementation task document, not deployment authorization. If current Paseo HEAD already satisfies the contract, document the test evidence and close the task without a redundant change.
