# Pi subagent monitor 03 — Fresh activity beyond transcript limits

Status: **done** (2026-10-12). Depends on [02](./pi-subagent-monitor-02-compact-activity-ui.md) and follows the [plan](../plans/pi-subagent-monitor.md).

## Problem proven in source

`PiChildSessionFollower.readNew()` returns no more events after **200 mapped items** or **2 MiB total read**. This lifetime budget is useful for history protection but can make an actively running child appear frozen. Merely raising/removing it can instead make server timeline memory, wire traffic and UI state grow indefinitely. The user needs _latest activity_, not the whole transcript duplicated in a popover.

## Code to inspect

- `packages/server/src/server/agent/providers/pi/extensions/child-session.ts` and `host.ts`.
- `packages/server/src/server/agent/provider-subagents/store.ts` and `agent-timeline-store.ts`.
- `packages/app/src/subagents/provider-store.ts` and Task 02's projection.
- `packages/protocol/src/messages.ts` provider-subagent descriptor/update schemas, only if a small optional activity field is unavoidable.
- Existing Pi async/foreground/replay and protocol compatibility tests.

## Implement

1. Reproduce _both_ stopping conditions with small synthetic append-only JSONL fixtures: >200 mapped rows and >2 MiB, including an active tool action appended **after** each limit. Verify old behavior and state the source of UI freshness (streamed cached history vs post-cap summary).
2. Keep live monitoring fresh using the **existing child-session follower and host cadence**. Separate the lifetime cap on **retained full timeline** from a bounded current-activity projection. Pick the least invasive implementation based on actual store behavior: e.g. continue incrementally consuming later append-only records while emitting only small state changes after history limits. Do not replay/export the entire transcript, forward unbounded tool output, retain all appended rows in memory, start a second poller, or add per-row network requests.
3. If the live UI cannot reuse existing timeline events efficiently, introduce the _smallest_ additive optional descriptor activity payload (short event kind/label and real timestamp, optional explicit final response excerpt). Keep an older daemon/client functional; add one protocol compatibility test only if the protocol changes. Never write activity into `subtitle` then parse it on the client, interpret encrypted reasoning, or guess task success.
4. Bound incremental reads and buffering; handle partial JSONL rows, huge single lines, missing/unreadable files, temporary disconnects, append-after-limit, truncated/replaced files, and finished-follow cleanup without infinite tight loops, duplicate events, stale activity falsely labeled current, or leaked file handles. Preserve existing replay/hydration limits. A rotating last-K projection is acceptable; an unbounded in-memory session history is not.
5. Preserve independent fan-out child identities and status/notice handling from Task 01. Do not change Pi's session files or unrelated provider subagent adapters. Ensure terminal action is not lost when it arrives after a large transcript. Report an unavailable/stale activity indicator rather than inventing work when tracking genuinely cannot resume.
6. Inspect resource behavior for one busy child and a moderate fan-out (~10 children), comparing before/after: number of duplicate upserts, bounded per-tick read work, retained server timeline growth, client update count, and eventual memory behavior. Do not require a huge benchmark suite; a focused synthetic long-file test and simple counters are enough.

## Acceptance and minimal tests

- Activity still advances after each former cap, but the cached/full timeline, payload size and memory do not grow without bound just to support a two-line popover.
- At least one synthetic long-run + late append test, one partial/terminal/missing-file regression, and targeted existing Pi adapter/store suites pass. Old clients remain compatible if an optional field is introduced.
- No CPU polling spike on unchanged files, no duplicate finish/failure events, no stale `updatedAt` presented as progress, and no regression to provider-subagent full-session opening.
- Relevant typecheck and changed-file lint/format pass. Perform real desktop + narrow layout check where possible, otherwise report manual check as pending; link commits and record any accepted limitations.

Commit this task alone. Update task status and plan with exact measured evidence and any explicitly deferred limitation. Stop and report if the only implementation would require a large new history storage system: do not silently reinvent one.

## Result

Committed on `main`. The existing follower and 250 ms host cadence are unchanged in shape; the lifetime caps now bound only the **retained** timeline, and a bounded `activity` field on the descriptor upsert keeps the row's latest activity fresh for as long as the transcript grows.

### What changed

- `packages/server/.../pi/extensions/child-session.ts`: after the retention caps, `PiChildSessionFollower` keeps consuming the append-only tail in bounded 256 KiB windows (initial hydration read is still at most 2 MiB) and reports the newest completed tool call as a small activity upsert, deduped by kind + label so unchanged activity never re-upserts. Retention stops at **200 items or 2 MiB of transcript bytes** (file offsets, so retained content stays within ~2 MiB even with large rows). Partial-row, huge-line, missing-file, and truncated/replaced-file handling preserved; a truncated file still stops the follower rather than guessing.
- `packages/protocol/src/messages.ts`: optional nullable `activity: { kind: "tool"; label: string; at: string }` on the provider-subagent descriptor payload. Older daemons omit it, pre-existing clients ignore it; one protocol compatibility test covers both directions.
- `packages/server/.../provider-subagents/store.ts`: `ProviderSubagentRow` carries `activity` (sticky partial-upsert contract, same as the other fields).
- `packages/app/src/subagents/subagent-activity.ts` (+ tests): the popover projection now takes the fresher of the descriptor activity and the Task 02 timeline-tail projection. For a finished child the tail's final response keeps precedence when it is as fresh or newer, so a completed child still ends on its response, not on a tool call.
- Exact lifecycle-sequence assertions in the three Pi adapter test files filter to upserts that carry a `status`, because activity-only upserts legitimately carry none.

### Behavior decisions

1. **Activity is the newest completed tool call** (kind `"tool"`), not a rotating last-K window and not unbounded history: it is identical whether observed live or on replay, bounded by construction (short label + timestamp), and a finished child's final response is already shown through the retained timeline + Task 02 projection whenever the session fits inside the caps.
2. **The byte cap counts transcript bytes consumed into the retained timeline** (file offsets), matching the pre-existing cap semantics exactly; the item cap is unchanged. Consumption and activity continue past both caps; retention does not.
3. **Dedupe at the follower boundary** (`emitted` state, kind + label): the task 01 churn lesson applied to the follower path — an unchanged file produces zero events, an unchanged activity produces zero upserts.
4. **Unavailable, not invented**: when the file is truncated/replaced the follower stops and the row keeps its last reported activity (never relabeled); when nothing has been observed the field is absent and the client falls back to the timeline tail.

### Measured evidence (focused synthetic run, simple counters)

One busy child: 11 MiB append-only transcript (400 KiB assistant lines + 28 distinct tool calls), follower ticked until drained, then a **late terminal tool appended after every cap**:

| counter                       | value                     | before this change                    |
| ----------------------------- | ------------------------- | ------------------------------------- |
| activity upserts              | 2 (deduped; final label)  | frozen at the cap — no further events |
| retained timeline items       | 11 (≈2 MiB transcript)    | ≤200 items / ≤2 MiB, then nothing     |
| wire bytes (all ticks)        | 2.34 MiB                  | ≈2 MiB, then 0 forever                |
| max per-tick read             | 2 MiB (initial hydration) | 2 MiB (unchanged)                     |
| steady-state per-tick read    | ≤256 KiB                  | 0 (follower stopped consuming)        |
| final activity after all caps | the late terminal tool    | stale: last tool inside the 2 MiB cap |

Fan-out of 10 children (2 MiB transcript each + a late tool append each): **exactly 1 activity upsert per child** (10 total, deduped), 200 retained items per child (per-child caps unchanged), 2000 timeline events total.

### Verification evidence

- `child-session.test.ts` (new): activity after the 200-item cap without timeline growth, activity after the 2 MiB cap with bounded per-tick reads, partial row held until newline, >1 MiB single line dropped without stalling, truncated/replaced file stops without looping, missing file returns no events — all pass.
- Server Pi extension suites: 53/53 pass (`src/server/agent/providers/pi/extensions`). The three `session-descriptor.test.ts` failures are pre-existing/environmental (git worktree tests on this Windows box); verified identical with this change stashed.
- App: `src/subagents` 120/120 pass (incl. new freshness/precedence tests), i18n suites pass.
- Protocol: `messages.provider-subagents.test.ts` 3/3 incl. the new compatibility test. One pre-existing flake remains: `messages.providers-snapshot.test.ts` "accepts a bodyless announcement..." times out (5 s) on the lazy 4.8 MiB AOT validator import under full-suite load; it passes standalone and also fails on a clean tree with this change stashed — unrelated.
- `tsgo --noEmit` clean for app and server; `oxlint` 0 warnings/errors and `oxfmt` applied on all 14 changed files.
- Desktop + narrow-width visual check: **pending** (needs a real daemon with a long-running Pi child; no desktop runtime in this session).

Accepted limitation: for a child whose transcript exceeds the caps, the _final response_ is not part of the retained timeline, so the popover's last line for a finished over-cap child is its final **tool call**, while inside-cap children still end on their response excerpt.
