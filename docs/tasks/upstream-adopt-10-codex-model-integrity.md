# Upstream adoption 10 — Codex histories, diffs, interrupts and actual model

**Priority:** P2  
**Status:** Partial source implementation in [draft PR #29](https://github.com/infectiousstupidity/paseo/pull/29); acceptance pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/13

## Outcome

Keep long Codex sessions fast and truthful, including patch diffs and the actual model after imports or unavailable selections.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/8171
- https://github.com/getpaseo/paseo/pull/8132
- https://github.com/getpaseo/paseo/pull/8613
- https://github.com/getpaseo/paseo/pull/7525
- https://github.com/getpaseo/paseo/pull/8948
- https://github.com/getpaseo/paseo/pull/8957

## Work

Inspect Codex provider import/history/interrupt, timeline projection and model handling. Preserve the fork's custom providers and model/reasoning controls. Keep provider truth distinct from requested selection and avoid duplicating history stores.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Long session reopens without whole-thread history retention; multi-file patches show; interrupted shell commands end; imported native model and fallback actual model are displayed accurately.

## Verify

Seeded long-session, patch, interrupt, import and effective-model regressions.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.

## Partial source implementation — 2026-11-08

**Delivery:** [Draft PR #29](https://github.com/infectiousstupidity/paseo/pull/29), branch `upstream-10-model-integrity`, based on fork `main` at `7fd12e23ccfb`. **Not merged, tested or accepted.**

Source comparison with upstream #8948/#8957 found two model-truth bugs in the fork. Import normalization injected a new-session default, overriding the native session's model. Successful model-set commands overwrote saved/runtime state with the requested ID even when a provider ignored an unavailable model or returned its canonical selection. The proposed change preserves the imported native model, stores effective selections (including no-op invalid requests), and keeps explicit preference resets. The existing provider-setter contract now optionally returns the effective model; no additional fallible status request is introduced.

Compared with upstream #8613, both Codex thread-item and legacy patch-event mapping kept only the first file's visible diff. The proposed change produces labeled, bounded multi-file previews, retains move/empty-file metadata, and preserves file boundaries in the UI diff parser. Single-file previews stay on the existing path.

**Source-implemented since this initial proposal:** Codex history mode discovery, 100-item paginated reads with cursor guard and per-item timestamps, legacy fallback, warning rows for oversized history, scoped oversized JSON-RPC response rejection, lazy history replay on reopen, first-turn native indexing without retaining a second timeline, and exclude-turns resume/rewind. See branch `upstream-10-model-integrity`. Also repaired a pre-existing misplaced `stopBackgroundWork` class method in the fork's Codex adapter.

**Still unimplemented:** scoped termination of interrupted Codex commands (#7525), and real-provider/UI acceptance. Do not mark #23 done until its full acceptance is established.

**Verification:** New focused tests were authored for import/reload model, accepted/ignored/alias model selections, live Codex import collaboration settings, normal/legacy multi-file patches and UI diff boundaries, paginated/legacy history, lazy resume, repeated cursors, recoverable oversized pages and line-reader isolation. Existing Codex assertions were updated for lazy replay and exclude-turn semantics. Tests were **not run**. No supported checkout or Node >=26.12.1/dependencies are available from this GitHub-only environment; typecheck, lint and Biome format were also not run. In a supported checkout, run:

```sh
npx vitest run packages/server/src/server/agent/agent-manager.test.ts --bail=1
npx vitest run packages/server/src/server/agent/providers/acp-agent.test.ts --bail=1
npx vitest run packages/server/src/server/agent/providers/codex-app-server-agent.test.ts --bail=1
npx vitest run packages/server/src/server/agent/providers/codex/thread-history.test.ts --bail=1
npx vitest run packages/server/src/server/agent/providers/codex/app-server-transport.test.ts --bail=1
npx vitest run packages/server/src/server/agent/providers/codex/rewind.test.ts --bail=1
npx vitest run packages/server/src/server/agent/providers/codex/tool-call-mapper.test.ts --bail=1
npx vitest run packages/app/src/utils/tool-call-parsers.test.ts --bail=1
npm run typecheck
npm run lint
npm run format
npm run format:check
```

The production daemon was not restarted.
