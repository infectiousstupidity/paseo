# Pi import 05 — Make session rows identifiable

Status: **blocked** pending required manual desktop and narrow-width review. Do not start [06](./pi-import-06-inspect-session.md) yet. Read the single authoritative [implementation plan](../plans/pi-import-session-identification.md) for the verified code path, trade-offs and exclusions.

Visual reference: [interactive Import session HTML mock](../mockups/import-session.html). Use its overall width, row hierarchy and typography as a target, **not** its custom CSS/JS or fictitious data. The [implementation plan](../plans/pi-import-session-identification.md) governs real behavior.

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

## Implementation and verification status

The UI/server changes are implemented. Automated checks passed except for the pre-existing nested-directory discovery failures in the full Pi descriptor suite. The required visual review of real Shiori reviewer/worker rows is still outstanding.

- Passed: app view-model tests (56), import-sheet tests (28), targeted Pi fallback/model-restoration tests (3), app/server typechecks (after `npm run build:client`), changed-file lint, and LSP diagnostics (0 findings).
- The full `session-descriptor.test.ts` run fails in existing nested-session-listing cases. `walkJsonlFiles()` advances by the concurrency batch size, so recursively queued directories are skipped; this is outside task 05 scope.
- Manual review was blocked: Paseo workspace scripts ran under Windows `cmd.exe` and failed on the POSIX environment assignments. Starting Expo directly served the app, but its bootstrap probe to `localhost:6767` failed, so no Shiori rows were available to inspect at desktop or narrow width. The Expo process was stopped.
- No new RPCs or session-file reads were added. No task commit was made because the required visual acceptance check remains blocked.
