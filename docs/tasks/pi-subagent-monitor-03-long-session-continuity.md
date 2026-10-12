# Pi subagent monitor 03 — Fresh activity beyond transcript limits

Status: **ready; not implemented**. Depends on [02](./pi-subagent-monitor-02-compact-activity-ui.md) and follows the [plan](../plans/pi-subagent-monitor.md).

## Problem proven in source

`PiChildSessionFollower.readNew()` returns no more events after **200 mapped items** or **2 MiB total read**. This lifetime budget is useful for history protection but can make an actively running child appear frozen. Merely raising/removing it can instead make server timeline memory, wire traffic and UI state grow indefinitely. The user needs *latest activity*, not the whole transcript duplicated in a popover.

## Code to inspect

- `packages/server/src/server/agent/providers/pi/extensions/child-session.ts` and `host.ts`.
- `packages/server/src/server/agent/provider-subagents/store.ts` and `agent-timeline-store.ts`.
- `packages/app/src/subagents/provider-store.ts` and Task 02's projection.
- `packages/protocol/src/messages.ts` provider-subagent descriptor/update schemas, only if a small optional activity field is unavoidable.
- Existing Pi async/foreground/replay and protocol compatibility tests.

## Implement

1. Reproduce *both* stopping conditions with small synthetic append-only JSONL fixtures: >200 mapped rows and >2 MiB, including an active tool action appended **after** each limit. Verify old behavior and state the source of UI freshness (streamed cached history vs post-cap summary).
2. Keep live monitoring fresh using the **existing child-session follower and host cadence**. Separate the lifetime cap on **retained full timeline** from a bounded current-activity projection. Pick the least invasive implementation based on actual store behavior: e.g. continue incrementally consuming later append-only records while emitting only small state changes after history limits. Do not replay/export the entire transcript, forward unbounded tool output, retain all appended rows in memory, start a second poller, or add per-row network requests.
3. If the live UI cannot reuse existing timeline events efficiently, introduce the *smallest* additive optional descriptor activity payload (short event kind/label and real timestamp, optional explicit final response excerpt). Keep an older daemon/client functional; add one protocol compatibility test only if the protocol changes. Never write activity into `subtitle` then parse it on the client, interpret encrypted reasoning, or guess task success.
4. Bound incremental reads and buffering; handle partial JSONL rows, huge single lines, missing/unreadable files, temporary disconnects, append-after-limit, truncated/replaced files, and finished-follow cleanup without infinite tight loops, duplicate events, stale activity falsely labeled current, or leaked file handles. Preserve existing replay/hydration limits. A rotating last-K projection is acceptable; an unbounded in-memory session history is not.
5. Preserve independent fan-out child identities and status/notice handling from Task 01. Do not change Pi's session files or unrelated provider subagent adapters. Ensure terminal action is not lost when it arrives after a large transcript. Report an unavailable/stale activity indicator rather than inventing work when tracking genuinely cannot resume.
6. Inspect resource behavior for one busy child and a moderate fan-out (~10 children), comparing before/after: number of duplicate upserts, bounded per-tick read work, retained server timeline growth, client update count, and eventual memory behavior. Do not require a huge benchmark suite; a focused synthetic long-file test and simple counters are enough.

## Acceptance and minimal tests

- Activity still advances after each former cap, but the cached/full timeline, payload size and memory do not grow without bound just to support a two-line popover.
- At least one synthetic long-run + late append test, one partial/terminal/missing-file regression, and targeted existing Pi adapter/store suites pass. Old clients remain compatible if an optional field is introduced.
- No CPU polling spike on unchanged files, no duplicate finish/failure events, no stale `updatedAt` presented as progress, and no regression to provider-subagent full-session opening.
- Relevant typecheck and changed-file lint/format pass. Perform real desktop + narrow layout check where possible, otherwise report manual check as pending; link commits and record any accepted limitations.

Commit this task alone. Update task status and plan with exact measured evidence and any explicitly deferred limitation. Stop and report if the only implementation would require a large new history storage system: do not silently reinvent one.
