# Upstream adoption 05 — Live plugin subscriptions and binary transport

**Priority:** P1  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Allow Shiori panes to receive server push events without polling RPCs and transport binary payloads directly.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8527

## Work

Review packages/plugin/src, server plugin RPC transport and packages/app/src/plugins. Adopt narrowly defined subscription contracts and cleanup. Top-level Uint8Array crosses as bytes; nested bytes must fail validation. Do not build a separate Shiori event transport.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Subscribed panel gets ordered live updates, unsubscribes on unmount/disconnect, resubscribes safely; existing RPCs still work; binary roundtrip works; no leaked listeners.

## Verify

SDK/transport tests, reconnect tests and one actual plugin panel journey.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
