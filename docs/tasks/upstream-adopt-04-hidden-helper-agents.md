# Upstream adoption 04 — Hidden durable helpers created by plugins

**Priority:** P1  
**Status:** Implemented on `main`; targeted QA and real plugin/UI verification pending  
**Tracker:** https://github.com/infectiousstupidity/paseo/issues/17

## Outcome

Let Shiori or other plugins create durable, ID-addressable background helper agents inside an ordinary workspace without opening tabs, attracting attention, or polluting default lists and notification surfaces.

## Upstream PR

- https://github.com/getpaseo/paseo/pull/8683 (selectively ported; no whole-upstream merge)

## Implementation — 2026-11-07

- `0ebde01f` — optional agent background flag on wire and SDK, hello capability `background_agents`, feature gates and client-side create semantics. Older clients cannot subscribe to or inclusively discover agent-level hidden helpers.
- `b403c724` — daemon command path, caller/background inheritance, workspace provisioning, directory/discovery filtering, directory sync, create, event broadcasts, MCP and remote host operations.
- `47231648` — background value retained in manager, persisted records, resume and reload; suppress foreground attention/notification signals, preserve ordinary provider and archive lifecycle. Reconciled the fork's manager and storage changes rather than overriding them.
- `4c8f3a4e` — app snapshot/replica retention, tab auto-open, subagent track, workspace activity, aggregated agent lists, and CLI inclusive/default listing behavior. Retained the fork's existing tab selector/replica fields instead of adopting unrelated upstream refactors.
- `3abad923` — focused app/client/CLI/server protocol and persistence regressions including restart/cache, hidden list, attention, and SDK/MCP creation scenarios.
- `68157e61` — isolated browser and daemon E2E checks, host propagation and creation tests.
- Documentation: owning lifecycle and glossary, plus persisted data model.

### Fork-specific boundaries

- `workspace.background` still controls whole-workspace visibility; `agent.background` hides an individual helper inside a visible workspace. A new workspace inherits the caller's effective background, whereas a child agent inherits its caller's own agent-level background unless overridden.
- Preserved existing Shiori global task queue, Pi child inspector/control surfaces, and 15-minute guarded runtime suspension. Hidden helpers have standard agent IDs, provider history, lifecycle hooks, finish/wait behavior, archive semantics and restart persistence.
- Reconciled upstream patches against the fork's existing `AgentManager`, client replica serializer, and workspace tab selectors; did not import the upstream refactor that does not apply to this fork.
- The fork does not contain upstream `public-docs/` paths, so those website documentation changes were not introduced as a new documentation tree.

## Acceptance and verification status

- **Code complete:** server/SDK/protocol/app/CLI changes and targeted regression/E2E tests committed on `main`.
- **Not executed in this session:** targeted Vitest, real provider/plugin run, browser Playwright tests, `npm run typecheck`, `npm run lint`, or formatter. Connected GitHub API access is available, but this environment has no runnable checkout and the new commits have no verified CI results.
- **Required to close #17:** run focused creation, persistence/restart, list/filter/capability, agent archive, attention/notifications, MCP/SDK and connected-host suites; validate a Shiori-style background child created in an existing visible workspace, `waitForFinish()`, exact-ID lookup, browser tab/track/sidebar absence, reconnect, and explicit inclusive list. Check no regressions in ordinary agents or background workspaces.
- Source-level patch application and committed tests are **not** passing-test evidence. Keep issue #17 open and tracking checklist unchecked until acceptance is demonstrated. The production daemon on port 6767 was **not** restarted.
