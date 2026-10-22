# Pi subagent activity monitor — implementation plan

Status: **done** (2026-10-12). All three tasks committed on `main`; checked against `infectiousstupidity/paseo` main on 2026-10-12. This is about subagents spawned _by Pi_ and surfaced inside the existing Paseo composer track, not a separate dashboard or a change to Shiori.

## User outcome

The composer subagent popover should answer without opening a child session: **What is its task? Is it running, finished, failed or canceled? What was its most recent meaningful activity? What did it actually report, if known?** Opening the full session must remain obvious and one action away. Preserve the ordinary Paseo-managed child-agent experience and narrow/mobile surfaces.

## Verified starting points

- `packages/app/src/subagents/track.tsx` renders one-line labels and a trailing subtitle in `ComposerTrackPill`. `track-presentation.ts` currently derives status buckets. `select.ts` combines managed and provider-owned children.
- `packages/app/src/subagents/provider-store.ts` already receives **live provider-child timeline events**, holds descriptors/timelines, and has a scoped timeline-fetch path. `panels/provider-subagent-panel.tsx` can open the complete child. Use existing data before inventing a new service.
- The Pi adapter `packages/server/src/server/agent/providers/pi/extensions/pi-subagents/index.ts` polls async `status.json` using the existing `PiExtensionHost` 250 ms cadence. It emits repeated running upserts even if a step did not change, so the generic descriptor store's `updatedAt` can advance without meaningful activity. Never present it as a reliable last-action time.
- `packages/server/src/server/agent/providers/pi/extensions/child-session.ts` currently stops following after 200 projected timeline items or 2 MiB; a busy child can become silent before finishing. `PiExtensionHost` owns child-session following and completion cleanup; do not create an independent poller.
- Provider-owned "Archive finished" **hides** finished rows in the client store; it does not archive the underlying Pi sessions. Preserve this distinction and the current action semantics.
- A provider descriptor carries task `description`, agent-type `title`, lifecycle `status`, `createdAt`, an optional provider-controlled `subtitle`, and child identity. It does **not** guarantee implementer/reviewer/fixer role, model, progress percentage, semantic review verdict, or shared task-group identifier.
- `ComposerTrackPill` uses a max-width 620px, max-height 440px scrollable surface and compact sheet. `ComposerTrackRow` is itself pressable: never put another Pressable inside its navigation target.

## Scope / falsifiable design rules

1. Show actual lifecycle state distinct from _review outcome_. A successful process may have reported defects. Only show "tests passed", "changes committed", "0 findings", etc. if directly established by structured or explicit child evidence; otherwise use neutral "Finished" and/or "Last response".
2. Identify a child using its supplied task and agent type. Do not parse arbitrary task wording to classify roles, fabricate "C1/C2/C3" group relationships, display unknown models as real, or claim a progress percentage.
3. First derive bounded last-event detail from **existing** client timeline data, with a documented empty/older-history fallback. No summary LLM, tool-output dump, global rescans, per-child polling loops, new database, dashboard, or new dependency.
4. Limit list density: primarily task (up to two lines), state, agent type/available context, and a short latest meaningful event. Reveal further detail for only one child on request. Retain normal click-through to full session.
5. Keep parent/child identity, grouped fan-out, reconnect, completion, lifecycle transitions, client hiding, screen-reader semantics, keyboard focus, 360px compact width and server isolation intact.
6. Make runtime costs proportional to changed child state, not wall clock x number of children. Never subscribe every closed row to high-frequency streaming text or turn `updatedAt` into a heartbeat.
7. Bounded history and bounded **latest activity** are separate requirements. If the existing lifetime follower cap prevents current activity, fix it without unbounded full-timeline retention. Make protocol additions optional/backwards compatible _only if_ needed; prefer the current data path.
8. Keep tests focused on observable failures and regression risks. Do not add a new framework, broad test matrix, snapshot farms, or exhaustive coverage.

## Ordered implementation

1. [01 — Stop Pi status churn; preserve lifecycle truth](../tasks/pi-subagent-monitor-01-source-health.md)
2. [02 — Compact, meaningful subagent popover](../tasks/pi-subagent-monitor-02-compact-activity-ui.md)
3. [03 — Keep long-running child activity fresh](../tasks/pi-subagent-monitor-03-long-session-continuity.md)

These tasks are sequential. Commit each independently after checks, read the latest branch before starting the next task, and report deviations. Task 02 must work without Task 03's optional protocol shape; Task 03 only adds the smallest missing continuity mechanism. Do not broaden the work to other providers unless shared code requires a compatibility fix.

## Release acceptance

On a real Pi fan-out comparable to SEICHO's implementer / reviewer / fixer chain, the popover shows readable child tasks, authoritative state, and meaningful recent activity or an honest unavailable state. Mixed running/finished children remain distinguishable; a completed reviewer is **not** called approved. A long-running child remains fresh after the old caps. No duplicated update flood, stopped/failed child misreporting, per-row requests, hidden transcript truncation claims, broken archive/dismiss behavior, or degraded full-session navigation. Inspect at desktop and narrow widths. Report manual acceptance as **unverified** if no desktop runtime is available; do not claim it passed.

## Verification baseline

Existing focused tests: `packages/server/src/server/agent/providers/pi/extensions/pi-subagents/index.test.ts`, `packages/app/src/subagents/track-presentation.test.ts`, `packages/app/src/subagents/provider-store.test.ts`, `packages/app/src/panels/agent-panel-descriptor.test.tsx`, `packages/protocol/src/messages.provider-subagents.test.ts` if protocol changes. Prefer small additions to these tests. Source paths and available test commands must be rechecked if upstream merges move files.
