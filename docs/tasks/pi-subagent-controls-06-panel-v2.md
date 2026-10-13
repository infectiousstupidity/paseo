# Pi subagent controls 06 — Clear, compact panel and safe controls

Status: **implemented in code on main (2026-10-13); automated and real Electron/Pi acceptance unverified**. Depends on [05](./pi-subagent-controls-05-targeted-actions.md), whose live native acceptance is still pending. [Plan](../plans/pi-subagent-controls.md).

## Deliverable

Implement the revised Paseo subagent panel with better contrast, hierarchy and explicit controls, without a new page/dashboard or replacing the existing `ComposerTrackPill`/compact-sheet infrastructure. Use the **checked-in interactive [V2 HTML mock](../mockups/paseo-subagents-v2.html)** as the visual/interaction reference; its sample sessions, colors, CSS, and simulated controls are *not* production data or component implementations.

## UI hierarchy

- Header with real counts, limited metadata; attention/working/recent section headings only when populated. Remove repetitive right-column `Finished` for all finished rows and the giant archive action at the top.
- Dense, scannable rows: left semantic icon, short task/action title, a *useful* one-line result/activity below, small actual state on right. User-visible task excerpts must hide long repo path/HEAD hash boilerplate. Keep full untouched task under expansion. Use source text, not a summarizing model.
- Fix `Last response: ## Review` and `## TL;DR`: ignore Markdown-only headings, blank lines/fences and boilerplate; prefer a substantive final statement or explicit structured completion report. Never call reviewer verdict clean without evidence. Avoid displaying execution age as work duration; show actual elapsed only if end timestamp exists or label as `started ... ago`.
- Only one expanded child at a time, at a predictable inset aligned with other row content: task, actual observed result and source label, then controls. Must not introduce nested Pressables. Keep `Open full session` one obvious action away.
- Active and controllable child: `Stop` with clear confirmation, `Steer` with short text field, `Status` on demand. Stop shows `Stopping…` until fresh terminal event, then `Stopped`; error retains row and displays actual message. Disable conflicting actions while pending; handle double-click, cancellation of confirmation, and busy/unsupported.
- No pretend model metadata or semantic results, no fake grouping, no fabricated completion timestamp, no per-row polling. Archive remains available but quiet and preserves existing hide vs actual archive semantics.
- Respect `docs/design.md`, `docs/menus.md`, `docs/hover.md`, `docs/floating-panels.md`, existing i18n, theme and spacing tokens. Avoid hard-coded colors; 360px/native touches, keyboard focus and accessibility labels.

## Mandatory screenshot comparison and iteration

**This is a blocking visual acceptance gate, not optional polish.** Use the actual checked-in `docs/mockups/paseo-subagents-v2.html` as the reference, open it in a browser and capture screenshots. Separately run the **real Paseo Electron application** with the implemented panel open and capture its renderer (not a Photoshop/HTML recreation, not a screenshot of the standalone mock passed off as the app). Use the application's actual theme tokens and real/clearly-labeled fixture data. The reference HTML is a standalone demo, not code to copy.

Capture and compare **matched states and logical dimensions**:

1. **Desktop, collapsed:** reference at desktop setting (the mock's panel is 640 logical px wide) versus the Electron panel at its real maximum/current width. Include the entire popover and footer with attention, working and recent results, when supplied by live/test data.
2. **Desktop, one expanded running subagent:** expand `Investigate viewport overflow` in the reference and an eligible running Pi child in Electron. Verify the task/result inset, spacing, scroll, `Open session`, `Steer` and conditionally visible `Stop`, plus focus/keyboard operation. If the installed extension cannot control the child, compare the **correctly absent** action instead of adding a fake button.
3. **Desktop, expanded findings:** expand the mock's attention/review row and a real or clearly-labeled app fixture with trustworthy review findings. Compare attention priority, result text and expanded evidence. Never manufacture findings from process completion.
4. **Compact, 360 logical px:** select `360px` in the mock and capture the same collapsed/expanded states from the real compact sheet at a 360px logical viewport. Check that header/counts, labels, controls, bottom action and scrolling stay visible without horizontal overflow or clipped targets.
5. **Stop interaction state (when controllable):** capture the confirmation dialog, pending `Stopping…` and authoritative stopped/error state on the actual app; compare the reference's hierarchy and language, not its simulated timing. Distinguish acknowledgement from terminal status.

Use the existing real-Electron capture workflow and `docs/browser-capture-harness.md` for relevant compositor limitations. Do not assume the app needs keyboard focus just to take screenshots; use available renderer/compositor capture mechanisms and avoid disturbing the user's foreground desktop. Never restart the main daemon at port 6767. If no real Electron renderer exists, explicitly mark visual acceptance **blocked/unverified** rather than substituting the mock or falsely asserting completion.

**Visual pass/fail criteria:** identify the first useful reading target; consistent spacing/alignment rails (icon, title, outcome, detail inset, controls); usable contrast for normal and muted text; no repeating `Finished` on every recent row; outcome summaries not `## TL;DR`/headers; sections clearly distinguish attention/running/completed; archive subordinate to results; no nested action targets; no clipped detail/footer at scroll boundaries; stable 360px behavior, reduced motion and accessible focus. Follow `docs/design.md` where its exact tokens differ from the standalone HTML. This is a **semantic/layout comparison**, not a pixel-perfect CSS port.

For each failed comparison, correct the actual app, re-capture the *same* state, and repeat until visual acceptance passes. Record a concise side-by-side assessment of **reference vs actual**, discrepancies and fixes. Attach or preserve discoverable paths to the reference screenshots, actual screenshots, and final corrected screenshots with dimensions and captured state. Include meaningful remaining deviations and their reasons in this task's completion notes. A green Vitest/typecheck run alone does **not** close this gate.

## Implementation/testing limits

Keep changes local to `packages/app/src/subagents` and existing panel primitives unless an actual bug requires touching shared components. Use narrow Zustand selectors. Desktop popover stays bounded and scrollable; the expanded area must scroll inside the panel and never overlap the fixed footer. Test active/attention/results, expanded/dismissed, pending Stop, denied/stale errors and 360px layout in focused tests. Use the mandatory comparison gate above; never claim visual acceptance from the static mock or automated checks alone. Run target app typecheck, lint, formatter and focused tests. Commit + record evidence.

## Implementation record — 2026-10-13

Implemented directly on `main` in scoped commits, without restarting any daemon or changing upstream Pi. Files: `packages/app/src/subagents/track.tsx`, `expanded-details.tsx`, `track-presentation.ts`, `subagent-activity.ts`, `select.ts`, their corresponding focused tests, and the existing English `subagents.panel` resource.

- Reuses the existing `ComposerTrackPill` popover/compact sheet. Sections are **Needs attention / Working / Recent results**, each displayed only when populated, with actual row counts. Archive-finished moved below the results. Completed rows do not repeat a `Finished` label unless expanded.
- Rows keep single-press session navigation. A **separate, focusable Details disclosure** opens at most one inline detail at a time, including the source task, observed timeline result/tool activity, provider context and an explicitly labeled **started ... ago** age (not an inferred duration). Full source task is retained; the condensed row line skips standalone repo/HEAD metadata and avoids fabricated summaries.
- Final response snippets skip standalone Markdown headings, fences and boilerplate; `## TL;DR` / `## Review` alone is no longer presented as findings. No inference of reviewer verdict or successful completion.
- **Scoped Pi Status / Stop / Steer** appear only for running `pi` provider children with a server-advertised capability and an advisory `controlEligible` flag. Actions recheck the latest store descriptor and go through the existing typed `client.controlProviderSubagent` route; the daemon and Pi bridge independently verify exact live child/session identity. No model prompts, new polling or generic RPC.
- Stop requires an inline confirm/cancel step. A successful `stopping` receipt is displayed as **Stopping…**, preserved across detail collapse until a terminal event is observed, not as terminal proof. Failed controls show the actual error. Steer retains its input on failure and distinguishes **Queued** from **Delivered**. Status runs only on demand. Conflicting mutation controls are disabled during requests. Old daemons, ineligible children and other providers retain ordinary navigation with controls absent.
- Added regression cases for grouping and native eligibility, markdown-only report suppression, task text trimming, control confirmation/cancellation, stale-target rejection, queued steer and on-demand status, without creating a new test harness.

**Verification not performed:** This environment only has GitHub source/commit access, not a checked-out app with dependencies or the user's actual Pi/Electron runtime. These tests and app typecheck, ESLint and formatting were **added/planned but not run**. No real Electron screenshots, 360px measurements, sibling stop/steer acceptance or exact-theme contrast measurements are available. Treat the code as **unverified**, not completed acceptance. Task 07 remains conditional/blocked on the required live native evidence.

### Required local gate (use a separate development daemon; do not restart :6767)

1. Run `npm run build:client` if needed, then `npm exec --workspace=@getpaseo/app -- vitest run src/subagents/expanded-details.test.tsx src/subagents/track-presentation.test.ts src/subagents/subagent-activity.test.ts src/subagents/select.test.ts`, `npm run typecheck --workspace=@getpaseo/app`, changed-file ESLint and `npm run format:check:files -- <changed paths>`; fix failures, then re-run the focused checks.
2. Verify against a disposable installed Pi session with **one child and two parallel children**: eligibility, sibling isolation on Stop, confirmation cancellation, stopped-only-after-observation, Steer queued/delivered, status, busy/unsupported/wrong-session errors and other-provider navigation. Do not assume the Task 05 backend is already proven.
3. Capture `docs/mockups/paseo-subagents-v2.html` and the **real Electron renderer** at matched desktop collapsed / expanded running / findings states, a 360-logical-pixel collapsed and expanded compact sheet, and Stop confirmation/pending/terminal where eligible. Record real screenshot artifact paths, dimensions, mismatches and iterations here. No standalone mock screenshot may substitute for the Electron renderer. Close this task only after that comparison passes.
