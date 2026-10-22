# Upstream sync 05: finish `subagents.panel` locale parity

Status: **Done — implemented in `6fc9e613e`, already an ancestor of `main`.** No translation work remains in this task. Tracked in the [upstream sync plan](../plans/upstream-sync-2026-10.md).

## Outcome

All 29 `subagents.panel.*` keys exist in Arabic, Spanish, French, Japanese, Korean, Brazilian Portuguese, Russian, and Simplified Chinese as well as English. The locale-parity failure described in the original task was fixed before the first upstream merge.

## Verification (2026-10-19 refresh)

- `git merge-base --is-ancestor 6fc9e613e HEAD` succeeds.
- `6fc9e613e` changes only the eight non-English locale resources.
- An inspection loading the current resource exports found 29 panel keys in each locale, zero missing English panel keys, and zero interpolation-placeholder mismatches.
- Root `npm run typecheck` passes across all workspaces on the current checkout.
- The previous resolution verification recorded 39 passing tests in `src/i18n/resources.test.ts`. That historical test result was not re-run during this documentation refresh; the resource inspection above checks panel keys/placeholders, not linguistic quality or the full i18n suite.
- Upstream `23e388b05..9a0b95aa1` changes no locale resource. There is no new parity task for these seven commits.

For future changes, run from `packages/app`:

`npx vitest run src/i18n/resources.test.ts --bail=1`

## Constraints retained

Keep translation placeholders verbatim and the stop-confirmation consequence intact. Do not weaken resource typing or parity tests to permit English-only panel keys. Provider names and agent-authored output remain untranslated.

## Required context

- [I18n](../i18n.md)
- [English resources](../../packages/app/src/i18n/resources/en.ts)
- [Resources parity test](../../packages/app/src/i18n/resources.test.ts)
