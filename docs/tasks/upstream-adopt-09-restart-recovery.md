# Upstream adoption 09 — Terminal continuity and opt-in agent recovery

**Priority:** P2  
**Status:** Planned  
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
