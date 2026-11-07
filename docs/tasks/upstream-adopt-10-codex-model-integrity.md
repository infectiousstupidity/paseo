# Upstream adoption 10 — Codex histories, diffs, interrupts and actual model

**Priority:** P2  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Keep long Codex sessions fast and truthful, including patch diffs and the actual model after imports or unavailable selections.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8171
- https://github.com/getpaseo/paseo/pull/8132
- https://github.com/getpaseo/paseo/pull/8613
- https://github.com/getpaseo/paseo/pull/7525
- https://github.com/getpaseo/paseo/pull/8948
- https://github.com/getpaseo/paseo/pull/8957

## Work

Inspect Codex provider import/history/interrupt, timeline projection and model handling. Preserve the fork's custom providers and model/reasoning controls. Keep provider truth distinct from requested selection and avoid duplicating history stores.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Long session reopens without whole-thread history retention; multi-file patches show; interrupted shell commands end; imported native model and fallback actual model are displayed accurately.

## Verify

Seeded long-session, patch, interrupt, import and effective-model regressions.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
