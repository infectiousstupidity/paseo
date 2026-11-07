# Upstream adoption 02 — Subagent launch markers and parent navigation

**Priority:** P1  
**Status:** Implemented on main; verification pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Keep the parent's timeline compact while making child activity and parent navigation accessible.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8276
- https://github.com/getpaseo/paseo/pull/7784

## Work

Compare packages/app/src/subagents, timeline projection and provider adapters to upstream. Preserve the fork's grouped Pi inspector, expanded rows, real status, Stop/Steer, explicit Open session and sheet/tab navigation. Avoid replacing its row components wholesale.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Parent cards stay small during long child runs; child transcript/status survive restart; Open parent works across workspaces; existing Pi actions and inspector interaction remain intact.

## Verify

Existing subagent adapter/unit tests, desktop and compact browser navigation, plus a real/captured child session.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.

## Implementation review — 2026-11-07

The fork already has projected child timelines, grouped Pi tracking, native Pi control targets,
explicit Open session, and separate Shiori task handling. Those systems remain intact. Selectively
adopted the two upstream fixes without merging upstream's entire provider implementations:

- `da56fcf6` — Parent navigation from managed subagent composer/sheets and provider-subagent panes.
  Uses the fork's global `navigateToAgent`, not upstream's absent `useLeaveSheet` hook.
- `32afaf35` — Parent navigation labels in all nine shipped languages.
- `744d6e38` — Claude sidechain emits tool actions into child timelines but does not append to
  or repeatedly emit the parent card. Focused tracker/sidechain tests updated.
- `865b38aa` — OMP task parent card keeps first-child metadata only, with no synthetic progress
  log or throttle queue. Focused tracker/mapper/history tests updated.
- `d3be63f7` — OpenCode task cards use empty logs; failed child output no longer extends them.
- `d5f67791` — Pi extension launch markers use empty logs; existing control adapters and
  independent Pi inspector/Stop/Steer remain untouched.
- `27730bc6` — Codex child events remain on their own projected timeline, while parent cards
  emit on changed label/status. Retained the fork's newer replay/ownership routing.
- `677a5c3d` — Non-expandable parent launch card rendering and wire-optional `sub_agent.log`;
  producers still send `log: ""` to older clients. Activity curator no longer duplicates child logs.
- `45cb60de` — Codex child timeline and parent-card regression assertions adapted for the fork.
- `2ad3aa85` — Desktop parent pill, compact sheet parent callout and real-provider browser
  navigation tests added.

- `f4077b1f` — Updated the owning lifecycle doc and aligned provider-panel JSX layout.
- `66318f05` — Removed obsolete translation labels and changed real Codex/Claude provider replay
  tests to verify child timelines rather than duplicated parent log strings.
- `8e76f453` — Added the upstream Codex child-compaction deduplication regression.
- `33defd0f` — Recorded complete QA blockers and coverage in this task document.
- `f8751a84` — Explicitly closes an originating compact sheet before navigating to its parent,
  including when the parent belongs to another workspace; navigation continues through the
  existing workspace resolution path.

Static checks: inspected the final GitHub source, verified the changed Codex path has no residual
child log or child-item accumulator methods, checked the fork's Pi control adapter was preserved,
and checked that the owning app pane and navigation hooks resolve in this fork. These are source
checks, **not passing automated tests**.

**Unverified/blockers:** GitHub-connected execution here cannot install/build the workspace or
run `npm run typecheck`, `npm run lint`, `npm run format`, targeted Vitest or real Playwright/Pi
sessions. No UI screenshots or real/captured child session replay were produced. GitHub reported no
CI check runs for the pushed head. The targeted tests are committed but were not executed. Follow up with
focused provider/adapter suites and app browser runs in the checkout, and test cross-workspace
parent navigation, compact sheet dismissal, nested-child replay, archived child reload and Pi
controls. No live Paseo daemon was restarted. Keep issue #15 open until these acceptance
conditions are demonstrated.
