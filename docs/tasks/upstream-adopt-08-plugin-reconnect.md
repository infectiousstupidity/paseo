# Upstream adoption 08 — Retain plugin state on host reconnect

**Priority:** P2  
**Status:** Implemented pending QA  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Keep mounted Shiori plugin views and local drafts across transient host disconnects.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8105
- https://github.com/getpaseo/paseo/pull/8040
- https://github.com/getpaseo/paseo/pull/8076

## Work

Review packages/app/src/plugins install identity and server bundle delivery. Fix state retention first. Reuse verified bundles/minification only where compatible and worthwhile. Do not extend scope to app-restart persistence or direct/relay switching without proof.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Temporary disconnect/reconnect preserves draft, selection and expansion; changed/removed plugins reconcile; no stale listeners; reused unchanged bundle does not remount unnecessarily.

## Verify

Catalog lifecycle tests and isolated browser WebSocket-disconnect test.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.

## Implementation record — 2026-11-07

Compared fork `main` at `cac42048adae53b58f92804c516e05a9b56f6865`
against upstream #8105, #8040 and #8076. The fork still unloaded plugin
installations on socket disconnect in `catalog-sync.tsx`. Full persistent
bundle caching and client minification from the other upstream PRs are intentionally
**not included**: keeping state while reconnecting does not require either.

Changes:
- Extracted the catalog subscription model. Disconnecting the **same** DaemonClient
  now releases only its catalog observer; mounted plugin contributions, local draft
  state, and the plugin QueryClient remain installed until the host is actually
  removed. Reconnecting fetches the current catalog and reconciles removals,
  changed code and reload events.
- Bound installations to their originating DaemonClient identity. A different
  client must replace them rather than leaving stale RPC and event clients.
- Replayed catalog snapshots invalidate settings queries with `refetchType: "all"`
  so inactive settings also pick up writes made while offline. Existing targeted
  live invalidation and explicit cleanup remain intact.
- Unchanged catalog and client retain installation identity and the presentation
  snapshot. Added focused model and registry regressions.
- No direct/relay switching guarantees or app-restart persistence added.

**Verification outstanding:** GitHub-only work environment has no source checkout
with workspace dependencies, and requires Node >=26.12.1 (container Node 22).
Unit tests, typecheck, lint, formatting, real browser disconnect/reconnect, and
Shiori draft/selection UI verification could not be run here. Do not mark #21
accepted or closed until those are proven against the delivered commit. No
production daemon was restarted.

## Delivery on main

Merged to `main` in [PR #27](https://github.com/infectiousstupidity/paseo/pull/27), merge commit `bb52bc0482c9394280f2cfbb9d4aa8b838c3d6da`. The 9-file change is source-implemented but **not acceptance-verified**; the new tests and controlled WebSocket/browser QA still require execution.

As of this record, GitHub has reported no CI check runs on the merge head; no local test success is claimed.
