# Upstream sync 09: run the new lint-rule tests on Windows

Status: **Implemented — Windows checks passed; POSIX verification remains for CI.** Depends on [08](upstream-sync-08-subagents-compact-feedback.md), which brings in the new test file. Tracked in the [upstream sync plan](../plans/upstream-sync-2026-10.md).

## Outcome

The existing lint-rule test file invokes the real installed oxlint CLI on Windows and POSIX and distinguishes a launcher failure from a lint diagnostic.

## Evidence

Upstream `d61dcaf1d` adds `scripts/oxlint/paseo-plugin.test.mjs` and runs it in the quality job. Its helper calls `spawnSync(repoRoot/node_modules/.bin/oxlint, ...)` without a shell. That path is a Unix-style executable shim, not a Windows executable.

The same invocation against this checkout on Windows returns `status: null` and `spawnSync D:\DEVELOPMENT\paseo\node_modules\.bin\oxlint ENOENT`. The helper does not inspect `result.error` and concatenates nullable stdout/stderr, so its assertions do not establish that the lint rule ran. This is separate from the actual raw-pressable violations handled by Task 08.

## Change

- Resolve the installed oxlint Node CLI and spawn it through `process.execPath`, keeping argv separate and the fixture's temporary directory as cwd. No shell or platform-specific shim branch.
- Treat spawn errors as launcher errors with useful diagnostics. Only a completed CLI run may count as a positive/negative lint result.
- Keep tests using real source fixtures and the real lint plugin/CLI. Preserve the aliased gesture-handler import case and the allowed-type/import case; do not replace the process with a mock or skip Windows.

## Acceptance

- `node --test scripts/oxlint/paseo-plugin.test.mjs` passes all three existing rule cases on Windows and POSIX, including a checkout path with spaces.
- Invalid fixtures fail with the expected `no-raw-pressable` diagnostic; the allowed fixture exits zero.
- A CLI startup failure is reported as such rather than masquerading as a rule result. Temporary directories are removed on success and failure.
- Existing CI wiring in `.github/workflows/ci.yml` and its contract test remain intact; no new workflow or npm script is introduced.

## Verify

```bash
node --test scripts/oxlint/paseo-plugin.test.mjs
node --test scripts/ci-workflow.test.mjs
npm run lint -- scripts/oxlint/paseo-plugin.mjs scripts/oxlint/paseo-plugin.test.mjs
npm run typecheck
npm run format:check:files -- scripts/oxlint/paseo-plugin.mjs scripts/oxlint/paseo-plugin.test.mjs
```

## Completion

Record results/platforms and commit the test-runner fix as a fork follow-up after Task 08. Do not push anything to upstream.

### Implementation and verification

- Resolve the installed oxlint package's Node CLI and launch it through `process.execPath` with separate argv. Spawn errors throw a launcher-specific error with the original cause; signal termination cannot count as a lint result. Existing fixtures and cleanup remain intact. No new tests, scripts, or CI changes.
- Windows / Git Bash / Node v24.20.0: all three existing rule cases passed. A temporary copy under a path containing spaces also passed all three. A disposable runner copy targeting a nonexistent executable reported `Failed to launch oxlint` with `ENOENT`; fixture directories were removed after both successful and failed launches. Disposable copies were removed.
- `npm run typecheck`, targeted lint, and targeted format check passed. Ran `npm run format` and restored unrelated formatter-only changes.
- CI contract test: 12 passed, 1 unrelated failure at `scripts/ci-workflow.test.mjs:246`: Windows paths from `filesUnder` do not match the forward-slash `packages/app/e2e/browser/` prefix assertion. The workflow and contract test were not changed.
- POSIX was not run locally; existing CI retains that verification. No push performed.

## Required context

- [Testing — Windows process launch](../testing.md#running-tests-locally)
- [Task 08](upstream-sync-08-subagents-compact-feedback.md)
