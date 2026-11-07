# Upstream adoption 02 — Subagent launch markers and parent navigation

**Priority:** P1  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Keep the parent's timeline compact while making child activity and parent navigation accessible.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8276
- https://github.com/getpaseo/paseo/pull/7784

## Work

Compare packages/app/src/subagents, timeline projection and provider adapters to upstream. Preserve the fork's grouped Pi inspector, expanded rows, real status, Stop/Steer, explicit Open session and sheet/tab navigation. Avoid replacing its row components wholesale.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Parent cards stay small during long child runs; child transcript/status survive restart; Open parent works across workspaces; existing Pi actions and inspector interaction remain intact.

## Verify

Existing subagent adapter/unit tests, desktop and compact browser navigation, plus a real/captured child session.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
