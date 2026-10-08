# Pi import 01: Filter scoped sessions before tail parsing

## Outcome

Opening **Import session** inside a workspace stops parsing the expensive JSONL tail/head metadata of every newer session from unrelated working directories. Existing sessions from that workspace, including old ones beyond the 400-candidate window, remain discoverable.

## Cause

In `packages/server/src/server/agent/providers/pi/session-descriptor.ts`, the listing loop calls `readPiImportableSession(file)` before checking `matchesCwd(session.cwd)`. That reads the head, stats/reads the tail (up to 256 KiB), parses the metadata, and may stat again for last activity **even for an unrelated cwd**. `createRealpathAwarePathMatcher` also resolves candidate paths synchronously on repeated comparisons.

## Implement

1. Split the existing listing read path so it obtains and validates the Pi session header (`type: "session"`, `cwd`) before doing any tail parsing. Reuse the bytes already read for the matching session; do **not** add a second head read for matches. Keep the full descriptor read for `readPiImportSessionConfig` unchanged.
2. For scoped listings, compare header `cwd` first, skip nonmatches, and only then parse remaining head metadata and tail. Preserve the current fallback for malformed/missing header and its `lastActivityAt` behavior.
3. Reuse cwd comparison results by **candidate cwd string** within a request, rather than repeatedly calling filesystem realpath functions for thousands of files with the same cwd. Keep correct symlink/junction equivalence; don't replace realpath-aware matching with raw equality.
4. Leave unscoped listing, search and request limits alone; later tasks own those.

## Acceptance

- Scoped list returns the matching old session with at least 400 newer unrelated sessions, as the existing regression test requires.
- Sessions with symlink/junction-equivalent cwd still match; unrelated cwd never leaks into results.
- Irrelevant session files require only the bounded header check; they do not trigger tail reads or JSON parsing of the rest of their transcript.
- Relevant titles, previews and timestamps, and import-time model/thinking restoration remain identical.
- No new dependencies, persistent index, or public API changes.

## Focused verification

- Extend `packages/server/src/server/agent/providers/pi/session-descriptor.test.ts` using temporary real JSONL files for the old-match and path-alias cases. Reuse existing fixtures instead of adding a mock filesystem or a large test harness.
- On a large local corpus, compare scoped listing before/after and check head-versus-tail read counts with temporary opt-in instrumentation if practical. Do not use timing assertions in unit tests.
- Run: `npx vitest run packages/server/src/server/agent/providers/pi/session-descriptor.test.ts`, `npm run typecheck`, and applicable formatting checks.

## Files

- [Pi descriptor](../../packages/server/src/server/agent/providers/pi/session-descriptor.ts)
- [Pi descriptor tests](../../packages/server/src/server/agent/providers/pi/session-descriptor.test.ts)
- [Path matching](../../packages/server/src/utils/path.ts)
- [Overview and invariants](../plans/pi-import-session-performance.md)

## Constraints

Depends on no other task. Do not redesign Pi storage or import/resume, modify the shared path matcher globally without its regression coverage, or pull the later discovery/cache/search work into this slice.
