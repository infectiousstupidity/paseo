# Pi import session identification — implementation plan

Status: **ready to implement**, 2026-10-10. Scope: [05 — identifiable rows](../tasks/pi-import-05-identifiable-sessions.md), followed by [06 — inline inspection](../tasks/pi-import-06-inspect-session.md). This updates the earlier proposal after comparing the interactive HTML mock with **the current fork**, not merely upstream. No app code is implemented by this document.

## Visual reference

The [interactive HTML mock](../mockups/import-session.html) is committed as a **visual/interaction reference**. Open the file in a browser when implementing or reviewing the row hierarchy, wider dialog, Details disclosure, spacing and responsive behavior. It uses **illustrative sessions and standalone HTML/CSS/JavaScript**, not the production component tree or API. The verified code paths and explicit exclusions in this plan take precedence: do not copy the mock's full-text search, reversible scope toggle, fabricated counts, fake status/data, custom shortcuts, or import simulation.

## Outcome and boundary

Make the right Pi session recognizable among many similar `subagent-reviewer-<uuid>-1` / `subagent-worker-<uuid>-1` sessions. Preserve **single-press import**; a separately focusable control reveals exact metadata and longer **first/last user prompt excerpts** before importing. Favor existing React Native/Unistyles primitives and the current request path. The mock is a **visual reference**, not a pixel-perfect or functional contract.

Do **not** add LLM summaries, per-row fetches, transcript browsing, a second index/cache, session hierarchy, a database, a general parser for task prompts, or extra dependencies. No changes to Pi session files, the import/resume command, or Shiori are required.

## Verified code path (fork, 2026-10-10)

| Layer | File / existing behavior | Change |
| --- | --- | --- |
| UI | `packages/app/src/components/import-session-sheet.tsx`: `AdaptiveModalSheet desktopMaxWidth={560}`; `ImportSessionSheetRow` is one `Pressable` that **imports immediately**; row shows one-line title, two-line last prompt, relative time, and folder only in unscoped view. | Local width, display hierarchy, **sibling** Details control, inline expanded content. |
| Modal | `packages/app/src/components/adaptive-modal-sheet.tsx`: already supports `desktopMaxWidth`, scrollable body, native/compact sheet, `desktopHeight` when needed. | **No shared modal changes**; don't copy custom HTML layout/scrim/scroll CSS. |
| Presentation | `packages/app/src/components/import-session-sheet-view-model.ts`: `getSessionTitle` uses saved title then first prompt; `getPromptPreview` uses last then first. | Add only a small pure presentation helper if useful; never change import identity. |
| Queries | Same sheet: `useQueries` + React Query keys `[recent-provider-sessions, serverId, cwd, query, limit, provider]`; `query` debounced 200ms; `limit` starts 15/provider and steps to 45/90/200; refresh invalidates query. | Leave requests, search, provider filtering, load-more, host separation and caching alone. |
| CWD | Sheet's `resolveFolder` and `resolveImportTarget`; `Show all` widens the listing to a host and is not a reversible scope picker in this modal. | Retain project-name label only for unscoped rows, full cwd in details, correct cross-workspace import. |
| Pi descriptor | `packages/server/src/server/agent/providers/pi/session-descriptor.ts` discovers JSONL and reads bounded **64KiB head / 256KiB tail**, extracting saved `session_info.name`, first/last **user** messages, last activity. `normalizePromptPreview` caps each prompt field at **160 chars**. | Optional **Pi-only** 512-char preview cap in 06, using already-read bytes. Fix unbounded unnamed-title fallback in 05. |
| Protocol | `packages/protocol/src/messages.ts` import descriptor: provider ID/label/handle, cwd, title, first/last excerpts, lastActivityAt. | No schema or RPC changes. |
| Import | `importMutation` calls `client.importAgent` using the unchanged provider ID, provider handle and cwd with existing workspace-target logic. | Expanded details must not import; row and optional explicit Import button use the same handler. |

Upstream `nicobailon/pi-subagents` can derive readable child names, but an intercom compatibility branch can retain machine-style routing names. Do not assert which branch/version is installed on this machine. The importer cannot accurately recover a parent session from a child UUID; do **not** attempt to group children.

## Mock review: deliberately do not implement these assumptions

- Mock's exact count is its in-memory dataset size. Real Paseo **pages results** and does not return a reliable total. Omit a total-results count (or label only the visible loaded count if genuinely useful).
- Mock searches full sample strings instantly. Real search is a debounced daemon query over **title, bounded first/last excerpts and cwd basename**, not whole transcripts. Keep existing search behavior; increasing preview length naturally widens Pi's searchable excerpt, but never promise full-text search.
- Mock's `Show all workspaces` can toggle back. Actual sheet offers one-way **Show all**, resets on close. Preserve this behavior; don't create another scope mode just for the mock.
- Mock includes `Ctrl+K`, custom icons, colors, keyboard shortcuts, mock toasts, fixed-height background chrome and a permanent footer. The real app has existing header search, styling, overlay focus handling, import mutation and errors. Reuse those; don't port the mock's JS/CSS.
- Mock sample `last` text is fabricated task prose. Real `lastPromptPreview` is the **last user message**, not a completion report, agent response or current activity. Label it accordingly. Never show invented `Completed` or model/role status.
- Multiple sessions can remain indistinguishable when the stored messages are near-identical or beyond bounded head/tail reads. **Do not fabricate a summary**. Improving actual saved child-session names at the producer would be a separate future task only if evidence warrants it.

## Slice 05 — row identity and width

1. Adjust only the import sheet's `desktopMaxWidth={560}` to approximately `820` (tune 760–840 by checking desktop and narrow web). Do not set a custom fixed height unless actual layout requires it; existing modal already caps viewport height and owns scrolling. Do not change `AdaptiveModalSheet`.
2. Add one **pure**, Pi-scoped display helper near `getSessionTitle` and `getPromptPreview` (or adapt these existing helpers), returning the title and two optional distinct excerpts. For an ordinary saved title, preserve it; for an **exact** `^subagent-<role>-<canonical UUID>[-index]$` name, display the role (e.g. `Reviewer`) and a quiet `Subagent` indicator instead of the UUID. Match only **Pi**, not arbitrary provider titles. Keep full raw title in the descriptor for detail display. Fall back to existing first prompt or `Untitled session`; no summarization, tokenization or regexp parsing of task instructions.
3. Prefer the existing **last user prompt** as the main 1–2 line excerpt, and show the **first** as one short secondary line only when its normalized whitespace differs from both title and main excerpt. No duplicate placeholder lines. This mirrors the useful part of the mock without adding text or I/O. A strict role-only display may still be ambiguous; do not promise otherwise.
4. Keep existing `ImportSessionSheetRow` import target, provider icon, date, folder and test ID. Prefer theme spacing/typography over role-chip/badge decoration. Ensure both 360px compact and desktop widths don't overflow.
5. **Backend guard identified in review:** `readPiSessionDescriptor` currently assigns `title = tailInfo.title ?? headInfo.title ?? headInfo.firstUserMessage`; the final fallback can send a full first prompt as `title` even though preview fields cap at 160. Cap **only that unnamed fallback** to a normalized short excerpt in the Pi descriptor reader. Do not truncate an actual persisted `session_info.name` or alter `readPiImportSessionConfig`'s model/thinking restoration. Confirm one focused fixture catches the payload-size regression.

Acceptance: meaningful human titles unchanged, recognized machine names demoted and recognizable, unrecognized/malformed names untouched, no duplicate previews, correct one-click import, no new import-listing RPC or file read.

## Slice 06 — inspect inline without import

1. Render a separate small `Details` `Pressable` **as a sibling**, not nested inside the row's import `Pressable` (React Native web renders button semantics; nested buttons/propagation can cause accidental import). Put them in a shared horizontal `View` with the existing hover/focus styling. Keep current row's test ID on the import target; give details its own stable test ID and `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{expanded}}`. Press/Enter/Space on details toggles only details. Pressing the main row imports once.
2. Store one `expandedKey: string | null` in the **sheet** keyed by `providerId + providerHandleId` (not array index). Render at most one inline panel below its row. Clear on close/host/scope/provider/query change and after import; avoid sticky selection across datasets. Do not add provider-aware global state.
3. Show exact saved title (or unavailable), real provider label, full cwd, **absolute local** last activity timestamp (alongside relative age in row), and separately labeled first/last **user prompt excerpts** if different. Treat missing/invalid dates gracefully. Avoid presenting these as a full prompt or session history; keep whitespace/wrapping safe for long paths. Expanded content lives **inside the existing modal's scroll**, not a second scroller/popover.
4. Optional explicit `Import session` control within expanded details calls the existing `handleImportSession(entry)` if it clarifies the action; never duplicate import logic. Omit it if redundant in real review. Handle loading/disabled state with existing `importMutation.isPending`.
5. If 160-character excerpts still hide the task in actual Pi data, change **only Pi's** `normalizePromptPreview` cap to **512 chars**. The existing 64KiB/256KiB reads and message extraction remain unchanged. Each Pi row would add at most **704 characters total** across first+last fields compared to two 160-character fields; at the default 15 rows that is at most **10,560 extra characters** (before encoding). No new endpoint and no extra disk read. Search uses the same bounded excerpt fields; adjust a single fixture only if making this change. Do not include full user prompts on every response.
6. Add necessary localized labels using the existing `importSession` i18n namespace (English fallback and project locale conventions). Do not embed English-only literals in otherwise translated controls. Reuse existing date formatting/translation helpers if suitable.

Acceptance: details expand/collapse locally without network or import; selected entry's original identity survives sorting/pagination; importing from row works unchanged; compact, desktop, other providers and older daemons still work.

## Smallest worthwhile verification

Tests should target behavior **that could actually regress**. Extend existing files rather than inventing a new test harness:

- `packages/app/src/components/import-session-sheet-view-model.test.ts`: one table-driven case: canonical generated Pi ID vs real title vs malformed/other-provider ID, plus deduped previews.
- `packages/app/src/components/import-session-sheet.test.tsx`: one test verifying details does **not** call `importAgent`, while the normal row (and explicit expanded Import if included) imports exactly once with the expected provider handle/cwd. Reuse current mock setup; exercise compact layout manually rather than full E2E.
- `packages/server/src/server/agent/providers/pi/session-descriptor.test.ts`: one temporary JSONL session with long first prompt and no named `session_info`; assert fallback title is bounded, first/last preview caps (160 for 05, 512 only if 06 changes), and existing model/thinking resume remains unaffected. Avoid new tests for functions that did not change.

Run affected Vitest files and changed-file `npm run format:check:files -- <paths>`; typecheck only the relevant app/server (and dependencies when required by workspace scripts). No full monorepo tests, coverage thresholds, visual snapshot suites, or timing-based unit assertions. Manually inspect **actual** Shiori Pi history: two near-identical reviewers, a worker, a human-named session and an unnamed session, on desktop and compact width. Verify no increase in request count or file reads; profile only if latency visibly regresses.

## Out of scope / stop conditions

- If real installed `pi-subagents` already emits useful human child names and only old sessions have machine names, treat the parser as a backward-compatible display fallback—not an additional naming subsystem.
- If 05 alone makes sessions easy to distinguish, keep 06 limited to local disclosure using existing 160-char data; skip the preview cap increase.
- If even a 512-character bounded excerpt is not enough for many sessions, **stop and measure why** (repeated boilerplate vs missing data). Improving names at child creation is preferable to parsing prompts or adding LLM work at import time.
- Do not mix in performance Tasks 01–04 (01/02/04 already implemented, 03 optional), grouping, status indicators, history navigation, custom keyboard shortcuts, global modal refactoring, or extra providers' protocol changes.

## Agent handoff

Implement [05](../tasks/pi-import-05-identifiable-sessions.md), review actual desktop/compact rows and one-click import, then implement [06](../tasks/pi-import-06-inspect-session.md) if the visual and interaction check confirms it is useful. Follow the in-repo implementation boundaries above; use **only focused changed-behavior tests** and report any unresolved missing metadata rather than approximating it.
