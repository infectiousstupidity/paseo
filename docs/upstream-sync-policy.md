# Upstream merge policy

Run from a clean checkout of `main`:

```sh
node scripts/upstream-sync.mjs --dry-run
node scripts/upstream-sync.mjs --verify
```

The script fetches `getpaseo/paseo`, merges its `main`, discards all paths in
[`upstream-sync-policy.json`](../scripts/upstream-sync-policy.json) and restores
the fork-owned `CLAUDE.md`, `docs/mockups/`, and `docs/tasks/` paths from the current `HEAD`.
It commits only when other merge conflicts are fully resolved; otherwise it
leaves the merge open for manual review.

Use `--no-commit` to review the staged merge first, or `--dry-run` for a preflight.
`--verify` additionally runs the complete workspace typecheck. The default
command does not push to GitHub.

Do not add entire shared runtime directories (e.g. `packages/app/`,
`packages/server/`, `packages/relay/`, `docker/`) to the exclusion list.
The policy is for permanently unwanted upstream-only paths, not conflict
resolution for fork modifications.

Current removals preserve Windows Electron builds, Android APK builds,
the local Apple Silicon updater, and the Docker daemon. Published
store/desktop release workflows are intentionally excluded. The vendored
audio module itself remains; only its demo projects are removed.

When a removed upstream area adds new imports or build requirements, a
subsequent CI failure still needs an explicit fix. Path exclusions do not
automatically replace dependency or API audits.
