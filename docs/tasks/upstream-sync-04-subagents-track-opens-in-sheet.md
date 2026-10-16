# Upstream sync 04: keep the fork's subagents track and honor the sheet-stack rule

Status: **Proposed — awaiting review.** Resolution for the `subagents/track.tsx` merge conflict in [Upstream sync: merge getpaseo/paseo main](../plans/upstream-sync-2026-10.md).

## Outcome

The fork's rewritten subagents track (grouped sections, dense rows, inline expansion, row actions) stays, and it obeys upstream's sheet-stack rule: opening a child that appears in a sheet leaves the list open, opening one that replaces the pane in a tab closes it.

## Evidence

Two conflict hunks in `packages/app/src/subagents/track.tsx` (merged tree lines 207 and 431). Everything else in the feature merged cleanly.

Upstream `e5124b039` (`Put sheets on one stack and show an agent's facts in its sheet (#6958)`) added:

- `opensInSheet: (row: SubagentRow) => boolean` on `SubagentsTrackProps`, with the rule documented in the prop comment: a sheet stacks over the list and uncovers it on close, so the list stays open; a tab replaces the list's pane, so choosing it ends the list.
- `packages/app/src/subagents/opens-in-sheet.ts` — `useSubagentOpensInSheet(workspaceKey)`, backed by the workspace layout store.
- Callers `packages/app/src/panels/agent-tracks.tsx:94,127` and `packages/app/src/panels/provider-subagent-panel.tsx:53-68,146` already pass the prop. Those files do not conflict, so after the merge every caller passes it.

The fork rewrote the same component: grouped sections (`attention` / `working` / `recent`), a hover-revealed action cluster outside the row Pressable, and inline expansion. The fork's row press only toggles details (`closeOnSelect={false}`); navigation to the child session happens through `SubagentExpandedDetails`'s `onOpenSession`, which calls `handleOpenSession`.

The fork's `handleOpenSession` (`track.tsx:327-335`) hardcodes `selectItem(fn, true)` — always close the list. That is exactly the behavior #6958 removed.

Note what already merged: the props interface (`opensInSheet` at merged line 58), the `SubagentsTrack` destructuring (line 110), `SubagentsTrackRowProps.opensInSheet: boolean` (line 308) and its destructuring (line 331). Taking "ours" for both hunks leaves `opensInSheet` declared and never used — a lint error, not a silent pass.

## Proposed fix

Resolve both hunks to the fork's side, then add two edits.

1. Pass the prop where the fork renders its rows — inside the `sectionRows.map` block (fork `track.tsx:172-185`):

   ```tsx
   <SubagentsTrackRow
     key={key}
     row={row}
     serverId={serverId}
     opensInSheet={opensInSheet(row)}
     ...
   ```

2. Use it in `handleOpenSession` (fork `track.tsx:327-335`) — close the list only when the target is not a sheet:

   ```ts
   const handleOpenSession = useCallback(() => {
     selectItem(() => {
       if (row.kind === "provider") {
         onOpenProviderSubagent(row.parentAgentId, row.id);
       } else {
         onOpenSubagent(row.id);
       }
     }, !opensInSheet);
   }, [onOpenProviderSubagent, onOpenSubagent, row, selectItem, opensInSheet]);
   ```

Leave the row's own `closeOnSelect={false}` alone. Expanding details is not navigation.

## Review

- **Upstream's test does not cover this wiring.** `packages/app/src/subagents/opens-in-sheet.test.tsx` exercises the `useSubagentOpensInSheet` hook through `renderHook`; it never renders `SubagentsTrack`. Decide whether to add a component-level assertion (extend `packages/app/src/subagents/expanded-details.test.tsx`, or assert in the `compact-workspace-sheet` e2e spec) that a sheet target keeps the list open in the fork's layout.
- Confirm the fork has no other navigation path from a row. Row actions are detach and archive only; `SubagentRowActions` does not open sessions.
- Confirm `provider-subagent-panel.tsx` passes `opensInSheet` for both the panel and the track it renders, so the fork's panel variant is not left with a stale prop.

## Acceptance

- `opensInSheet` is read in `track.tsx`; no unused-prop lint error.
- Opening a Paseo-managed child that lands in a sheet leaves the subagents list open; after the sheet closes the list is still there.
- Opening a child that opens a tab closes the list, matching #6958.
- The fork's grouping, hover actions, and inline expansion are unchanged.

## Focused checks

```bash
npx vitest run packages/app/src/subagents/opens-in-sheet.test.tsx packages/app/src/subagents/expanded-details.test.tsx packages/app/src/subagents/track-presentation.test.ts --bail=1
npm run typecheck
npm run lint -- packages/app/src/subagents/track.tsx
npm run format:check
```

The e2e specs `subagent-detach`, `subagent-origin-pane`, `archive-finished-subagents`, and `compact-workspace-sheet` run in CI, not locally.

## Constraints

- Do not take upstream's `track.tsx`; it lacks the fork's grouping and controls.
- Do not reimplement `useSubagentOpensInSheet` locally in the track.
- Keep the action cluster outside the row Pressable.

## Required context

- [Upstream sync plan](../plans/upstream-sync-2026-10.md)
- [Agent lifecycle — subagents track](../agent-lifecycle.md)
- [Menus](../menus.md)
- [Subagents track](../../packages/app/src/subagents/track.tsx)
