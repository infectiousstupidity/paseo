# Upstream adoption 08 — Retain plugin state on host reconnect

**Priority:** P2  
**Status:** Planned  
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
