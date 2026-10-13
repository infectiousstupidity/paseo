# Pi subagent controls 06 — Clear, compact panel and safe controls

Status: **ready**. Depends on [05](./pi-subagent-controls-05-targeted-actions.md). [Plan](../plans/pi-subagent-controls.md).

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
