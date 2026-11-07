# Upstream adoption 03 — Show and stop provider background commands

**Priority:** P1  
**Status:** Implemented on `main`; runtime and UI verification pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/16

## Outcome

Display real background commands/monitors after the foreground turn finishes, with individual Stop where supported.

## Upstream PRs

- https://github.com/getpaseo/paseo/pull/6220

## Work

Compare upstream background-work inventory, providers, SDK and composer track against the fork's lifecycle. Upstream covers Claude, Codex and OpenCode v2; do not pretend it exposes Pi commands. Preserve fork's guarded 15-minute idle-runtime suspension; no second runtime collector.

Before editing, fetch current fork main and upstream main; inspect actual code, docs and focused tests. Port only demonstrably missing behavior; do not blindly cherry-pick, overwrite fork files, or duplicate existing abstractions. A verified already-implemented behavior is a valid no-op outcome.

## Acceptance

Visible background work keeps agent/workspace running; stopping one does not stop siblings or unrelated foreground work; suspension does not kill protected work; unsupported providers have no false control.

## Verify

Provider inventory/stop tests and an isolated two-background-command browser scenario with reconnect.

Follow AGENTS.md for targeted tests, typecheck/lint/format and required real UI/provider evidence. Record the commit, exact results, unresolved differences and blockers in this doc. Do not restart the live daemon or run full local test suites. Update the relevant owning product docs if behavior changes.

## Implementation — 2026-11-07

Ported upstream PR #6220 in smaller fork-aware commits:

- `49436dde`: daemon inventory store, protocol messages, subscription and stop RPC, permissions,
  snapshot/workspace projections, and a **separate live-inventory veto** in the existing
  `AgentManager.idleActivityBlocker` (no second idle scheduler).
- `915798f5`: Codex per-thread background terminal inventory and OpenCode v2 shell inventory,
  with scoped stop and reconnect handling; preserved the fork's Codex nested-child routing.
- `ca373bc7`: Claude background Bash/Monitor observation and `stopTask` confirmation.
  The fork had no `runtime-safety.ts`: added its UI-inventory tracker as a separate helper **without
  replacing** the stricter pre-existing `runtimeActivitySnapshot`/`suspendIfIdle` protection.
- `99f489d6`: client SDK list, subscribe (including reconnect snapshots), stop APIs and
  app status/replica/subagent projections.
- `926a4d77`: composer background-work pill/inspection/Stop UI, plus horizontal scrolling that
  coexists with compact mobile-panel gestures. Explicitly keep the track visible when its **only**
  content is background work, and preserve existing parent/subagent Pi controls.
- `6d2acc43`: localized text across nine app languages.
- `686c03a1`, `af5891ef`, `c071051f`, `45d2dd9e`: upstream unit/API/wire/provider
  tests, including independent Codex per-terminal Stop vs foreground interrupt.
- `2bf24222`: isolated real-provider Playwright scenario launches two background commands,
  stops only one, runs another foreground turn and checks a second browser client after reconnect,
  covering Claude/Codex/OpenCode.
- `7d8b9c85`: idle-suspension regression: two live siblings block automatic release, then
  the last one settles and the agent becomes eligible again.
- `842acbdc`: touch-horizontal scrolling browser test for long composer tracks.
- `2594f1c5`: Codex original-thread process ownership after rewind, with reconnect snapshot
  expectation adapted from upstream.

### Fork-specific differences

- **Pi, OMP, ACP** do not claim a supported background command inventory or offer a fake Stop
  action; Pi's independent subagent Stop/Steer controls are unchanged.
- Claude automatic suspension still requires its existing complete provider background snapshot,
  quiet ledger and verified process-tree release. A reported live inventory count now also blocks
  the manager's suspension admission.
- Kept the fork's grouped subagent inspector, parent navigation, projection, session ownership,
  and tab behavior. The new background-work track is separate from provider subagent timelines.

### Verification and blockers

- Verified source presence, change scopes, and the current GitHub `main` tip through the
  connected repository API. New and updated tests are **committed, not executed** here.
- No accessible local checkout/build runner: **no** TypeScript typecheck, targeted Vitest,
  lint, formatting, real provider launch, Playwright browser run, screenshots, or confirmed
  Stop handshake was executed in this session. GitHub Actions may be checked separately.
- Before closing #16, execute the focused inventory/provider/protocol/SDK/manager Vitest tests,
  typecheck/lint/format, the isolated real two-shell browser test, compact touch scrolling,
  and a real Claude Monitor case. Confirm token revocation across reconnect, per-item
  stop-with-sibling preservation, process-tree safety and all supported platforms.
- The production Paseo daemon was **not** restarted. Leave #16 open pending this evidence.
