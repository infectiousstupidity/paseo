# Upstream adoption 05 — Live plugin subscriptions and binary transport

**Priority:** P1  
**Status:** Implemented on `main`; acceptance verification pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/18

## Outcome

Allow Shiori and other plugin surfaces to receive push events without polling, stream binary payloads over the existing daemon/client connection, and release subscriptions on unmount/disconnect/plugin stop.

## Upstream

- https://github.com/getpaseo/paseo/pull/8527 — selectively adapted; fork main `3e0bcb66` and upstream main `a449271d` checked 2026-11-07.

## Implementation — 2026-11-07

- `5acc3310` — plugin SDK subscription contracts, hook, server handler typing, protocol schemas, reserved binary frame opcodes/decoding and top-level `Uint8Array` value validation.
- `70e5d5fe` — plugin subprocess subscription handlers, buffered event handoff, timeout cancellation, stop/release cleanup and plugin service API, adjusted for fork-specific provider and hook lifecycles.
- `01943c7c` — daemon session subscription ownership, ordered replies and JSON/binary events, binary input routing through ordinary request authorization, permission revocation and socket cleanup.
- `9f4b63ee` — client RPC binary send/receive, reconnect-aware observed subscriptions, ownership and capability gate; adapted the fork's existing request send/wait semantics.
- `33e5c438` — app plugin installation lifetime, mounted panel subscription context, and typed client callbacks.
- `04a0909d`, `6572d2f2` — update existing fixtures and add focused SDK, session, and connection assertions.
- `35cf0ea0` — binary frame tests, plugin subscription unit/integration/performance tests and isolated Playwright panel journey.
- `c8580611` — diff-watch and binary media-stream example plugins used by the browser scenario.
- `5304be1d` — owning docs and plugin author skill reference.
- `dbec9f19` — fixed synchronous-invalid-event release and abort-listener cleanup, with targeted regressions (unexecuted).

Fork-specific: retained Shiori's independent global queue, Pi subagent controls, fork plugin hook/provider behavior, and existing workspace/session ownership. The fork has no `public-docs/` tree; documentation is kept in `docs/plugins.md` and the local `skills/paseo-plugin/` reference rather than inventing a duplicate website document tree.

## Acceptance and verification

**Committed but not executed in this environment.** GitHub-only repository access cannot run the fork's npm workspace: no targeted Vitest, typecheck, lint, formatting script, browser run, or real Shiori panel and reconnect test has been performed. The new commits have no verified passing CI result. Source-level patch reconciliation is not proof of runtime correctness.

Before closing #18, run the focused plugin contract/worker/runtime, binary-frame, session/permission, owned-subscription, reconnect, and browser tests; run repository typecheck/lint/format; and verify a real installed plugin panel receives ordered pushes, closes on unmount or plugin stop, resubscribes on reconnect, and roundtrips `Uint8Array` without nested byte acceptance or listener leaks. Also confirm ordinary RPC behavior on older clients.

The live Paseo daemon on port 6767 was **not** restarted. Keep this issue open and its tracker checkbox unchecked until acceptance evidence is recorded.
