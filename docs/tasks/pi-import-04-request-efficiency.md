# Pi import 04: Make search, overfetch, and client requests efficient

Status: implemented in Paseo, subject to focused CI validation. Task 03 caching is not required.

## Implementation notes

- Scoped import overfetch counts only active imported sessions belonging to the
  requested working directory. Imported handles from other directories remain
  excluded when returned, but no longer inflate the requested page size.
- For search, other providers retain their existing 500-candidate manager-side
  behavior. Pi receives its own matching-result limit (page limit plus Pi imports
  in scope) and searches title, first/last prompt preview, and cwd basename
  **during** descriptor scanning.
- Pi search inspects ranked candidates until it finds enough matching results or
  exhausts the history; the old 500-candidate cutoff is not used for Pi search.
  This preserves older matches instead of misleadingly reporting none. Rare
  uncached searches can still be slow; use Task 03 only if real measurements
  show that repeated reads remain a significant cost.
- The selected provider determines which daemon queries are active. **All**
  still fetches enabled providers and reports their individual errors.
- React Query keys now include `serverId`; Refresh, retry, and post-import
  invalidation target the corresponding host and directory.
- No new dependencies, database, background crawler, or protocol changes.

## Outcome

Opening or searching **Import session** asks for only the useful sessions/providers, returns relevant older Pi sessions reliably, and doesn't repeat expensive work due to unrelated imported history.

## Cause

- `import-sessions.ts` requests `limit + importedSessions.count` sessions even when imported handles are from another cwd. Search requests 500 candidates unconditionally.
- `agent-manager.ts` applies the text query **after** asking the provider for its list.
- Pi's `scanLimit: 500` can drop a valid older cwd match; without a scoped filter, a rare search can parse hundreds of files and still return nothing.
- `import-session-sheet.tsx` requests all enabled providers even when one provider is selected. Its query key omits `serverId`; two hosts with the same cwd/query/limit/provider could share cached rows incorrectly.

## Implement

1. Avoid basing the listing scan budget solely on the total count of imported sessions. Use the known imported-handle set and scope to seek enough **non-imported, relevant** Pi results without forcing unbounded work per imported session. Preserve filtered-count and deduplication behavior the UI uses.
2. Make Pi search select matches **as it scans** using the existing title/first-prompt/last-prompt/cwd-basename rules, rather than collecting 500 entries and then filtering them in `agent-manager.ts`. Keep other providers' query behavior unchanged.
3. Revisit the hard 500-file search cap with explicit tests for an older matching session behind 500 newer unrelated sessions. Either find it reliably or expose a deliberate, user-visible scan limit; do **not** silently claim there are no matches. Avoid a synchronous full deep scan on every keystroke. Reuse Task 03's descriptor cache if it was justified; otherwise keep this bounded and incremental.
4. When the user chooses Pi in the provider filter, request Pi only. The **All** choice still requests all enabled providers and shows provider-specific errors; preserve pagination, changing scope, and switching providers.
5. Include `serverId` in session React Query keys and all matching invalidation/refetch keys so different hosts never share import rows. Check the current import-success and explicit Refresh invalidation paths.
6. Prefer existing React Query deduplication and current APIs. Do not create a polling loop, second client state store, or cancellation protocol solely to cover a timeout without reproduction.

## Acceptance

- Scoped request with many imported sessions from other directories does not scale Pi descriptor parsing with their count.
- Search matches title, previews, and cwd basename, including an old session beyond the former 500-file window; missing/partial results are not silently represented as an exhaustive search.
- Selecting **Pi** issues no non-Pi listing RPCs; **All** still works and reports provider errors correctly.
- Two daemon hosts with identical cwd strings do not share cache results. Refresh and import-success flows show the current list.
- Existing paging limits (15, 45, 90, 200), import exclusion, query debouncing, error handling and protocol compatibility remain intact.

## Focused verification

- Add only relevant cases to `packages/server/src/server/agent/import-sessions.test.ts` and `packages/server/src/server/agent/providers/pi/session-descriptor.test.ts`; use real temporary JSONL files for Pi scanning.
- Extend `packages/app/src/components/import-session-sheet.test.tsx` or its view-model tests for provider selection, host key isolation and refresh. Assert RPC calls and returned results, not wall-clock time.
- Run those targeted tests, `npm run typecheck`, and applicable formatting checks. Finally capture cold/warm/search timings on the same representative Pi corpus used for Task 01.

## Files and dependencies

- [Import request processing](../../packages/server/src/server/agent/import-sessions.ts)
- [Provider delegation](../../packages/server/src/server/agent/agent-manager.ts)
- [Pi descriptor](../../packages/server/src/server/agent/providers/pi/session-descriptor.ts)
- [Import sheet](../../packages/app/src/components/import-session-sheet.tsx)
- [Import view model](../../packages/app/src/components/import-session-sheet-view-model.ts)
- [Task 03](./pi-import-03-descriptor-cache.md)
- [Overview](../plans/pi-import-session-performance.md)

Depends on Tasks 01–02. Task 03 is optional if its performance measurement does not justify caching. Do not broaden these Pi-specific fixes into a provider-wide API redesign.
