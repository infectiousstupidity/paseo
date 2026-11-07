# Upstream adoption 11 — Workspace archive, attention and narrow-pane navigation

**Priority:** P3  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Make workspace archive/undo and tab restoration predictable, including independently narrow split panes.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8904
- https://github.com/getpaseo/paseo/pull/8935
- https://github.com/getpaseo/paseo/pull/8740

## Work

Inspect sidebar, workspace tab state and window-width measurement; follow docs/expo-router.md and docs/explorer-sidebar.md. Preserve fork custom UI. Shiori task archive/edit/delete is a distinct domain and out of scope.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Sidebar archive can be undone; return to workspace restores chosen tab; explicit focus acknowledges attention; each pane responds to its own width; native and web stay usable.

## Verify

Focused sidebar/tab tests, narrow split desktop browser and compact browser checks.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
