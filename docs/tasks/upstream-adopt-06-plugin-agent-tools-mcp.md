# Upstream adoption 06 — Scoped plugin agent tools and session MCP servers

**Priority:** P1  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Let Shiori attach specific tools/MCP servers to selected agents on create, import and resume.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/7938
- https://github.com/getpaseo/paseo/pull/7983

## Work

Review existing PluginSessionOpenRequest and plugin lifecycle; extend its owning boundary rather than creating a parallel hook. Validate tool input and tool/agent ownership; reject names colliding with saved/internal/other plugin tools or unsupported providers. Preserve durable agent settings.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Tool and MCP server are available only to selected agents; idle sessions refresh on next prompt after plugin change; running turns are not interrupted implicitly; disabling plugin removes contributions.

## Verify

Lifecycle, tool execution, collision/unsupported-provider and real plugin-agent tests.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
