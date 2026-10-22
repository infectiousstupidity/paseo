# Pi import-session listing performance

Status: **partially implemented**. Tasks 01 (scoped prefilter), 02 (bounded discovery/stat I/O), and 04 (search/request efficiency) have landed in this fork with targeted regression tests. Task 03 (descriptor cache) remains conditional. Actual latency/work counts on the user's Windows Pi-session directory have **not** been profiled. Keep this a measured Pi-only lane; do not reimplement completed slices.

## Problem and ownership

Clicking **Import session** can make Paseo perform filesystem work across Pi's entire session history before showing 15 results. The work is in Paseo, not Pi.

Current implementation path (after Tasks 01, 02 and 04):

1. `packages/app/src/components/import-session-sheet.tsx` requests the selected provider(s), not every provider when Pi alone is selected.
2. `packages/server/src/server/agent/import-sessions.ts` counts only scoped imported handles for scoped overfetch. Pi search has a separate matching-result budget; other providers retain existing behavior.
3. `packages/server/src/server/agent/agent-manager.ts` delegates Pi search into descriptor scanning; other-provider search still uses manager-side enumeration.
4. `packages/server/src/server/agent/providers/pi/session-descriptor.ts` still discovers/stats/sorts JSONL history; directory and stat I/O are bounded, and scoped `cwd` rejects unrelated sessions after their header read but before tail parsing. Matching candidates are still parsed serially.
5. `packages/server/src/utils/path.ts` retains realpath-aware matching, with a per-listing cwd comparison memo in the Pi descriptor reader. An unchanged-descriptor cache (optional Task 03) is not implemented.

The default client query is cached by React Query; a repeat open with the same key may already be fast. Measure cold open, changed scope, search, pagination, and refresh separately. A daemon-side cache can help across *different* query keys.

## Implementation order

| Order | Task | Outcome |
| --- | --- | --- |
| 1 | [01 — Filter scoped sessions before tail parsing](../tasks/pi-import-01-scope-prefilter.md) | **Implemented** |
| 2 | [02 — Reduce directory and metadata I/O](../tasks/pi-import-02-discovery-io.md) | **Implemented** |
| 3 | [03 — Reuse unchanged descriptors](../tasks/pi-import-03-descriptor-cache.md) | **Optional, only if measured repeat-read cost justifies it** |
| 4 | [04 — Fix search, overfetch, and client query work](../tasks/pi-import-04-request-efficiency.md) | **Implemented**, CI and real-workload timing acceptance outstanding |

Tasks 01, 02 and 04 are already in code; profile that baseline before considering optional Task 03. Do not rerun completed work or assume unmeasured speedups. Session **identification UX** is planned separately in [05–06](./pi-import-session-identification.md), without making descriptor caching a prerequisite.

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
