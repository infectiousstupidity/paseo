# Pi import: recognize the right session

Status: **planned** (2026-10-10). Implement 05 then 06; neither depends on the optional Pi descriptor cache (performance Task 03). This is **user-facing identification**, not another session-loading optimization.

## Verified current behavior

- The import sheet is `packages/app/src/components/import-session-sheet.tsx`. It uses `AdaptiveModalSheet desktopMaxWidth={560}`; each row displays a one-line title, at most two prompt-preview lines, and relative activity time. A directory label appears only when results span workspaces. Pressing the row **immediately imports** it.
- `import-session-sheet-view-model.ts` prefers `entry.title`, then the first prompt. It has no notion of machine-generated subagent names, and does not avoid repeating a title as its preview.
- The Pi reader in `packages/server/src/server/agent/providers/pi/session-descriptor.ts` already reads **bounded** head/tail chunks to obtain saved `session_info` name, first/last user messages, and timestamps. It normalizes each returned prompt preview to **160 characters**. A longer preview can reuse the same read; a **complete** prompt is not currently available in the import descriptor.
- The cross-provider import descriptor exposes `providerId`, `providerHandleId`, `cwd`, `title`, first/last prompt previews, and `lastActivityAt`. It has **no authoritative parent session, task, agent status, model, or summary fields**. Do not pretend otherwise.
- This fork already implements Pi search, selected-provider requests, host-aware query keys, workspace prefiltering, and bounded directory/stat I/O. Preserve those paths. Performance is still not measured on the user's actual Windows Pi history.
- Current `nicobailon/pi-subagents` source derives a readable child `sessionName` from task/role, but its intercom compatibility fallback can still select the routing name such as `subagent-reviewer-<UUID>-1`. Verify the **installed** version/config before blaming Pi or adding a second session-naming system.

## Decisions after stress test

1. **Do not generate fake summaries.** Show the literal saved title when useful. For only a **strictly recognized** machine-style `subagent-<role>-<UUID>[-n]` name, surface its actual role and an existing prompt excerpt; retain the exact underlying name in the inspection details. Never overwrite persisted Pi names.
2. **Make identification easy before building hierarchy.** Widen the desktop modal via its existing per-instance width prop; keep the existing mobile sheet. Use clear title/prompt/time hierarchy and existing workspace labels, not card grids, repeated badges, or permanent inspector chrome.
3. **Keep one-click importing.** An optional disclosure/inspection control must be separate from the import action and must never accidentally import when expanded. Provide equivalent keyboard access.
4. **Do not group subagents under guessed parents.** The UUID-based intercom name identifies a routing target, not an authoritative parent relationship. Do not invent parent links or filter out children by default; user must still find the exact child to resume.
5. **No new load-time work.** Derive display strings from already returned descriptors; for Task 06, modestly increase Pi preview text returned from the **existing head/tail parse**, still bounded. No full JSONL read, bulk enrichment, new RPC, LLM summary, persistent index, or background job.
6. **Avoid mislabeling other providers.** Changes to machine-name detection are narrowly Pi-focused. Preserve human-assigned session names and imports for every provider.

## Ordered tasks

- [05 — Make rows identifiable](../tasks/pi-import-05-identifiable-sessions.md): desktop width, better real titles and excerpts, visible activity context, minimal view-model logic, existing click-to-import.
- [06 — Inspect before importing](../tasks/pi-import-06-inspect-session.md): accessible, user-triggered expansion to see longer **bounded** first/last excerpts, exact directory/date/original name; Pi-only preview length change without extra reads.

After 05, check **actual ambiguous sessions** from the user's screenshot. If title improvements from the installed `pi-subagents` version already solve the problem, skip any unnecessary presentation heuristics. After 06, if the existing bounded content is still not enough, first investigate fixing the **producer's child session naming**; do not silently expand the importer into a transcript browser.

## Acceptance and lean verification

User can distinguish multiple near-identical reviewer/worker sessions in the Shiori workspace, see their actual task clues and timestamps, and import the intended one. No new RPCs on opening/importing, no loss of older results, and no changes to normal human titles or the existing direct import action. Preview text must be accurately labeled as an **excerpt**, not the full conversation.

Reuse existing import-sheet/view-model tests and Pi descriptor tests. Add only one machine-title/normal-title case, one inspection-does-not-import interaction, and one bounded Pi preview/search fixture **if the corresponding code changes**. Run affected tests, relevant workspace typecheck and changed-file formatter check; manually inspect desktop and narrow layout with a few representative Pi sessions. No coverage targets, broad E2E suites, synthetic benchmark infrastructure, or arbitrary millisecond assertions.
