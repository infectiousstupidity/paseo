# Upstream adoption 07 — Awaited worktree hooks and selected ignored files

**Priority:** P2  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Let a plugin choose worktree placement/options and copy explicitly included local ignored files before setup and first agent.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8081
- https://github.com/getpaseo/paseo/pull/8117
- https://github.com/getpaseo/paseo/pull/8100

## Work

Inspect server worktree creation, plugin lifecycle and existing handlers. Reconcile before/after hooks with the fork's API; preserve compatibility aliases as necessary. Keep worktree creation/rollback server-owned. Only .worktreeinclude patterns copy; do not overwrite existing destination files.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Placement and include work with a real worktree; awaited hook errors/timeouts roll back; no include file copies nothing; agent sees files before executing setup.

## Verify

Focused worktree creation/path validation/rollback tests and end-to-end setup.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
