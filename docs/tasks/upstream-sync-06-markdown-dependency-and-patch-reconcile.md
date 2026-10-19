# Upstream sync 06: finish dependency and patch reconciliation

Status: **Complete — Windows installer fix and clean-install verification passed (2026-10-19).** Independent prerequisite for [Task 08](upstream-sync-08-subagents-compact-feedback.md). Tracked in the [upstream sync plan](../plans/upstream-sync-2026-10.md).

## Outcome

The patch installer launches the checkout's installed patch-package reliably on Windows and POSIX, never deletes dependencies because the tool could not start, and still removes a package when its patch genuinely rejects. A clean install can then verify the renderer and sheet patches without manual repair of node_modules.

## Current evidence (2026-10-19)

- The enriched-markdown migration (#6973) and its later patch-path update (#7298) are already in `69359e8cb`. The current script correctly points at `packages/app/node_modules/react-native-enriched-markdown`, not a root-hoisted copy. There is no remaining markdown migration to implement.
- Upstream `23e388b05..9a0b95aa1` does not change the installer or patch files. It does update workspace versions and the lockfile to 0.12.0; install that merged lockfile during Task 08 rather than restoring the beta manifests.
- `node --test scripts/postinstall-patches.test.mjs` currently reports **2 passed, 1 failed** on Windows. The real missing-tool fixture emits `'patch-package.cmd' is not recognized`; `cmd.exe` returns nonzero without `result.error`, so the script calls the outcome a rejected patch and deletes the fixture's dependency. The existing test expects a failed spawn and an intact package.
- Successful and already-applied patches pass in the same environment. The evidence does not establish that every Git Bash install fails; the confirmed defect is shell/PATH-dependent tool discovery and destructive misclassification of an unavailable tool.

## Change

- Resolve the installed patch-package Node CLI from the checkout and launch it through `process.execPath`, without a shell or dependence on an npm-provided PATH. Do not add a second Windows-only patching path.
- Preserve each patch's working directory and relative `--patch-dir` handling, including nested app/server dependencies and paths containing spaces.
- Treat tool-resolution/start failures as unavailable: fail the install, report the cause, and leave installed dependencies intact. Keep removal/reinstall recovery only for an actual patch rejection.
- Extend `scripts/postinstall-patches.test.mjs` with real temporary-checkout fixtures. Once the tool is resolved independently of PATH, an empty PATH is not evidence that it is missing; make the unavailable-tool fixture actually lack the resolved CLI. Keep changed-patch recovery and idempotence coverage.

## Acceptance

- The existing three behaviors pass on Windows and POSIX: apply/idempotence, genuine rejection recovery, and unavailable tool without deleting a dependency.
- Root and nested workspace patches run from the correct directory, including a checkout path with spaces. Invocation failures clean up temporary patch directories.
- A clean checkout/install applies the patches for the dependencies it actually installs. Partial-workspace installs may legitimately skip packages; do not require an unconditional count of eight patches.
- The enriched-markdown patch and `BottomSheetModalInternalProvider` export are present after install. No removed markdown-display/uitextview dependency is reintroduced.

## Verify

Use the existing script-test suite and existing CI jobs; no feature-specific workflow. Run install experiments in a disposable checkout, not the operator's dirty working tree.

```bash
node --test scripts/postinstall-patches.test.mjs
npm ci
npm run build:client
npm run typecheck
npm run lint -- scripts/postinstall-patches.mjs scripts/postinstall-patches.test.mjs
npm run format:check:files -- scripts/postinstall-patches.mjs scripts/postinstall-patches.test.mjs
(cd packages/app && npx vitest run src/components/markdown/renderer.test.ts --bail=1)
(cd packages/app && npx vitest run src/components/ui/isolated-bottom-sheet-modal/index.test.tsx --bail=1)
```

Record actual results and platforms. Do not claim browser markdown flows were exercised by these unit tests; [Task 07](upstream-sync-07-merge-integration-verification.md) owns that evidence.

## Constraints

- No hand-edits to node_modules or stale dependency compatibility installs.
- No blanket suppression of patch failures or dependency removal on process-launch failure.
- Do not restart a running daemon or run the full test suite.

## Completion

Implemented checkout-local CLI resolution and direct `process.execPath` invocation without shell/PATH discovery. Resolution, file preparation, spawn errors, and signal termination fail without removing dependencies; genuine nonzero patch exits retain reinstall recovery. Temporary patch directories are cleaned in `finally`. The real-tool fixtures cover root, app, and server working directories with spaces in checkout paths and an empty PATH; the unavailable fixture has no installed CLI.

Verification on Windows (Git Bash, Node v24.20.0), 2026-10-19:

- `node --test scripts/postinstall-patches.test.mjs`: **6 passed**, both in the operator checkout and in the disposable install checkout.
- `npm ci`: **passed** in a disposable HEAD archive with the changed installer/tests copied in and its own Git repository initialized. All eight dependencies present in this full install patched successfully. The first archive-only attempt applied every patch but failed at Lefthook prepare because the archive lacked `.git`; initializing that disposable repository and rerunning `npm ci` completed normally. No install ran in the operator checkout.
- Checked installed enriched-markdown JNI `sourceType` patch markers and `BottomSheetModalInternalProvider` exports in both source and declarations. `npm ls react-native-markdown-display react-native-uitextview --all` returned an empty tree.
- `npm run build:client` and root `npm run typecheck`: **passed** in the operator checkout.
- `npm run build:app-deps`: **passed** in the disposable checkout. The specified renderer test file passed **136 tests** and isolated-sheet test file passed **5 tests** there, against the clean install.
- Targeted installer/test lint and `format:check:files`: **passed**. Ran `format:files` for changed scripts; full `npm run format` passed in the disposable checkout to avoid rewriting unrelated dirty operator files.
- Install reported **159 dependency audit vulnerabilities** (9 low, 44 moderate, 91 high, 15 critical); dependency upgrades/audit remediation are outside this installer fix.

POSIX execution was not available in this session; the cross-platform fixtures remain for existing CI. No browser markdown flows, native UI flows, daemon restart, upstream merge, or full test suite were exercised. Task 07 still owns integration evidence. This fix is committed separately before Task 08's merge.

## Required context

- [Development](../development.md)
- [Testing](../testing.md)
- [Patch installer](../../scripts/postinstall-patches.mjs)
- [Installer tests](../../scripts/postinstall-patches.test.mjs)
