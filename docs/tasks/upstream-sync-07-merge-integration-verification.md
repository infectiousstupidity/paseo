# Upstream sync 07: finish integration verification and fork delivery

Status: **Pending — blocked on 06, 08, 09 and quality-gate sign-off.** Tasks 01–05 and the first merge are already implemented. [Task 08](upstream-sync-08-subagents-compact-feedback.md) now owns the next merge; this task verifies and delivers the resulting branch. Current refs, evidence, and ordering: [upstream sync plan](../plans/upstream-sync-2026-10.md).

## Outcome

The fork includes the reviewed origin and upstream tips without losing its features, dependencies and release metadata are coherent, required checks have actual evidence, and the published fork tip has green CI.

## Preconditions

- Use a clean integration checkout containing the operator's intended work. Do not stage or stash unrelated edits from the current dirty checkout. Do not run destructive installs in it.
- [06](upstream-sync-06-markdown-dependency-and-patch-reconcile.md), [08](upstream-sync-08-subagents-compact-feedback.md), and [09](upstream-sync-09-windows-lint-rule-runner.md) are committed. No merge remains in progress.
- Fetch both remotes again. At review, origin is `7c35c4a8f`, upstream is `9a0b95aa1`. If either moved beyond the integrated tips, review the new delta and update the plan instead of silently resolving it here.
- Establish the quality baseline. Root typecheck currently passes, but root lint has 44 existing failures outside the new upstream rule. They are not blanket waivers. Keep green-CI sign-off blocked until the owning fork changes clear the quality gate; do not add suppressions or broaden this verification task into unrelated provider refactors.

## Ancestry and semantic audit

```bash
git status --short
git fetch origin
git fetch upstream
git merge-base --is-ancestor 7c35c4a8f HEAD
git merge-base --is-ancestor 9a0b95aa1 HEAD
git rev-list --count HEAD..origin/main
git rev-list --count HEAD..upstream/main
git diff 9a0b95aa1 HEAD -- packages/app/src/agent-stream/model.ts
git diff f8d30c62d HEAD -- packages/app/src/runtime/replica-cache
```

The two counts must be zero at the reviewed refs. The model diff is empty. For this sync, upstream changed no cache file, so the cache diff against `f8d30c62d` must also be empty. **Do not require the cache to equal upstream**: that would delete the completed Task 03 overlay.

Audit the merge relative to `23e388b05`, checking both clean and conflicted overlaps from the plan. Confirm:

- Upstream's compact row geometry and shared button feedback coexist with the fork's wide inspector, grouping, disclosure, and Pi controls.
- Sheet/tab navigation from Task 04 and the sibling action press boundary survive.
- Touch composer blur coexists with fork modifier-key propagation; git actions are not duplicated; Korean terminal selection keeps width-zero continuation cells.
- 0.12.0 manifests retain fork-specific scripts/dependencies. The merged lockfile and Nix dependency hash match the effective dependency graph. Use the existing Nix CI/workflow to verify the hash; do not assume an upstream hash proves a fork-modified manifest.
- Origin's archive-fencing fix and the fork's Windows/plugin changes remain present. A large `git diff upstream/main --stat` is expected for a feature fork; inspect the deltas rather than accepting/rejecting solely by directory name or blob identity.

## Focused local verification

Install/build in the integration checkout. Reuse green results recorded by the implementation tasks on the same final tree where still applicable; do not repeat broad suites.

```bash
npm ci
npm run build:server
npm run typecheck
npm run lint
npm run format:check
node --test scripts/postinstall-patches.test.mjs scripts/oxlint/paseo-plugin.test.mjs scripts/ci-workflow.test.mjs
(cd packages/app && npx vitest run src/runtime/replica-cache/index.test.ts src/agent-stream/model.test.ts src/agent-stream/strategy-web.test.tsx src/i18n/resources.test.ts --bail=1)
(cd packages/app && npx vitest run src/git/policy.test.ts src/terminal/native-renderer/terminal-selection.test.ts src/components/markdown/renderer.test.ts --bail=1)
```

Record failures with exact commands and separate baseline problems from introduced failures. A baseline failure still blocks its quality gate; do not label the complete check green. If cross-workspace types are stale, rebuild the owning stack before diagnosing source defects.

## Browser, provider, native, and CI evidence

The ordinary app Playwright project runs Chromium with isolated harness daemons; no mobile emulator is required. Use the existing scripts, from the repo root:

```bash
npm run test:e2e --workspace=@getpaseo/app -- e2e/browser/subagent-detach.spec.ts e2e/browser/subagent-origin-pane.spec.ts e2e/browser/archive-finished-subagents.spec.ts e2e/browser/compact-workspace-sheet.spec.ts
npm run test:e2e --workspace=@getpaseo/app -- e2e/browser/compact-git-actions-menu.spec.ts e2e/browser/composer-focus.spec.ts e2e/browser/plan-card-markdown.spec.ts e2e/browser/streaming-markdown.spec.ts
npm run test:e2e:real --workspace=@getpaseo/app -- e2e/browser/provider-subagents.real.spec.ts
```

These are targeted specs, not permission to run the whole E2E suite locally. Reuse Task 08's passing browser evidence where applicable. The default `test:e2e` command excludes `*.real.spec.ts`; the real-provider command above needs the actual provider environment. Missing credentials must be reported, not hidden by new auth gates or skips. Ordinary browser CI does not provide this evidence automatically.

Record Android evidence for `e2e/mobile/agent-device/native-terminal-word-selection.android.ad` and native subagent action feedback using the existing mobile harness and [mobile testing guide](../mobile-testing.md). State what was covered on iOS, web, and Electron per [QA](../qa.md); a compact browser viewport does not establish native feedback or keyboard behavior.

After local verification, publish only to the fork and inspect the existing CI run on the exact final SHA. Full unit suites, broad browser coverage, and package/Nix checks run in the existing workflows, not locally. If the fork remote advances before push, reconcile it normally, recheck the affected surface, and verify CI on the final combined tip.

## Acceptance

- Reviewed origin and upstream tips are ancestors of the delivered fork branch; no source history is rewritten or lost.
- Completed Tasks 01–05 remain satisfied, with the intentional replica-cache delta preserved.
- Tasks 06, 08, and 09 have verification evidence. No install/start failure is mistaken for a patch/lint result.
- Focused checks, targeted browser/real-provider runs, and required native evidence are recorded honestly. Root typecheck/lint/format gates and fork CI are green on the delivered tip.
- If baseline lint, credentials, devices, or CI availability prevent sign-off, leave this task blocked and name the outstanding gate instead of declaring the sync done.

## Rollback and constraints

Before a merge commit, use `git merge --abort` in its integration checkout. After publishing, revert the actual merge with `git revert -m 1 <merge-sha>`; never force-push fork main to undo it. Do not push to upstream, open an upstream PR, restart either live daemon, or run full local suites.

## Completion

Update this task and the plan with final commit IDs, commands, output/artifact links, platform coverage, and the fork CI URL. Publish only with the operator's delivery authorization; never infer permission to include unrelated dirty work.
