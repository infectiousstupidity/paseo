# Pi subagent controls 06 — Clear, compact panel and safe controls

Status: **ready**. Depends on [05](./pi-subagent-controls-05-targeted-actions.md). [Plan](../plans/pi-subagent-controls.md).

## Deliverable

Implement the revised Paseo subagent panel with better contrast, hierarchy and explicit controls, without a new page/dashboard or replacing the existing `ComposerTrackPill`/compact-sheet infrastructure. Use the user's V2 mock *only* as a visual intention; demo sample content and simulated controls are not production data.

## UI hierarchy

- Header with real counts, limited metadata; attention/working/recent section headings only when populated. Remove repetitive right-column `Finished` for all finished rows and the giant archive action at the top.
- Dense, scannable rows: left semantic icon, short task/action title, a *useful* one-line result/activity below, small actual state on right. User-visible task excerpts must hide long repo path/HEAD hash boilerplate. Keep full untouched task under expansion. Use source text, not a summarizing model.
- Fix `Last response: ## Review` and `## TL;DR`: ignore Markdown-only headings, blank lines/fences and boilerplate; prefer a substantive final statement or explicit structured completion report. Never call reviewer verdict clean without evidence. Avoid displaying execution age as work duration; show actual elapsed only if end timestamp exists or label as `started ... ago`.
- Only one expanded child at a time, at a predictable inset aligned with other row content: task, actual observed result and source label, then controls. Must not introduce nested Pressables. Keep `Open full session` one obvious action away.
- Active and controllable child: `Stop` with clear confirmation, `Steer` with short text field, `Status` on demand. Stop shows `Stopping…` until fresh terminal event, then `Stopped`; error retains row and displays actual message. Disable conflicting actions while pending; handle double-click, cancellation of confirmation, and busy/unsupported.
- No pretend model metadata or semantic results, no fake grouping, no fabricated completion timestamp, no per-row polling. Archive remains available but quiet and preserves existing hide vs actual archive semantics.
- Respect `docs/design.md`, `docs/menus.md`, `docs/hover.md`, `docs/floating-panels.md`, existing i18n, theme and spacing tokens. Avoid hard-coded colors; 360px/native touches, keyboard focus and accessibility labels.

## Implementation/testing limits

Keep changes local to `packages/app/src/subagents` and existing panel primitives unless an actual bug requires touching shared components. Use narrow Zustand selectors. Desktop popover stays bounded and scrollable; the expanded area must scroll inside the panel and never overlap the fixed footer. Test active/attention/results, expanded/dismissed, pending Stop, denied/stale errors and 360px layout in focused tests. Real Electron desktop + 360px screenshot inspection is required when available; never claim visual acceptance from a static mock. Run target app typecheck, lint, formatter and focused tests. Commit + record evidence.
