# Upstream sync 09: run the new lint-rule tests on Windows

Status: **Pending.** Depends on [08](upstream-sync-08-subagents-compact-feedback.md), which brings in the new test file. Tracked in the [upstream sync plan](../plans/upstream-sync-2026-10.md).

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

## Required context

- [Testing — Windows process launch](../testing.md#running-tests-locally)
- [Task 08](upstream-sync-08-subagents-compact-feedback.md)
