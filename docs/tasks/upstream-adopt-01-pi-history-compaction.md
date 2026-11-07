# Upstream adoption 01 — Pi compaction history, queued prompts and images

**Priority:** P1  
**Status:** Planned  
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
