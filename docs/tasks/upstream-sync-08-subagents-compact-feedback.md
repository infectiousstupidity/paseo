# Upstream sync 08: integrate compact subagent rows and standard action feedback

Status: **Implemented — local checks passed; native touch-feedback evidence remains for Task 07.** Depends on [06](upstream-sync-06-markdown-dependency-and-patch-reconcile.md); preserves the completed [04](upstream-sync-04-subagents-track-opens-in-sheet.md). This task owns the next merge and its one textual conflict. Plan and pinned refs: [upstream sync](../plans/upstream-sync-2026-10.md).

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

### Implementation and verification (2026-10-19)

- Started clean from published fork `bde6be4a2`, including Task 06 (`8bad0df74`) and the real fork-remote reconciliation (`0f9b23dbc`, containing `7c35c4a8f`). Fetched both remotes. Upstream advanced to `c575464e8`; this merge intentionally pins `9a0b95aa1` as scoped. The additional workspace-layout commit is not included. The pinned merge still conflicted only in `subagents/track.tsx`.
- Ran `git merge --no-commit --no-ff 9a0b95aa1`. Retained grouped inspection, activity, agent facts, inline details, Pi controls, and sheet/tab selection. Adopted upstream toolbar buttons and themed glyphs without raw Pressable imports or new exemptions. Both changed subagent components pass targeted lint; removed the forbidden theme hook.
- Action overlays are siblings of the row pressable, anchored to the header rather than its expanded details. Disclosure clearance derives from shared 20px desktop / 32px compact toolbar frames and the action count. Space remains reserved while hidden. Web-only mouse boundary handlers track the containing View; native and compact actions remain visible without hover. Preserved the automatically merged ComposerTrackRow compact geometry, `widePanel`, and expansion accessibility.
- Task disclosure uses ComposerTrackRow with `closeOnSelect={false}`, expanded state, original test IDs, and selectable task text. Existing browser helpers now respect retained expansion state when reopening the menu. Preserved detach's established explicit confirmation and workspace-tab focus behavior; action clicks never invoke the row's detail/session action.
- Audited clean overlaps: composer blur and modifier-key additions, git action deduplication, Korean selection, release metadata/lockfile, lint CI wiring, and fork scripts remain. Agent-stream model is identical to pinned upstream; replica-cache is unchanged from the pre-merge fork, retaining Task 03.

Windows / Git Bash / Node v24.20.0 verification:

- `npm ci`: passed, all eight installed dependencies patched. Audit still reports 159 vulnerabilities (9 low, 44 moderate, 91 high, 15 critical); no unrelated upgrades attempted.
- `npm run build:client`, `npm run typecheck`: passed.
- Focused three-file Vitest command: **46 tests passed** (including Task disclosure coverage).
- Changed subagent components, test, both browser specs, and the shared subagent helper: targeted lint passed. Full lint retains **35 pre-existing errors** after the seven existing subagent-track findings and ComposerTrackRow accessibility-state allocation were resolved and the temporary new test lint finding was fixed. No rule exemptions were added.
- Browser evidence: compact-workspace-sheet and existing detach flows passed in the second run. Both new action/disclosure/archive tests passed in the final focused run at **1280px and 390px**. Initial new-test failures were fixture assumptions (animation sampling, compact menu test ID, retained disclosure state, archive confirmation and optimistic removal), corrected without weakening product behavior. Earlier runs also hit the existing Windows isolated-daemon teardown error; final focused run shut down normally. No already-green browser flows were rerun.
- `npm run format` passed; unrelated formatter-only edits were restored. Changed-file format checks and commit hooks run before commit.
- LSP probe used an inferred project without JSX/esModuleInterop and emitted configuration diagnostics; the actual workspace typecheck passed. Impeccable's changed-component detector returned no findings.
- `adb devices -l` returned no attached device. **No actual native touch-feedback evidence is claimed.** Task 07 retains native/platform verification and final CI sign-off. Task 09's upstream Windows lint-rule launcher remains unchanged and is not reported green.

No main daemon restart, full local suite, protocol change, cache replacement, or upstream push was performed. Published only to the fork's main at the operator's request.
