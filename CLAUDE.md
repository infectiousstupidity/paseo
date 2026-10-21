# CLAUDE.md

Paseo is a mobile app for monitoring and controlling your local AI coding agents from anywhere. Your dev environment, in your pocket. Connects directly to your actual development environment — your code stays on your machine.

**Supported agents:** Claude Code, Codex, GitHub Copilot, OpenCode, Pi, Antigravity, and Muse Code.

## Repository map

This is an npm workspace monorepo:

- `packages/server` — Daemon: agent lifecycle, WebSocket API, MCP server
- `packages/app` — Mobile + web client (Expo)
- `packages/cli` — Docker-style CLI (`paseo run/ls/logs/wait`)
- `packages/relay` — E2E encrypted relay for remote access
- `packages/desktop` — Electron desktop wrapper
- `packages/website` — Marketing site (paseo.sh)

## Docs

`docs/` is the source of truth for system-level and process-level knowledge. **"The docs", "check the docs", or "check the X docs" always mean this directory — not the web.** Look here before fetching anything online; the docs capture gotchas and conventions you cannot derive from the code or external sources.

At the start of non-trivial work, list `docs/` and skim anything relevant to the task.

| Doc                                                          | What's in it                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [product](docs/product.md)                                   | What Paseo is, who it's for, where it's going                |
| [architecture](docs/architecture.md)                         | System design, package layering, protocol, data flow         |
| [agent-lifecycle](docs/agent-lifecycle.md)                   | Agent states, parent/child, archive semantics                |
| [data-model](docs/data-model.md)                             | File-based JSON persistence, Zod, atomic writes              |
| [glossary](docs/glossary.md)                                 | Authoritative terminology — UI label wins                    |
| [coding-standards](docs/coding-standards.md)                 | Type hygiene, error handling, React patterns                 |
| [design](docs/design.md)                                     | Design system — tokens, hierarchy, what's forbidden          |
| [platform-gating](docs/platform-gating.md)                   | Platform gates, decision matrix, Metro extensions            |
| [hover](docs/hover.md)                                       | Canonical hover pattern; the ways agents break it            |
| [unistyles](docs/unistyles.md)                               | Unistyles gotchas — `useUnistyles()` is forbidden            |
| [floating-panels](docs/floating-panels.md)                   | Anchored popovers, Android escape, status-bar offsets        |
| [menus](docs/menus.md)                                       | Menu engine — popover vs sheet, when to use a submenu        |
| [mobile-panels](docs/mobile-panels.md)                       | Compact panel ownership, worklet motion, Fabric              |
| [explorer-sidebar](docs/explorer-sidebar.md)                 | Sidebar, side-pane, compact sheet host contracts             |
| [expo-router](docs/expo-router.md)                           | Route ownership, startup restore, blank screens              |
| [forms](docs/forms.md)                                       | Non-React form model, form kit, load-state gating            |
| [file-icons](docs/file-icons.md)                             | Material icon theme in the file explorer                     |
| [markdown-renderer](docs/markdown-renderer.md)               | Shared Markdown engine, native selection                     |
| [native-text-selection](docs/native-text-selection.md)       | Diagram grouping, selection boundaries                       |
| [providers](docs/providers.md)                               | Adding a new agent provider end-to-end                       |
| [forge-providers](docs/forge-providers.md)                   | Adding a git forge — registry, tiers, self-host              |
| [custom-providers](docs/custom-providers.md)                 | Z.AI, Qwen, ACP, profiles, custom binaries                   |
| [plugins](docs/plugins.md)                                   | Plugin manifest, RPCs, native surfaces, attachments          |
| [website-i18n](docs/website-i18n.md)                         | Website languages, locale URLs, translated Markdown, anchors |
| [service-proxy](docs/service-proxy.md)                       | Workspace scripts at public URLs, reverse proxy              |
| [rpc-namespacing](docs/rpc-namespacing.md)                   | Dotted RPC names, `.request`/`.response` pairs               |
| [protocol-compatibility](docs/protocol-compatibility.md)     | Version drift, capability gating, COMPAT tags                |
| [protocol-validation](docs/protocol-validation.md)           | zod-aot inbound validation, schema-purity rules              |
| [permissions](docs/permissions.md)                           | Principals, credentials, pairing, Hub authority              |
| [terminal-performance](docs/terminal-performance.md)         | Latency pipeline, coalescing/backpressure invariants         |
| [agent-stream-performance](docs/agent-stream-performance.md) | Assistant text pipeline, paced reveal                        |
| [terminal-activity](docs/terminal-activity.md)               | Activity indicators, agent hook reporting                    |
| [file-observation](docs/file-observation.md)                 | Watcher ownership, Linux limits, teardown                    |
| [development](docs/development.md)                           | Dev server, build sync gotchas, CLI reference                |
| [testing](docs/testing.md)                                   | TDD, determinism, real dependencies, organization            |
| [qa](docs/qa.md)                                             | QA evidence bar for pull requests                            |
| [mobile-testing](docs/mobile-testing.md)                     | Maestro and mobile test workflows                            |
| [ad-hoc-daemon-testing](docs/ad-hoc-daemon-testing.md)       | Isolated in-process daemon test harness                      |
| [browser-capture-harness](docs/browser-capture-harness.md)   | Real-Electron screenshot harness, compositor gotcha          |
| [android](docs/android.md)                                   | Variants, EAS builds, version codes, F-Droid                 |
| [docker](docs/docker.md)                                     | Daemon and web UI in Docker, volumes, security               |
| [release](docs/release.md)                                   | Release playbook, draft releases, checklist                  |
| [visual-mock-workflow](docs/visual-mock-workflow.md)         | Planned Git-backed live mock iteration                       |
| [writing-docs](docs/writing-docs.md)                         | Doc contract, layers, voice rules                            |
| [SECURITY.md](SECURITY.md)                                   | Relay threat model, E2E encryption, agent auth               |
| [hub security](public-docs/hub/security.md)                  | Public Hub guide — trust boundaries, output authority        |

Deep archives, linked from the docs that own them: `docs/plans/`, `docs/tasks/`, `docs/specs/`, `docs/references/`, `docs/evaluations/`, `docs/qa-evidence/`, `docs/refactors/`, `docs/design/`, `docs/mockups/`, [Update Paseo on Apple Silicon](docs/update-macos.md), [OpenCode global event baseline](docs/opencode-global-event-baseline.md).

### Writing docs

**Integrate, don't append** — rewrite the part of the owning doc that is now wrong; never append a paragraph to the closest-looking doc. **Don't document logic** — record what the code cannot tell you. **One fact, one doc** — every other mention is a link. **One subject per doc**, **respect the layers**, **delete** obsolete sections. New doc → add a row above and link it from the docs that send readers there. Full contract, layers, and voice rules: [Writing Docs](docs/writing-docs.md).

## Quick start

```bash
npm run dev                          # Start the dev daemon
npm run dev:app                      # Start Expo against the dev daemon
npm run dev:desktop                  # Start Electron desktop dev
npm run cli -- ls -a -g              # List all agents
npm run cli -- daemon status         # Check daemon status
npm run typecheck                    # Always run after changes
npm run lint                         # Always run after changes
npm run format                       # Auto-format with Biome
npm run format:check                 # Check formatting without writing
```

Repo dev commands use checkout-local state by default. In this checkout, `PASEO_HOME` resolves to `.dev/paseo-home`, and `npm run cli -- ...` targets that same dev home automatically. The packaged desktop app and production-style daemon keep using `~/.paseo` on port `6767`.

When Mo requests an APK, use `npm run build:apk:arm64` for an ARM64 build: writes `artifacts/paseo-dogfood-arm64.apk` with diagnostics without starting a device; `npm run build:apk` builds all four Android architectures.

See [docs/development.md](docs/development.md) for full setup, build sync requirements, and debugging.

## Release branches

When the user says "this goes to next", create or
retarget the PR to `next` and preserve that destination through delivery. Follow
[release branch discipline](docs/release.md#release-branch-discipline) for creating
and updating `next`, integrating it after a release, and releasing a hotfix from a tag.

## Critical rules

- **NEVER restart the main Paseo daemon on port 6767 without permission** — it manages all running agents. If you're an agent, restarting it kills your own process.
- **NEVER assume a timeout means the service needs restarting** — timeouts can be transient.
- **NEVER add auth checks to tests** — agent providers handle their own auth.
- **Before changing app routes, startup routing, remembered workspace restore, or active workspace selection, read [docs/expo-router.md](docs/expo-router.md).**
- **NEVER run the full test suite locally.** The test suites are heavy and will freeze the machine, especially if multiple agents run them in parallel. Rules:
  - Run only the specific test file you changed: `npx vitest run <file> --bail=1`
  - Never run `npm run test` for an entire workspace unless explicitly asked.
  - If you must run a broad suite, pipe output to a file and read it afterward: `npx vitest run <file> --bail=1 > /tmp/test-output.txt 2>&1` then read the file.
  - Never re-run a test suite that another agent already ran and reported green — trust the result.
  - For full suite verification, push to CI and check GitHub Actions instead.
- Add tests to existing suites and reuse their npm scripts and CI jobs instead of creating feature-specific ones.
- **Always run typecheck and lint after every change.**
- **Build workspace packages before diagnosing cross-package type errors.** This repo consumes generated declarations across workspaces. If typecheck fails in a package that depends on another workspace, rebuild the owning stack first so `dist` declarations are current:
  - `npm run build:client` — rebuild protocol and client declarations.
  - `npm run build:server` — rebuild highlight, relay, protocol, client, server, and CLI when server/CLI types may be stale.
  - Do not patch inferred callback parameters or add local duplicate types just to silence stale declaration errors.
- **Run `npm run format` before committing.** This repo uses Biome for formatting. Do not manually fix formatting — let the formatter handle it.
- **Always use npm scripts for linting and formatting.** Do not run tools directly with `npx eslint`, `npx oxfmt`, `npx oxlint`, or package-local binaries. For targeted checks, pass file paths through the npm script:
  - `npm run lint -- packages/app/src/components/message.tsx`
  - `npm run format:files -- CLAUDE.md packages/app/src/components/message.tsx`
- **The protocol stays backward-compatible. Features don't have to.** Read [docs/protocol-compatibility.md](docs/protocol-compatibility.md) before touching `packages/protocol`. The short version:
  - **Protocol contract (always):** an old client parses messages from a new daemon, and a new daemon parses messages from an old client. New fields are optional; never narrow, never remove, never require. Wire schemas stay pure — no `.transform()`, `.catch()`, or `.preprocess()`.
  - **Feature contract (per-feature):** gate the capability once on `server_info.features.*`, then run the feature or tell the user to update the host. No fallback paths, no defensive branches.
  - **Every shim is tagged.** `// COMPAT(name): added in vX, remove after <date>` at the site that has to be deleted. `rg "COMPAT\("` is the cleanup backlog; untagged back-compat is permanent by accident.
  - **New RPCs use dotted namespaces with direction suffixes.** Follow [docs/rpc-namespacing.md](docs/rpc-namespacing.md): `domain.provider.operation.request` pairs with `domain.provider.operation.response`. Existing flat RPC names will migrate over time; don't add new ones.

## Platform gating

The app runs on iOS, Android, web (browser), and web (Electron desktop). Code is cross-platform by default. Gate only when you must. Import gates from `@/constants/platform` — never write `const isWeb = Platform.OS === "web"` locally.

- `isWeb` — DOM APIs (`document`, `window`, `HTMLElement`, `addEventListener`). The exception, not the default. NEVER use raw DOM without this guard: DOM APIs crash native.
- `isNative` — native-only APIs (Haptics, `StatusBar.currentHeight`, push tokens, camera).
- `getIsElectron()` — Electron bridge: file dialogs, titlebar drag region, app updates, dock badges.
- `useIsCompactFormFactor()` (`@/constants/layout`) — layout decisions: sidebar overlay vs pinned, modal vs full screen. Never use `Platform.OS` as a proxy for a layout capability.

NEVER use `onPointerEnter`/`onPointerLeave` — they do not fire on native iOS. Hover works on web only, so gate hover-to-show UI with `isHovered || isNative || isCompact`. Prefer Metro `.web.ts`/`.native.ts` and `.electron.tsx` file extensions over large `if (isWeb)` blocks.

The decision matrix, the Metro extension rules, and the full rule list are in [Platform Gating](docs/platform-gating.md).

## Debugging

Find the complete daemon logs and traces in the $PASEO_HOME/daemon.log
