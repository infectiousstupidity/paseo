---
name: paseo-plugin
description: Build and manage trusted local Paseo plugins. Use when the user asks to create, edit, install, reload, enable, disable, remove, or troubleshoot a Paseo plugin; add lifecycle hooks; transform agent configuration, environment, MCP servers, or workspace creation; automate permissions or turn follow-ups; add a screen, sidebar header or footer item, or workspace panel; add Command Center items or slash commands; add composer pills or attachment sources; transform, render, or append agent timeline items; contribute a theme; use Paseo from plugin code; or add plugin RPCs.
---

# Paseo plugins

Build or manage the requested plugin directly. Use the current public docs to catch contract changes, but keep working from this skill if the network is unavailable.

**User's request:** $ARGUMENTS

## Check current documentation

Fetch [https://paseo.sh/llms.txt](https://paseo.sh/llms.txt) first. Select and fetch the current plugin Markdown pages from that index before changing a plugin:

- [Plugin quickstart](https://paseo.sh/docs/plugins.md) ([browser page](https://paseo.sh/docs/plugins))
- [Publishing](https://paseo.sh/docs/plugins/publishing.md): npm package contents, dependencies, Git preparation, and private registries.
- [Plugin reference](https://paseo.sh/docs/plugins/reference.md) ([browser page](https://paseo.sh/docs/plugins/reference))

Use the deployed docs when they disagree with this skill. Do not send the user away to read them instead of completing the work.

In the Paseo repository, use `public-docs/plugins/reference.md` for the checkout's API, including
unreleased changes. Use `docs/plugins.md` for maintainer guidance. Complete contracts belong in the
public docs; this skill indexes the references and examples.

## What a plugin can contribute

Pick the contribution that matches the request, then read its reference before writing code. Most
plugins combine several: a slash command that calls an RPC, which appends a timeline row, which a
renderer draws.

| Contribution          | Registration                                                | Use it when                                                                            | Reference                                                                       |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Screen + sidebar item | `addScreen`, `addSidebarHeaderItem`, `addSidebarFooterItem` | Full plugin UI, opened from a sidebar row or popover                                   | [Screens](references/ui-surfaces.md)                                            |
| Workspace panel       | `addWorkspacePanel`                                         | A tab beside agents, terminals, files, diffs; `locations: ["explorer"]` for Explorer   | [Panels](references/ui-surfaces.md)                                             |
| Command Center item   | `addCommandCenterItem`                                      | A global, workspace, or agent action under ⌘K                                          | [reference.md](https://paseo.sh/docs/plugins/reference.md#command-center-items) |
| Slash command         | `addSlashCommand`                                           | `/command args` runs plugin code instead of prompting the agent                        | [Composer](references/composer.md)                                              |
| Composer pill         | `addComposerPill`                                           | A per-agent button beside Tasks and Subagents                                          | [Composer](references/composer.md)                                              |
| Attachment source     | `addAttachmentSource` + `server.handle`                     | The user attaches a searchable external resource, such as an issue                     | [Composer](references/composer.md)                                              |
| Timeline transformer  | `addTimelineTransformer` + `addTimelineRenderer`            | Replace, explode, or hide a built-in item, including while it streams                  | [Timeline](references/timeline.md)                                              |
| Timeline row          | `paseo.agents.ref(id).timeline.append(...)`                 | Push a plugin-owned row from a server handler and update it later                      | [Timeline](references/timeline.md)                                              |
| Plugin RPC            | `defineRpc`, `server.handle`, `useRpc`                      | Daemon-side work that is not a normal Paseo operation: vendor APIs, credentials, files | [RPC](references/rpc-and-sdk.md)                                                |
| Paseo SDK             | `usePaseo()` / handler `{ paseo }`                          | Normal Paseo operations: workspaces, agents, providers, config                         | [SDK](references/rpc-and-sdk.md)                                                |
| Lifecycle hooks       | `server.on`, `server.before`                                | Observe turns, answer permissions, change config, environment, MCP, isolation          | [reference.md](https://paseo.sh/docs/plugins/reference.md#lifecycle-hooks)      |
| Theme                 | `addTheme`                                                  | A light or dark palette under Settings → Appearance                                    | [Theme](references/ui-surfaces.md)                                              |

Lifecycle worked examples: [lifecycle-logger](https://github.com/getpaseo/paseo/tree/main/plugin-examples/lifecycle-logger),
[lifecycle-actions](https://github.com/getpaseo/paseo/tree/main/plugin-examples/lifecycle-actions),
[agent-configuration](https://github.com/getpaseo/paseo/tree/main/plugin-examples/agent-configuration).
Timeline examples: `plugin-examples/timeline-items`, `plugin-examples/inline-thinking`,
`plugin-examples/linear`, `plugin-examples/catppuccin`.

## Project shape

```bash
paseo plugin init /absolute/path/to/my-plugin   # writes files, does not install
cd /absolute/path/to/my-plugin && npm install
npm run typecheck                               # before every install or reload
```

`paseo-plugin.json` carries the install id and `requirements.paseo`. Keep the requirement honest:
`init` writes `>=` the CLI version, raise the minimum when adopting newer APIs, and add an upper
bound when a later Paseo release breaks. A missing requirement means `<0.8.0`.

Entries: `index.client.tsx` + `client/` (app), `index.server.ts` + `server/` (daemon subprocess),
`shared/` (both). A plugin needs at least one entry. Each entry default-exports one contribution
function and returns cleanup, which may be async. Details: [project mechanics](references/project.md).

## Hard rules

- Classify every module before writing imports. A client import of `server/`, a server import of
  `client/`, any `node:` import reachable from client code, and any relative import of a code file
  in the plugin root are compile errors. Hooks and client contexts come from
  `@getpaseo/plugin/client`, server contexts from `/server`, host UI from `/client/react-native` or
  `/client/ui`. Never import `/client/host`.
- React Native primitives only: `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`. No HTML
  elements, `className`, CSS strings, or `onClick`.
- Take every text color from `theme.colors` (primary `foreground`, labels `foregroundMuted`, root
  `surface0`) and padding from `layout.compact`. Unstyled text is black and fails in dark themes.
- Do not put `"DOM"` in `tsconfig.json` or use `/// <reference lib="dom" />`. Put DOM globals only
  in `client/web.ts`, declare only what that module uses, gate every export on
  `Platform.OS === "web"`, and provide the native alternative or a no-op.
- Audit the client sources before reporting a plugin done:

  ```bash
  rg -n "document\.|window\.|localStorage|navigator\.|<[a-z]+[ >]|className=|onClick=" client/
  ```

  A hit outside `client/web.ts` is a bug.

- Do not restart the daemon to load source changes. Restarting it can kill the agent doing the work.
  Use `paseo plugin reload <id>`.
- Plugins are trusted, unsandboxed code. Backend code reaches files, processes, credentials, and
  network services on the daemon machine. Do not install a plugin the user has not authorized or
  source you have not inspected.

## Enable plugins on a daemon

Identify the target daemon and read its root `pluginsEnabled` from `<home>/config.json`; `paseo
daemon status --json` reports the `home` of the local daemon. A missing field means `false`. Never
infer the global switch from a plugin's `disabled` status.

If it is already `true`, continue. If it is `false` or absent, stop and ask first:

> Plugins are trusted, unsandboxed code. Backend plugin code can access your daemon machine, including files, processes, credentials, and network services. Client plugin code runs inside the Paseo app. May I enable plugins on this daemon?

After permission, preserve the rest of `config.json`, set `pluginsEnabled` to `true`, run
`paseo reload --json`, require `pluginsEnabled` in `appliedPaths` (accept an empty
`appliedPaths` only after re-reading the file and confirming the live catalog), then confirm
`paseo plugin ls` reaches `running`. To turn the switch off, set `false`, reload, and confirm
plugins report `disabled`.

Never edit a local config for a remote daemon. Edit on the daemon machine, or ask the user to use
**Settings → Plugins → Enable plugins**; `paseo reload --host <url>` reloads a remote file without
editing it.

## Manage

```bash
paseo plugin install /absolute/path/to/plugin [--id <runtime-id>]
paseo plugin install npm:@acme/paseo-review[@1.2.0] | github:owner/repository [--ref main]
paseo plugin update | ls | reload | logs | disable | enable | remove <id>
```

Add `--host <url>` for any daemon other than the CLI default. Source edits need
`paseo plugin reload <id>`; the global switch needs `paseo reload`. A failed reload stays failed:
read `paseo plugin ls` for the load error and `paseo plugin logs <id>` for subprocess output, fix,
typecheck, reload. npm and Git source rules, the `build` declaration, and what `remove` deletes:
[publishing and sources](references/publishing.md).

## Verify the outcome

1. Run `npm run typecheck`.
2. Install or reload the exact runtime ID.
3. Run `paseo plugin ls` and require `running` with no error.
4. Confirm the contribution on the intended host. Open the Command Center with **⌘K** (macOS) or **Ctrl+K** (Windows/Linux). Type `/` in the composer for slash commands. For timeline work, run an agent turn that produces the source item and watch it while it streams, not only after it completes. For UI work, check a wide desktop window and a compact/mobile client, and switch theme to confirm text still uses `foreground` / `foregroundMuted`.
5. Exercise the changed action or RPC, including its error state.

Common failures:

- Missing sidebar item: wrong host, plugin not `running`, the item is hidden in Settings > Sidebar, or its component throws (a `SidebarRow` with an unknown Lucide name or unsafe SVG throws).
- Unavailable client module: client bundles can use only the host-provided modules listed in [project mechanics](references/project.md).
- RPC rejection: input or output failed its Zod schema, or the handler threw. Inspect `paseo plugin logs <id>` for handler output.
- Plugin exits or reload fails: inspect `paseo plugin ls` for status and `paseo plugin logs <id>` for initialization, cleanup, or crash output.
- Stale UI: source was edited without `paseo plugin reload <id>`.
- Timeline item shows "Plugin timeline item unavailable": no renderer registered for that `kind` and `version`, the renderer schema rejected `data`, or the plugin is not running on that host.
- Transformer has no effect: `query.itemType` does not match the source type, the transform returned `undefined`, or it threw and was skipped; check the app console for `[Plugins] Timeline transformer failed`.
- Slash command not offered: name collides with a built-in or another plugin, the context is `agent` on a draft, or the composer has attachments.
- Append rejected: the caller is not a plugin session, `data` exceeds 64 KiB, or the host predates `features.pluginTimelineItems`.

## Read a reference when the task needs it

| Task                                                            | Reference                                              |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| Create a project, manifest, entries, import boundaries, cleanup | [references/project.md](references/project.md)         |
| Panel, screen, sidebar row, theme, mobile layout code           | [references/ui-surfaces.md](references/ui-surfaces.md) |
| SDK calls, plugin RPC, daemon logs                              | [references/rpc-and-sdk.md](references/rpc-and-sdk.md) |
| Attachment source, slash command, composer pill                 | [references/composer.md](references/composer.md)       |
| Timeline transformer, renderer, appended row                    | [references/timeline.md](references/timeline.md)       |
| `OVERVIEW.md`, npm and Git sources, install mechanics           | [references/publishing.md](references/publishing.md)   |
