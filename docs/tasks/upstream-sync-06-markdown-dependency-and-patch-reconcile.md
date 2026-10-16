# Upstream sync 06: reconcile the markdown renderer swap and patch set

Status: **Proposed — awaiting review.** Follows the conflict resolutions in [Upstream sync: merge getpaseo/paseo main](../plans/upstream-sync-2026-10.md). Nothing here conflicts in git; it breaks the build if the install step is skipped.

## Outcome

After the merge, a clean install applies upstream's patch set, workspace declarations are current, and `npm run typecheck` is clean in `packages/app`. No fork-only patch or dependency is left pointing at a package that no longer exists.

## Evidence

Upstream `eb1a8a2ec` (`fix(markdown): one renderer on react-native-enriched-markdown for iOS, Android and web (#6973)`) replaced the markdown stack in `packages/app/package.json`:

- removed `react-native-markdown-display` and `react-native-uitextview`;
- added `react-native-enriched-markdown@1.2.0-nightly-20261014-766fc0e67`, `mdast-util-from-markdown`, `mdast-util-gfm-table`, `micromark-extension-gfm-table`, `micromark-util-decode-string`;
- added a top-level `enriched-markdown` config block (math off, code highlighting on with a fixed language list, video off).

`patches/` three-way:

| Patch                                                                   | Base | Fork | Upstream | Merged tree |
| ----------------------------------------------------------------------- | ---- | ---- | -------- | ----------- |
| `react-native-markdown-display+7.0.2.patch`                             | yes  | yes  | removed  | removed     |
| `@gorhom+bottom-sheet+5.2.14.patch`                                     | no   | no   | added    | added       |
| `react-native-enriched-markdown+1.2.0-nightly-20261014-766fc0e67.patch` | no   | no   | added    | added       |

The markdown-display patch came from upstream at the merge base; the fork never touched it (`git log 9ab99a6e1..origin/main -- patches/react-native-markdown-display+7.0.2.patch` is empty), and the fork has no local commits under `packages/app/src/components/markdown/`. The merged tree contains zero references to `react-native-markdown-display` or `react-native-uitextview`.

`scripts/postinstall-patches.mjs` gained 11 lines upstream — explicit `patchedPackages` entries (`patchPrefix`, `nodeModulesPath`, `cwd`) for the two new patches. The script only applies a patch when the dependency is installed, so a stale patch file is dead weight rather than a failure.

The gorhom patch is not cosmetic: it stops `BottomSheetModal` from overwriting a `DISMISSING` status with `MINIMIZED`, and it exports `BottomSheetModalInternalProvider`, consumed by `packages/app/src/components/ui/isolated-bottom-sheet-modal/host-scope.tsx` and stubbed in `packages/app/test-stubs/gorhom-bottom-sheet.ts`. Without the patch applied, typecheck and the isolated-sheet tests fail.

In the dry-run worktree, which reused the fork's `node_modules`, typecheck reported unresolved imports for the newly added package and its patched export. Those are install artifacts, not merge defects — but they are indistinguishable from real breakage unless the install is re-run.

## Proposed fix

After resolving the four conflicts and before committing the merge:

```bash
npm install          # postinstall applies patches via scripts/postinstall-patches.mjs
npm run build:client # refresh cross-workspace declarations
npm run typecheck
```

Then confirm:

- `ls node_modules/react-native-markdown-display` is absent and `node_modules/react-native-enriched-markdown` is present with the patch applied;
- `patches/` matches the `patchedPackages` list in `scripts/postinstall-patches.mjs` — no entry without a file, no file without an entry;
- the install-artifact typecheck errors are gone.

## Review

- **Decide whether the fork keeps any markdown customization.** It currently has none, so the swap is a straight take. If a fork-local markdown fix exists in a stash or an unmerged branch, it has to be re-expressed against the new renderer — flag it here rather than during the merge.
- The nightly dependency pin (`1.2.0-nightly-20261014-766fc0e67`) is upstream's choice. Confirm the fork's CI can resolve it; a private registry mirror may need the new package.
- Check whether the fork's `patches/react-native-markdown-display+7.0.2.patch` deletion is intentional in the fork's own history (it is, per the table above) so a reviewer does not restore it.

## Acceptance

- `npm install` succeeds and applies eight patches without warnings about missing packages.
- `npm run typecheck` is clean in `packages/app` apart from anything Task 05 has not yet fixed.
- Markdown unit tests pass: `packages/app/src/components/markdown/renderer.test.ts`, `part-groups.test.ts`, `html-ish.test.ts`.
- CI runs `packages/app/e2e/browser/plan-card-markdown.spec.ts` and `streaming-markdown.spec.ts` green.

## Focused checks

```bash
npx vitest run packages/app/src/components/markdown/renderer.test.ts --bail=1
npx vitest run packages/app/src/components/ui/isolated-bottom-sheet-modal --bail=1
npm run typecheck
npm run lint
npm run format:check
```

## Constraints

- Do not keep the removed markdown packages installed for compatibility.
- Do not hand-edit `node_modules`; changes go through `patches/` and `scripts/postinstall-patches.mjs`.
- Do not run the full e2e suite locally; use CI.

## Required context

- [Upstream sync plan](../plans/upstream-sync-2026-10.md)
- [Development setup](../development.md)
- [QA evidence bar](../qa.md)
- [Postinstall patch script](../../scripts/postinstall-patches.mjs)
