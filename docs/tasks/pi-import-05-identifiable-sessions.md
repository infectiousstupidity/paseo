# Pi import 05: Make session rows identifiable

Status: **planned**. Prerequisite: read the [UX decisions](../plans/pi-import-session-identification.md). Independent of performance Task 03.

## Problem

A 560px desktop dialog shows machine IDs like `subagent-reviewer-<UUID>-1`, clipped prompt text, and nearly identical relative timestamps. The list is sorted correctly but rows are hard to tell apart. An import-row press already imports; preserve that fast path.

## Implement

1. In `packages/app/src/components/import-session-sheet.tsx`, increase **only this modal's** `desktopMaxWidth` to a sensible, responsive ~760–840px (verify visually; do not change `AdaptiveModalSheet` globally). Keep compact/mobile behavior.
2. In the existing view model, derive **display-only** row identity from available fields. Keep meaningful `entry.title` unchanged. Recognize only the Pi subagent routing-name form (`subagent-<role>-<UUID>[-n]`) and show the role clearly without presenting the UUID as the headline. Follow with a **verbatim** first-prompt excerpt, not an LLM or speculative semantic summary. If data is poor, say so rather than inventing a task. Do not silently classify arbitrary titles as child sessions.
3. Avoid repeating the same text as headline and preview; expose another existing excerpt only when distinct. Make the type hierarchy obvious with minimal spacing/typography changes and existing design tokens. Retain recent-first ordering, scope and provider filtering, and cross-workspace folder labels.
4. Preserve direct row-click/Enter-to-import, selection targets, accessible labels, errors, refresh, search, pagination, existing test IDs, and mobile. Do **not** introduce task grouping, a new backend read, added state stores, provider-wide title rewriting, or invented status badges.
5. Inspect whether the currently installed `pi-subagents` version already supplies readable child names, or the intercom compatibility path overwrites them. Prefer correct source-provided names when available. Do not make updating another repository a dependency for this fork task.

## Done when

- Representative generated names display as recognizable **reviewer / worker** rows with real prompt clues; true human-assigned titles remain intact.
- Many same-hour sessions are easier to differentiate; rows have enough width without breaking compact layouts.
- Existing single-press import and search operate exactly as before; opening the sheet triggers **no additional RPC or filesystem parsing**.

## Minimal checks

- Add only a focused view-model test contrasting human title, recognized machine title, and malformed/unrecognized names.
- Reuse one existing import-sheet test to verify row title rendering and that clicking imports the same provider handle.
- Run those two existing test files, the app workspace typecheck, and formatting on changed files. Manual desktop/narrow-width check with real Shiori sessions. Do **not** add broad UI snapshots or coverage-only tests.

## Files

- `packages/app/src/components/import-session-sheet.tsx`
- `packages/app/src/components/import-session-sheet-view-model.ts`
- Existing matching `.test.ts[x]` files; i18n resources only for genuinely new visible strings.
