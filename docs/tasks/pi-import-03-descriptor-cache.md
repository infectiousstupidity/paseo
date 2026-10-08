# Pi import 03: Reuse unchanged descriptors

## Outcome

Changing search text, paging, or reopening the import sheet does not repeatedly parse the same unchanged Pi transcripts within one running Paseo daemon.

## Context

Tasks 01–02 reduce the work required for one cold listing. React Query already caches an identical client query, but **different search text, page limits and scopes** produce different keys and can still repeat Pi filesystem/parsing work.

This task is conditional: measure after Task 02. If the remaining repeat-read cost is negligible, record that result and skip the cache rather than adding unnecessary state.

## Implement

1. Add the smallest **in-process, bounded** descriptor reuse to the Pi listing implementation; key entries by resolved session file path plus file `mtime` and `size`. Reparse when metadata changes. Keep this Pi-specific and avoid a second persistent representation of sessions.
2. Ensure discovery sees created/deleted sessions within an appropriate short freshness window and that the sheet's explicit **Refresh** does not knowingly return stale results. Check the existing RPC/query invalidation path first; if a refresh hint is needed, keep it narrowly scoped and backward-compatible.
3. Handle session growth, file replacement, missing files, different configured Pi session roots, and process restart without exposing stale import handles. Evict old entries with a simple maximum size / short TTL if necessary; avoid background timers or file watchers.
4. Cache display descriptors only. The import/resume path must continue to read the **current** file when extracting model/thinking configuration. Never persist previews or full transcripts to a database.
5. Do not add caching if measured workload is dominated by directory enumeration that would remain unchanged; document the decision instead.

## Acceptance

- A changed in-place session is reflected on a subsequent listing, and a deleted one disappears after revalidation.
- Repeated search and paging requests on unchanged sessions reuse already-parsed metadata when caching is enabled.
- Cached results are isolated by session path/root and remain correct across different cwd scopes.
- Manual refresh and new sessions work as expected; model/thinking import config is never stale.
- Memory use is bounded; no watchers, background indexer, SQLite, extra service, or unnecessary cache tiers.

## Focused verification

- A temporary-file fixture: list, change a JSONL file, list again, remove it, list again. If a freshness TTL is used, test it with a controlled clock, not sleeps.
- Check warm-request parse/read counts and memory size; do not hardcode millisecond thresholds.
- Run the Pi descriptor test file, `npm run typecheck`, and applicable formatting checks.

## Files and dependencies

- [Pi descriptor](../../packages/server/src/server/agent/providers/pi/session-descriptor.ts)
- [Import sheet](../../packages/app/src/components/import-session-sheet.tsx)
- [Task 02](./pi-import-02-discovery-io.md)
- [Overview](../plans/pi-import-session-performance.md)

Depends on Task 02; skip implementation only if measurements justify doing so.
