# Pi import-session listing performance

Status: **partially implemented**. Task 04 (Pi search/scoped import requests) landed in this fork on 2026-10-08; its focused CI and real-user-corpus timing acceptance remain to be confirmed. Tasks 01–03 are still proposals. The user's Pi-session-directory latency/work counts have **not** been profiled. Keep this a measured Pi-only support lane rather than general Paseo performance work.

## Problem and ownership

Clicking **Import session** can make Paseo perform filesystem work across Pi's entire session history before showing 15 results. The work is in Paseo, not Pi.

Current implementation path (after Task 04):

1. `packages/app/src/components/import-session-sheet.tsx` requests the selected provider(s), not every provider when Pi alone is selected.
2. `packages/server/src/server/agent/import-sessions.ts` counts only scoped imported handles for scoped overfetch. Pi search has a separate matching-result budget; other providers retain existing behavior.
3. `packages/server/src/server/agent/agent-manager.ts` delegates Pi search into descriptor scanning; other-provider search still uses manager-side enumeration.
4. `packages/server/src/server/agent/providers/pi/session-descriptor.ts` still discovers/stats/sorts JSONL history and can parse expensive head/tail metadata sequentially. Scoped `cwd` filtering before tail parsing (Task 01) and lower discovery I/O (Task 02) remain proposed.
5. `packages/server/src/utils/path.ts` retains realpath-aware matching. A per-request cwd memo (Task 01) and an unchanged-descriptor cache (optional Task 03) are not claimed implemented.

The default client query is cached by React Query; a repeat open with the same key may already be fast. Measure cold open, changed scope, search, pagination, and refresh separately. A daemon-side cache can help across *different* query keys.

## Implementation order

| Order | Task | Outcome |
| --- | --- | --- |
| 1 | [01 — Filter scoped sessions before tail parsing](../tasks/pi-import-01-scope-prefilter.md) | Skip irrelevant session payloads and repeated cwd resolution |
| 2 | [02 — Reduce directory and metadata I/O](../tasks/pi-import-02-discovery-io.md) | Fewer filesystem calls and bounded concurrency |
| 3 | [03 — Reuse unchanged descriptors](../tasks/pi-import-03-descriptor-cache.md) | Fast repeat scans and searches without a database |
| 4 | [04 — Fix search, overfetch, and client query work](../tasks/pi-import-04-request-efficiency.md) | **Implemented**, CI and real-workload timing acceptance outstanding |

Task 04 was implemented independently of the proposed 01–02 sequence. For remaining work, profile the current Task-04 baseline first; implement 01, then 02 only if needed. Task 03 caching is optional and requires evidence that repeated reads remain costly. Do not rerun Task 04 or assume unmeasured speedups.

## Invariants

- Pi session files are read-only to this feature. Do not modify the Pi repository or Pi's session format.
- Keep correct results for default and custom session directories, old sessions behind many newer sessions, Windows paths, symlinks/junctions, and nested JSONL transcripts that Pi actually exposes as importable sessions.
- Keep model and thinking-mode restoration through `readPiImportSessionConfig`; a listing optimization must not compromise resume.
- Maintain visible title, prompt previews, last activity, import exclusion, scope, and search semantics.
- Never quietly turn a large scan into an empty result or hide older matches solely because they sit beyond an internal overscan bound.
- No SQLite index, background crawler, watcher service, new generic filesystem abstraction, or protocol redesign unless measurements show a simpler approach cannot work.

## Verification strategy

Use the existing temporary-filesystem Pi descriptor tests, plus one representative synthetic corpus containing many unrelated newer sessions, older matching sessions, nested paths, and large JSONL transcripts. Measure **elapsed time and work counts** (discovered files, stats, head reads, tail reads, cache hits) where instrumentation is straightforward.

Compare cold workspace listing, host-wide listing, warm reopening with a different query key, a rare search, and explicit refresh on the actual Windows Pi directory when available. Report the environment, corpus size, baseline, and after values. No invented speedup target or flaky wall-clock unit assertions.

Each slice runs only its relevant focused tests, `npm run typecheck`, and the repository's applicable format/lint checks. No full test suite merely for documentation or this focused optimization.
