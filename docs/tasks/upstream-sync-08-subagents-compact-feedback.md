# Upstream sync 08: integrate compact subagent rows and standard action feedback

Status: **Pending.** Depends on [06](upstream-sync-06-markdown-dependency-and-patch-reconcile.md); preserves the completed [04](upstream-sync-04-subagents-track-opens-in-sheet.md). This task owns the next merge and its one textual conflict. Plan and pinned refs: [upstream sync](../plans/upstream-sync-2026-10.md).

## Outcome

The fork incorporates upstream `9a0b95aa1` through a real merge, retains its expanded/grouped subagent inspector, and adopts #7364's compact row geometry and shared action-button feedback without overlapping disclosure controls or losing child navigation semantics.

## Evidence

`d61dcaf1d` changes `composer/tracks.tsx` and `subagents/track.tsx`, adds `paseo/no-raw-pressable`, and wires lint-rule tests into CI. The `HEAD=999d51cb2` / upstream `9a0b95aa1` dry run has three conflict regions in `track.tsx`. Two concern upstream's inline action cluster versus the fork's sibling cluster/disclosure; the third mixes the archive button conversion with incompatible wrapper endings.

Cleanly merged hunks still need adaptation: `SubagentRowActions` gains a required `compact` prop, while the fork's surviving sibling call does not pass it. Taking only the fork's conflict hunks leaves incomplete JSX/props. Taking the entire upstream file loses grouping, inline details, and Pi controls.

A temporary root-relative copy of upstream's lint config/plugin against the current fork reports two new-rule violations: `subagents/track.tsx` and the fork-only `subagents/expanded-details.tsx`. The second file never conflicts in git; its Task disclosure imports a raw Pressable and is not on upstream's grandfather list.

## Change

1. Start with a clean integration checkout containing the operator's intended fork commits. Fetch both remotes and preserve `origin/main`'s archive-fencing commit `7c35c4a8f` by merging the fork remote before upstream; do not reset or rebase published history. At review time `HEAD` and `origin/main` have diverged, so `pull --ff-only` cannot reconcile them. The origin-only merge currently dry-runs cleanly.
2. Run a real three-way merge of pinned upstream `9a0b95aa1`. If refreshed refs change the conflict/semantic overlap set, update the plan before resolving new work. Never synthesize a merge by copying a tree and assigning two parents.
3. Keep the fork's row composition and its sibling action-cluster ownership. Adopt upstream's `ToolbarButton` conversion, muted themed glyphs, tooltip labels, compact sizing, and test IDs; pass `compact={isCompact}` at the surviving action-cluster call. Remove obsolete raw action-button code/imports and fix all conflicting JSX wrappers and hook dependencies.
4. Retain the automatically merged compact `ComposerTrackRow` geometry (menu-height touch rows, denser desktop rows). Keep the fork's `widePanel` and expansion accessibility additions. Reserve enough trailing room for the shared toolbar hitboxes plus disclosure on compact and desktop; the old fixed `marginRight: 64` is not evidence that the larger compact targets fit.
5. Replace `TaskDisclosure`'s raw Pressable with the shared row primitive appropriate to its menu surface (`ComposerTrackRow` with `closeOnSelect={false}`). Preserve its expanded accessibility state, task toggle, selectable content, and test IDs. Do not add the fork-only file to the raw-pressable exemption list.
6. Preserve the clean merges outside the conflict: touch-tab composer blur (#7352) plus the fork's modifier-key fields, git action deduplication (#7355), Korean terminal word selection (#7353), release metadata/lockfile, CI lint-rule wiring, and fork package scripts. Install and refresh declarations after merging.

## Acceptance

- `9a0b95aa1` and the reviewed `origin/main` tip are ancestors of the resulting fork branch. The merge includes all seven new upstream commits, not just the conflicted file.
- Grouped sections, inline expansion, observed activity, task disclosure, Pi status/stop/steer, and agent facts remain available. A row press toggles details without dismissing the list.
- Open session retains Task 04's rule: sheet targets leave the list underneath; tab targets close it. Detach/archive do not toggle the row or navigate.
- Compact and desktop action targets fit without overlapping the label/disclosure or changing row height when revealed. Controls remain reachable on native/compact without hover; desktop hover remains stable when moving onto the buttons. Use the current [platform](../platform-gating.md) and [hover](../hover.md) rules, not stale event-handler recipes.
- No raw-pressable lint violations remain in either subagent component, and no new exemption is added. Changed subagent files pass targeted lint; use themed wrappers rather than retaining the forbidden `useUnistyles()` import.
- The model cache stays upstream-identical; Task 03's replica-cache overlay stays intact. No blanket checkout of upstream's cache or track is used.

## Verify

Add behavior coverage to the existing browser specs for action-vs-row presses, expanded Task disclosure, and sheet/tab navigation. Test desktop and compact widths; use actual native evidence for touch feedback rather than treating a Chromium viewport as a native run.

```bash
npm run build:client
npm run typecheck
npm run lint -- packages/app/src/subagents/track.tsx packages/app/src/subagents/expanded-details.tsx
(cd packages/app && npx vitest run src/subagents/track-presentation.test.ts src/subagents/opens-in-sheet.test.tsx src/subagents/expanded-details.test.tsx --bail=1)
npm run test:e2e --workspace=@getpaseo/app -- e2e/browser/subagent-detach.spec.ts e2e/browser/compact-workspace-sheet.spec.ts
```

[Task 07](upstream-sync-07-merge-integration-verification.md) owns the final integration matrix. [Task 09](upstream-sync-09-windows-lint-rule-runner.md) follows this merge to repair the newly introduced Windows lint-test launch; do not call that test green merely because the config merged cleanly.

## Constraints

- Keep fork features; do not take upstream's whole track or move actions into the row's Pressable.
- No new generic component framework, provider-control behavior, protocol shape, or translation scope.
- No push to upstream, daemon restart, full local suite, or unrelated working-tree changes.

## Completion

Commit the fork-remote reconciliation and real upstream merge with the resolutions documented. Record targeted verification and remaining baseline lint failures separately; leave publishing and final sign-off to Task 07.
