# Upstream sync 05: finish `subagents.panel` locale parity

Status: **Proposed — awaiting review.** Independent of the merge; land it on `main` first so the merge's verification signal is clean. Tracked in [Upstream sync: merge getpaseo/paseo main](../plans/upstream-sync-2026-10.md).

## Outcome

`npm run typecheck` and `packages/app/src/i18n/resources.test.ts` pass on the fork's `main`. The 29 `subagents.panel.*` keys exist in all nine supported locales.

## Evidence

This is a pre-existing fork failure, not merge fallout. On `origin/main` `c267f0cf2`:

- `npx tsgo --noEmit` in `packages/app` reports **8 `TS2741` errors** — `ar.ts:1897`, `es.ts:1945`, `fr.ts:1941`, `ja.ts:1916`, `ko.ts:1907`, `pt-BR.ts:1930`, `ru.ts:1929`, `zh-CN.ts:1875` — each "Property 'panel' is missing … but required in type `WidenStringLeaves<…>`". The resource type is derived from `en.ts`, so a key added to English is required everywhere.
- `npx vitest run packages/app/src/i18n/resources.test.ts` fails two cases:
  - "keeps all supported language keys in sync with English" (`resources.test.ts:148`) — 2105 keys in `ar` vs 2134 in `en`.
  - "preserves interpolation placeholders in every language" (`resources.test.ts:181`) — `expandDetails`, `collapseDetails`, `startedAgo`, `confirmStop`, `observedState`, `stateWithRun` lose their `{{label}}`, `{{age}}`, `{{state}}`, `{{runState}}` placeholders because the keys are absent.
- The keys came from the fork's `3a1a766fc` (`feat(subagents): guard Pi action eligibility and localize panel controls`), which touched `en.ts` only (+31 lines). `subagents.panel` does not exist upstream, so the merge cannot fix it; the merged tree still has it in `en` only.

## Proposed fix

Add the `panel` block from `packages/app/src/i18n/resources/en.ts:1944-1974` to `ar`, `es`, `fr`, `ja`, `ko`, `pt-BR`, `ru`, and `zh-CN`, translated:

`needsAttention`, `working`, `recentResults`, `expandDetails`, `collapseDetails`, `task`, `activity`, `outcome`, `resultUnavailable`, `provider`, `startedAgo`, `openSession`, `status`, `stop`, `stopping`, `confirmStop`, `confirmStopAction`, `cancelStop`, `steer`, `steerPlaceholder`, `sending`, `pending`, `observedState`, `stateWithRun`, `stopAccepted`, `delivered`, `queued`, `unavailableControl`, `actionFailed`.

Keep every interpolation placeholder verbatim. Match the wording already used in each locale for the neighboring `subagents.*` keys (`title`, `detachAction`, `archiveTooltip`, `activityLastResponse`) so a panel does not mix two translations of "subagent".

## Review

- **No English-fallback escape hatch.** The parity test is the repo's bar ([docs/i18n.md](../i18n.md)); a missing key is a failing test, not a runtime fallback. Do not add optional typing or a `Partial` resource to dodge it.
- Check the two strings most likely to drift in meaning rather than wording: `activity` ("Observed activity") and `outcome` ("Last observed result"). They describe client-observed child state, not agent-authored text — confirm each translation does not read as the child's own statement.
- `confirmStop` carries the "cannot be resumed as a paused child" consequence. Keep that clause; dropping it makes a destructive action look reversible.
- If a reviewer would rather the panel keys never reach other locales, the alternative is deleting the fork's panel feature — not a real option. State any narrower scope you choose.

## Acceptance

- `npx vitest run packages/app/src/i18n/resources.test.ts --bail=1` green, including the placeholder case.
- `npm run typecheck` reports zero `TS2741` in `packages/app/src/i18n/resources/`.
- No English string left visible in a non-English locale for the subagents panel.

## Focused checks

```bash
npx vitest run packages/app/src/i18n/resources.test.ts --bail=1
npm run typecheck
npm run lint -- packages/app/src/i18n/resources
npm run format:files -- packages/app/src/i18n/resources
```

## Constraints

- Touch only the eight locale resources. No change to the resource type, the parity test, or call sites.
- Do not translate provider names, model names, or agent output.

## Required context

- [I18n](../i18n.md)
- [Glossary](../glossary.md)
- [English resources](../../packages/app/src/i18n/resources/en.ts)
- [Resources parity test](../../packages/app/src/i18n/resources.test.ts)
