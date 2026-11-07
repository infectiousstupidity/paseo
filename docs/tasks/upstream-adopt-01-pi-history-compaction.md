# Upstream adoption 01 — Pi compaction history, queued prompts and images

**Priority:** P1  
**Status:** Implemented on main; targeted CI and real Pi replay evidence pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Preserve complete Pi chat history across compaction/reopen; dispatch prompts sent during /compact only after it completes; keep tool-result images visible.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8523
- https://github.com/getpaseo/paseo/pull/7848
- https://github.com/getpaseo/paseo/pull/8280

## Work

Review packages/server/src/server/agent/providers/pi/ history, runtime, RPC and extension mapping. Compare native ancestry/rewind with upstream; port only missing fixes. Preserve fork-specific Pi subagent controls and telemetry. Do NOT implement #8176: edxeth/pi-subagents is unused.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Reopened compacted sessions show original messages and correct message IDs; prompts during compaction wait, cancel safely and dispatch once; tool-result images persist live and after reload.

## Verify

Focused Pi history/compaction/image tests and a captured or real Pi session replay.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.

## Implementation and verification status (2026-11-07)

- Selective port of persisted Pi ancestry for full history across compaction, with native user-entry IDs and invalid-branch rejection.
- Out-of-band manual compaction now gates queued prompt submission; waiting prompts re-check cancellation and session closure. Failures still emit the compaction error and release queued prompts.
- Pi tool-result images use the fork's existing synchronous image materializer in live events and native replay, preserving tool ordering, without importing upstream's asynchronous output queue. Extension mapping and fork-specific subagent controls are unchanged.
- Source baseline: fork `main` tree `2175e5c3d67205dfd839dc9e9fc7b0324de44644`; upstream `main` tree `751dc82e6c4d113b357a80593089b935113aa65c`.
- Verification: static transformations checked against exact fork anchors. Local npm/typecheck/lint/real Pi sessions are **not available through this GitHub-only execution environment**. CI must validate the commit; a real Pi replay remains required before closing #14. Live daemon was not restarted.

Initial implementation commit: [`7a97dd34`](https://github.com/infectiousstupidity/paseo/commit/7a97dd34ce768649c0b385cda5106f7f8c19407a).

Targeted regression coverage added in `agent.test.ts` (success, failed compaction, Stop,
closure, and live images), `transcript.test.ts` (compaction, rewind and corrupt ancestry),
`history-mapper.test.ts` (image order and rematerialization), and
`tool-call-mapper.test.ts` (base64 cleanup). Tests are written but not executed
here; a provider replay and passing CI are still needed to establish acceptance.
