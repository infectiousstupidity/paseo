# Upstream adoption 06 — Scoped plugin agent tools and session MCP servers

**Priority:** P1  
**Status:** Implemented on `main`; acceptance verification pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/19

## Outcome

Shiori and other plugins can attach **session-scoped** validated agent tools and MCP servers to
selected agents at create, import, resume, and explicit reload, using the existing
`server.before("agent.session_open", ...)` hook. These contributions are **not persisted** in the
agent's saved settings and are removed on plugin stop/disable.

## Upstream and fork comparison

- https://github.com/getpaseo/paseo/pull/7938 (agent tool ownership / invocation)
- https://github.com/getpaseo/paseo/pull/7983 (session-only MCP servers)
- Compared fork `main` `e4df6738` and upstream `main` `28c01ea1` on 2026-11-07.
- The fork had `agent.session_open` env hooks, MCP runtime configuration, provider lifecycle,
  and Paseo tool catalog support. It **did not** have plugin-scoped agent tools, tool execution,
  launch-only plugin MCP maps, plugin-session generations, or conflict ownership. Adapted upstream
  functionality to those existing boundaries without cherry-picking whole files.

## Implementation

- `12126457` — public server SDK tool contract, `PluginSessionOpenRequest` title/labels/tools/
  MCP fields, plugin process request schemas, provider launch context, and MCP preservation.
- `e1efd21d` — serializes validated tool metadata, keeps tool functions inside the plugin
  process, enforces immutable session identity, strips interactive contributions from history.
- `abfdeda5` — process-side tool store, validation and cancellation, agent-facing catalog bridge.
- `e3df3c07` — plugin-worker tool.call/cancel/detach dispatch, strict agent association and
  shutdown cleanup.
- `0e1afc24` — per-instance ownership, tool/MCP name collisions, session-open generation
  invalidation, timeout/cancel behavior, plugin stop and reload cleanup. Retains existing
  subscription timeout handling from #18.
- `76b1c3d4` — attach tools in the agent manager, merge plugin MCP only into launch configuration,
  reject saved/internal conflicts and unsupported providers, refresh idle sessions next prompt,
  detach on close/archive, normalize saved persistence without plugin MCP.
- `f906d343` — wire plugin changes to agent manager invalidation and automatic idle reopen.
- `55e7c8e5` — bind scoped tools to agent tool catalogs and expose deliberate SDK reload.
- `f73ff3b6`, `4052f4cb`, `7d6fecaa` — focused lifecycle, tool schema, execution, collision,
  provider, import/resume, busy/idle, plugin reload/disable, and MCP tests.
- `cf05344e` — reserve callable retired Paseo aliases against plugin name collisions.
- `2b1e554e` — reject new tool calls during plugin shutdown.
- `3cb6a98f` — owning documentation, author guidance, labeled-agent tool and MCP examples.

## Fork-specific boundaries

- Existing Shiori's independent global queue, Pi child controls, workspace lifecycle and
  background helpers are unchanged. Tools live in the existing per-agent tool catalog and the
  existing plugin process; no new always-on transport or separate plugin SDK was added.
- Background agent/workspace creation, guarded idle suspension, existing MCP adapter, and
  plugin subscriptions (#18) were retained in the adapted manager/runtime changes.
- Plugin tools and MCP servers are **not saved** into durable `AgentSessionConfig`. Saved user
  MCP settings continue to work; collisions fail with an explicit reason.
- The upstream `plugin-examples/agent-configuration` directory was absent in the fork. A
  smaller `plugin-examples/session-mcp` example documents labeled selection instead.
- Existing foreground work continues if a plugin changes. The next idle prompt rebuilds its
  session. An explicit SDK `reload()` is intentionally interruptive.

## Acceptance verification

**Source checks completed:** confirmed changed files and their relative imports exist on `main`,
reviewed the fork's source-level conflict resolutions, and committed isolated tests.

**Not executed:** target Vitest, typecheck, lint, format check, or real plugin-agent/real-provider
MCP and tool invocation. The GitHub connector does not supply a runnable checkout/runner.
The source checks and committed tests are not passing CI evidence.

On a runnable dev checkout, follow `AGENTS.md`, use an **isolated** daemon (not the production
port 6767), and execute targeted tests and checks:

```bash
npx vitest run packages/server/src/server/plugins/agent-tools.test.ts packages/server/src/server/plugins/lifecycle/handlers.test.ts packages/server/src/server/plugins/agent-tools.e2e.test.ts packages/server/src/server/plugins/agent-configuration.e2e.test.ts packages/server/src/server/agent/plugin-provider.test.ts packages/plugin/src/boundaries.test.ts
npm run typecheck
npm run lint
npm run format:check
```

Then verify with an actual plugin and agent: tool appears **only** on labeled agents and executes
with caller identity; name collisions and invalid inputs fail; MCP is present only at launch,
never in saved config; plugin disable removes contributions; idle next-prompt reopen works,
busy turn is not interrupted; explicit reload, restart/resume, and history-only opens behave
correctly. Capture results and logs in this document before closing #19.

**Current acceptance:** not yet verified. Do **not** close #19 until these checks pass.
The live Paseo daemon was **not** restarted.
