# Upstream adoption 04 — Hidden durable helpers created by plugins

**Priority:** P1  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Let Shiori create background helper agents without polluting tabs, normal listings or notifications.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8683

## Work

Review agent creation, persistence, SDK/MCP and client projections. Add upstream's agent-level background flag only if missing, preserving existing child/parent/workspace ownership and Shiori's single global task runner. Do not create a parallel hidden-workspace service.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Background helper is addressable by ID, durable and awaitable, absent from default lists/attention/notifications, but visible in explicit inclusive lists. Ordinary agents remain unchanged.

## Verify

Focused creation, list, archive, restart, notification and plugin SDK tests.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
