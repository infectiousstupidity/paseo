# Pi import 06 — Inspect without importing

Status: **ready after 05**. Follow the verified [implementation plan](../plans/pi-import-session-identification.md). The HTML mock is **illustrative**; do not port its one-way/reversible scope handling, fake counts, shortcut, custom CSS or full-text search.

Visual reference: [interactive Import session HTML mock](../mockups/import-session.html). Compare its Details expansion and narrow layout, but reuse the real sheet's focus/scroll/import semantics. Its example data and simulation controls are not requirements.

## Change

1. In `packages/app/src/components/import-session-sheet.tsx`, put a focusable, accessible `Details` control **beside**, never inside, the row's existing import `Pressable`. Use an expanded-state accessibility property and a stable details test ID. The row still imports with one press/Enter; Details expands/collapses without importing.
2. Keep at most one `expandedKey` local to the sheet, keyed by `providerId:providerHandleId`. Reset on close, host, scope, provider or query change and after import. Render inline content within the existing scroll view; no nested sheet, new component framework or second data store.
3. Show original saved title (or unavailable), actual provider, full cwd, local absolute last-activity date/time, and distinct **first/last user-prompt excerpts**. These are not agent outputs or full transcripts. Handle long paths, unavailable text/dates and compact-width wrapping. If a separate `Import session` control within details is useful, reuse `handleImportSession(entry)` unchanged.
4. If the current 160-character Pi excerpts remain inadequate on real sessions, increase **only Pi's** `normalizePromptPreview` cap to at most **512** using the same 64KiB head / 256KiB tail reads. Do not change the shared protocol, read full JSONL, add an RPC, infer metadata, or add another cache. This also widens Pi's existing bounded excerpt search, not full-text search.
5. Use the existing `importSession` i18n namespace and themed components. Preserve multi-provider behavior, search, paging, manual refresh, import errors, cross-workspace placement and compact/mobile presentation.

## Verify, minimally

- One focused interaction test: Details does **not** call `importAgent`; the original row still imports exactly once with unchanged handle/cwd (and optional detail import if implemented).
- If preview cap changes, one Pi JSONL assertion for capped excerpts and matching a term past old 160 characters; no new test harness.
- Run affected existing Vitest files, relevant app/server typechecks, changed-file formatting, and a manual desktop/narrow-width check with two similar sessions.

**Done:** the user can compare real task clues and exact metadata before importing without extra RPCs or reads. If 512 bounded characters still give indistinguishable sessions, stop and investigate child-session naming at creation time instead of building a transcript browser.
