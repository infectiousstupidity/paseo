# Pi import-session listing performance

Status: scoped support-lane work, **not implemented**. Reviewed against this fork on 2026-10-08. The code paths below are verified, but the user's actual Pi-session-directory latency and work counts have **not** been profiled. Reproduce and measure the Pi-only workflow before selecting a slice; do not turn this into a general Paseo performance or refactoring program while Shiori's real execution reliability is the priority.

## Problem and ownership

Clicking **Import session** can make Paseo perform filesystem work across Pi's entire session history before showing 15 results. The work is in Paseo, not Pi.

Current path:

1. `packages/app/src/components/import-session-sheet.tsx` requests 15 entries per enabled provider.
2. `packages/server/src/server/agent/import-sessions.ts` requests `limit + importedSessions.count` entries (or 500 on search).
3. `packages/server/src/server/agent/agent-manager.ts` delegates to Pi and applies text search **after** provider enumeration.
4. `packages/server/src/server/agent/providers/pi/session-descriptor.ts` recursively discovers all JSONL files, stats all files, sorts by mtime, then opens/parses head and tail **sequentially**. Scoped `cwd` is checked after parsing the entire descriptor. For scoped non-search requests it can traverse past the 400-file overscan to find an older relevant session.
5. `packages/server/src/utils/path.ts` realpath-aware matching may synchronously resolve paths for many candidates.

The default client query is cached by React Query; a repeat open with the same key may already be fast. Measure cold open, changed scope, search, pagination, and refresh separately. A daemon-side cache can help across *different* query keys.

## Implementation order

| Order | Task | Outcome |
| --- | --- | --- |
| 1 | [01 — Filter scoped sessions before tail parsing](../tasks/pi-import-01-scope-prefilter.md) | Skip irrelevant session payloads and repeated cwd resolution |
| 2 | [02 — Reduce directory and metadata I/O](../tasks/pi-import-02-discovery-io.md) | Fewer filesystem calls and bounded concurrency |
| 3 | [03 — Reuse unchanged descriptors](../tasks/pi-import-03-descriptor-cache.md) | Fast repeat scans and searches without a database |
| 4 | [04 — Fix search, overfetch, and client query work](../tasks/pi-import-04-request-efficiency.md) | Avoid unnecessary provider requests and pathological 500-entry scans |

Do tasks **sequentially**, because each changes the work and correctness assumptions of the next. If 01–02 already meet the real workload's needs, validate whether 03 is worth its maintenance cost before implementing it.

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
