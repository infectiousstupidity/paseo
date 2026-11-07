# Upstream adoption 07 — Awaited worktree hooks and selected ignored files

**Priority:** P2  
**Status:** Partial implementation, pending verification and placement integration  
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

## Implementation record — 2026-11-07

Baseline inspected: fork `main` at `cac42048adae53b58f92804c516e05a9b56f6865`.
Compared upstream #8081, #8117, and #8100 with the fork's plugin worker,
existing before/event IPC, worktree creation and rollback, and local Git ownership
and recovery code.

### Implemented in proposed change

- Added `server.addHook` canonical lifecycle names while preserving legacy
  `server.on` and `server.before` registration order, transforms, and runtime behavior.
- Added awaited `worktree.create.after` before workspace provisioning/setup.
  Failures use the existing server-owned rollback; the existing plugin request
  timeout is 30 seconds and sends cancellation.
- Added built-in `worktree-include` based on the MIT-licensed upstream community
  implementation. Files must match `.worktreeinclude` and Git ignore rules.
  Tracked files and already-existing targets are protected.
- Added focused hook unit coverage, a real-Git include-copy test, and an
  isolated-daemon worktree rollback E2E test. Updated `docs/plugins.md`.

### Not yet implemented / verification required

- **Placement and creation-options hook** `worktree.create.before` is not yet
  implemented. Upstream #8117 also changes ownership proofs, arbitrary-path
  archive/delete, worktree listing, recorded-path recovery, and branch cleanup.
  Porting just the destination field would risk deleting unrelated directories
  or failing restoration; integrate that whole safety boundary before enabling
  arbitrary placement.
- Test files were *added but not executed* in this environment. The repository
  requires Node >=26.12.1; the available local runtime is Node 22 and cannot
  access GitHub for package installation. Run the targeted Vitest files,
  `npm run build:server`, `npm run typecheck`, `npm run lint`,
  `npm run format`, and `npm run format:check` in a compatible checkout/CI.
  No live daemon was restarted.
- This task's full acceptance is **not proven**. Keep issue #20 open and the
  tracker checklist incomplete until the placement path and above QA pass.
