# Upstream sync 04: keep the fork's subagents track and honor the sheet-stack rule

Status: **Done — merged in `69359e8cb`.** Historical resolution in the [upstream sync plan](../plans/upstream-sync-2026-10.md). The new conflict from upstream #7364 belongs to [Task 08](upstream-sync-08-subagents-compact-feedback.md); do not reuse the old two-edit recipe.

## Outcome

The fork keeps grouped sections, inline expansion, provider controls, and sibling action controls. Upstream #6958's `opensInSheet` contract is threaded through the fork's track, and Paseo-managed rows include the agent facts line in their metadata.

## Navigation contract

- Pressing a row expands its details. `ComposerTrackRow` has `closeOnSelect={false}`; expansion does not navigate or close the list.
- The expanded details' Open session action calls `handleOpenSession`, which uses `selectItem(..., !opensInSheet)`.
- A child opened in a sheet leaves the list underneath; closing the sheet uncovers the list. A child opened in a tab closes the list.
- Detach/archive controls stay outside the row's Pressable so an action cannot also toggle details or open the child.

## Verification

The original merge recorded 10 files / 133 passing subagent tests and a clean root typecheck. Those results are historical. The 2026-10-19 task-doc refresh inspected the current `track.tsx` wiring above; it did not re-run the browser flows.

Upstream `d61dcaf1d` now changes action-button chrome and compact row geometry, not the sheet-stack contract. Task 08 must retain this contract while adapting that change to the fork's layout.

For a focused unit recheck, run from `packages/app`:

`npx vitest run src/subagents/opens-in-sheet.test.tsx src/subagents/expanded-details.test.tsx src/subagents/track-presentation.test.ts --bail=1`

Browser specs live in `packages/app/e2e/browser`; the ordinary browser project uses Playwright Chromium, not an Android/iOS emulator. The `provider-subagents.real.spec.ts` case is in the separate `real-provider` project and needs the real provider environment. See [Task 07](upstream-sync-07-merge-integration-verification.md) for the outstanding verification.

## Required context

- [Agent lifecycle](../agent-lifecycle.md)
- [Menus](../menus.md)
- [Task 08](upstream-sync-08-subagents-compact-feedback.md)
