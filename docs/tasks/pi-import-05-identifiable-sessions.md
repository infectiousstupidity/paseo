# Pi import 05 — Make session rows identifiable

Status: **ready**. Run before [06](./pi-import-06-inspect-session.md). Read the single authoritative [implementation plan](../plans/pi-import-session-identification.md) for the verified code path, trade-offs and exclusions.

## Change

1. In `packages/app/src/components/import-session-sheet.tsx`, change this sheet's `desktopMaxWidth={560}` to approximately `820`, without editing the shared `AdaptiveModalSheet` or changing compact-sheet scrolling.
2. In `packages/app/src/components/import-session-sheet-view-model.ts`, add a tiny Pi-only display derivation: preserve useful saved titles; for an **exact recognized** `subagent-<role>-<canonical UUID>[-index]` title, show role instead of routing ID while retaining the original `entry.title` for 06. Do not guess tasks, rewrite arbitrary/provider titles, or assume a parent relationship.
3. Keep the existing last **user** prompt as the primary excerpt (two lines) and optionally show the first excerpt (one line) when truly distinct. Avoid duplicate title/preview text, preserve current sorting, provider icons, cross-workspace folder labels and single-press row import. Use theme tokens, not custom mock CSS.
4. In `packages/server/src/server/agent/providers/pi/session-descriptor.ts`, guard the **unnamed title fallback**: `tailInfo.title ?? headInfo.title ?? headInfo.firstUserMessage` can return a full raw prompt as a title even when preview fields are bounded. Replace only the final fallback with a short normalized excerpt; preserve actual `session_info` names and import-time model/thinking restoration.
5. Check installed `pi-subagents` naming behavior if available. A current upstream naming feature is not proof that all historical sessions have human-readable names.

## Verify, minimally

- One view-model test: ordinary title, generated Pi machine title, malformed/other-provider title, duplicate excerpts.
- One Pi JSONL fixture assertion for bounded **fallback title**, without broadening the descriptor suite.
- Reuse existing import-sheet interaction coverage for the same `providerHandleId`; typecheck affected app/server packages and check changed-file formatting.
- Manually inspect several real Shiori reviewer/worker rows at desktop and narrow width; opening/listing must not cause new RPCs or file reads.

**Done:** sessions are more recognizable; ordinary titles/imports are unchanged; no new dependencies, summary generation, grouping, or backend reads. Do not start 06 until the row layout is reviewed.
