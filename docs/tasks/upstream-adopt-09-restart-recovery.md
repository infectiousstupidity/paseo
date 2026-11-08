# Upstream adoption 09 — Terminal continuity and opt-in agent recovery

**Priority:** P2  
**Status:** Partial implementation on `main` in PR #28; acceptance pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Preserve terminal processes through daemon restarts and make interrupted-agent resumption explicitly opt-in.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/7644
- https://github.com/getpaseo/paseo/pull/8127
- https://github.com/getpaseo/paseo/pull/8619

## Work

Review terminal workers, startup recovery and agent persistence. Preserve fork's guarded idle suspension, finish subscriptions and archive fencing. Treat terminal survival and model-turn recovery as separate behavior. Never restart production daemon.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

An isolated restart preserves terminal process/history; default-off does not resume interrupted agents; opt-in resumes the original session without duplicate prompts; failures are visible.

## Verify

Isolated daemon restart/terminal and default-off/opt-in agent recovery tests.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.

## Partial implementation — launch environment preservation (2026-11-08)

**Delivery:** [PR #28](https://github.com/infectiousstupidity/paseo/pull/28) merged into `main` at [`d3065e48`](https://github.com/infectiousstupidity/paseo/commit/d3065e4859d7f07545e8fea236c26fb9996232f1). Source merged at user request; not acceptance-verified.

The existing create flow passed explicit per-agent environment overrides to the provider, but session refresh and disk-backed reopening discarded them. This change stores the original overrides in the agent record and reuses them for saved-session reopen (with or without a provider handle) and refresh. The regression exercises Codex and OpenCode, including the explicit empty-string value, caller mutation, and absence from client snapshots. It does not persist daemon-injected launch variables. Agent records are now written mode `0600` on POSIX, with a targeted persistence/permission regression.

**Still missing:** Terminal process survival across daemon restarts; opt-in interrupted-agent continuation and its safeguards; isolated restart/terminal tests and real-provider/browser acceptance. This is only a bounded part of #22, not task completion.

**Verification status:** Regression test added, not executed. This environment has Node 22 but the repo requires Node >=26.12.1, with no network access for dependencies or checkout. Run the focused Vitest file, `npm run typecheck`, `npm run lint`, `npm run format`, and `npm run format:check` in a supported checkout before declaring acceptance. Production daemon untouched.
