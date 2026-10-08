# Pi import 02: Reduce directory and metadata I/O

Status: implemented in Paseo. Focused regression coverage added. Runtime measurements
on the user's actual Windows Pi history have not been collected.

## Implementation notes

- The default Pi project directory is an encoded working directory, but **the header cwd
  remains authoritative**. Moved, imported, nested, aliased, or custom-root sessions can
  live outside the directory suggested by their cwd. Directory pruning would silently
  omit valid imports, so this slice keeps full discovery; it only bounds the I/O.
- Directory enumerations run at most 16 concurrently; file stats at most 32 concurrently.
- Ranked file metadata now includes size and modification time. A selected descriptor
  reuses it when reading its tail and computing its fallback activity timestamp, instead
  of statting the file again. Independent import/resume config reads remain unchanged.
- Candidate descriptor reads remain serial and ranked. The optional concurrent read
  change was deliberately omitted because no representative benchmark demonstrates
  that its complexity would help. Caching/search improvements remain Tasks 03–04.
- Tests cover a file stored under a misleading project folder, nested sessions, custom
  roots and environment overrides, unscoped results, fallback timestamps, bounded
  concurrent scans, and one-stat-per-file behavior. These are correctness/work-count
  assertions, not elapsed-time performance claims.

## Outcome

A Pi listing does not overwhelm the filesystem with unbounded stats or repeat the same stat for each parsed candidate. It discovers only the directories necessary where Pi's **actual** storage layout provides a safe scoped shortcut.

## Cause

`walkJsonlFiles` recursively walks the root. `rankSessionFilesByMtime` runs `stat` for every discovered JSONL file using an unbounded `Promise.all`. Reading a selected descriptor then stats the file again to locate its tail, and may stat again for a timestamp fallback. Head/tail metadata processing in the main listing loop is serial.

## Implement

1. Inspect the Pi version/source used by Paseo and the actual session directory layout before deriving any workspace-to-folder mapping. If project folders map reliably to `cwd` for the default root, prefer those folders for scoped listing; preserve complete discovery for custom roots, legacy layouts, nested importable sessions, and ambiguous mappings. Never silently drop results to gain speed.
2. Change the ranked-file record to retain the file metadata already obtained (at least mtime and size). Pass it through the listing read path so reading a tail doesn't stat the same unchanged file again. Keep `readPiImportSessionConfig(filePath)` correct when called independently.
3. Bound directory traversal and file-stat concurrency. Avoid scheduling thousands of simultaneous I/O operations. Keep concurrency modest and local; don't introduce a general-purpose work scheduler.
4. Read candidate metadata with a **small bounded concurrency** if profiling demonstrates a gain over the current serial loop. Consume results in ranked order and stop after the requested count; do not let whichever promise resolves first determine which sessions appear.
5. Keep an exact fallback path for scoped old sessions when directory-based narrowing cannot be proven safe. Do not replace correct discovery with a global `slice(0, 400)`.

## Acceptance

- No duplicate `stat` on a selected file during one listing when ranked metadata remains usable.
- Listing a large history does not create an unbounded simultaneous stat/read burst.
- Default-root scoped results match the previous full-scan behavior on fixtures covering multiple projects, old matches behind newer sessions, nested JSONL, and aliases.
- Host-wide, custom `sessionDir`, environment/settings overrides, deleted files during discovery, and malformed JSONL retain graceful current behavior.
- `lastActivityAt` sorting and import resume remain correct.

## Focused verification

- Extend `packages/server/src/server/agent/providers/pi/session-descriptor.test.ts` with a multi-project temporary directory. Exercise both scoped and unscoped listing, and custom root. Avoid relying on elapsed-time assertions for correctness.
- Compare actual file count, stats, head/tail reads, and cold timings before/after on the same history. If a proposed shortcut cannot be verified against Pi source and fixtures, **omit it** and implement the safe metadata/concurrency wins only.
- Run the Pi descriptor test file, `npm run typecheck`, and applicable formatting checks.

## Files and dependencies

- [Pi descriptor](../../packages/server/src/server/agent/providers/pi/session-descriptor.ts)
- [Pi descriptor tests](../../packages/server/src/server/agent/providers/pi/session-descriptor.test.ts)
- [Task 01](./pi-import-01-scope-prefilter.md)
- [Overview](../plans/pi-import-session-performance.md)

Depends on Task 01. No watcher, database, protocol change, or separate indexing worker.
