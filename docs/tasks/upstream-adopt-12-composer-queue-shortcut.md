# Upstream adoption 12 — Alternate Send action for current-agent queue

**Priority:** P3  
**Status:** Planned  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Let touch users queue a follow-up with long-press Send while an agent is running.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/7897

## Work

Inspect existing queue/steer/interrupt dispatch and shortcuts; add only the missing alternate action. Current-agent queue is NOT Shiori's global task queue or scheduling system. Keep one dispatch path for touch and keyboard.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Steer/Interrupt default: tap unchanged, long press queues; Queue default: long press sends now; idle long press sends normally; no accidental duplicate/stop.

## Verify

Composer action tests and compact touch browser/native check.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.
