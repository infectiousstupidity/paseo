# Pi import 06: Inspect a session without importing it

Status: **planned**. Depends on [05 — recognizable rows](./pi-import-05-identifiable-sessions.md). Avoid building a full transcript viewer.

## Problem

Two sessions can still share a similar first 160 characters (for example, reviewer instructions) and last activity age. The user needs more **actual text and exact metadata** before choosing, without a second listing pass or accidental import.

## Implement

1. Add a compact **user-activated** detail disclosure to each import row (or one local selection panel if it is demonstrably simpler). On desktop, reveal bounded first/last user-prompt excerpts, original persisted title / machine name, exact `lastActivityAt`, provider and working directory. Never imply the excerpts are complete prompts or a summary. Hide duplicate/missing information. Reuse existing strings and date formatting where possible.
2. Leave the row's existing press/Enter behavior as **import**. The detail control must be separately focusable and accessible; expanding/collapsing must **not** import the session or issue a network request. Verify event propagation on both React Native web and compact layout; if nested pressables are brittle, use a separate sibling control instead.
3. If 160-character Pi excerpts still obscure the distinguishing task, raise `normalizePromptPreview`'s **Pi-only** length to one modest fixed cap (for example 512 characters). The reader already has the prompt text from bounded 64KiB head/256KiB tail reads; do not add extra reads or lift those file limits. Preserve normalized whitespace and hard payload bounds. Make clear a title/prompt can remain unavailable for unusual oversized preambles.
4. Keep the shared descriptor schema unchanged, so other providers and older daemon clients remain compatible. Check that Pi server-side search (which matches descriptor previews) still works and can now find words within the longer cap. Never expose the full raw transcript, summarize with a model, add an on-demand endpoint, or prefetch details for each row.
5. Keep state local to the sheet and reset it appropriately on scope/provider/search changes or import. No persistence, cache tier, parent-child linkage, task scanner, rescan timer, or new dependency.

## Done when

- The user can distinguish similarly named child sessions by real first/last excerpts, directory and **absolute** time without import.
- Opening or expanding the sheet issues no extra daemon RPC; payload growth stays limited to at most the new excerpt cap per Pi field.
- A click on details never imports. The existing row import continues to work on desktop and narrow layouts.
- Non-Pi provider sessions, stale/partial preview data, provider errors, filters, pagination, and the original import identity remain correct.

## Minimal checks

- One targeted component interaction: expanding details does **not** call `importAgent`; explicitly importing still calls it once with the unchanged provider handle.
- If Pi preview length changes, extend **one** existing temporary-JSONL descriptor test to cover truncation, a term beyond the old 160-character boundary, and bounded search. No extra fixture suites.
- Run affected import-sheet and Pi descriptor test files, relevant app/server workspace typechecks, and changed-file formatting. Manually try one parent-style session and two similar children on desktop and narrow layout. No broad E2E, coverage target, or performance threshold test.

## Files

- `packages/app/src/components/import-session-sheet.tsx` and existing component test
- `packages/app/src/components/import-session-sheet-view-model.ts` only if a shared helper is actually useful
- `packages/server/src/server/agent/providers/pi/session-descriptor.ts` and existing descriptor test **only if** changing the excerpt cap
