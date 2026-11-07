# Upstream adoption 03 — Show and stop provider background commands

**Priority:** P1  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Display real background commands/monitors after the foreground turn finishes, with individual Stop where supported.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/6220

## Work

Compare upstream background-work inventory, providers, SDK and composer track against the fork's lifecycle. Upstream covers Claude, Codex and OpenCode v2; do not pretend it exposes Pi commands. Preserve fork's guarded 15-minute idle-runtime suspension; no second runtime collector.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Visible background work keeps agent/workspace running; stopping one does not stop siblings or unrelated foreground work; suspension does not kill protected work; unsupported providers have no false control.

## Verify

Provider inventory/stop tests and an isolated two-background-command browser scenario with reconnect.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
