# Publishing and listing

The listing page contract and the install/update mechanics for npm and Git sources. Contract: [Publishing guide](https://paseo.sh/docs/plugins/publishing.md), [reference.md → Plugin sources](https://paseo.sh/docs/plugins/reference.md#plugin-sources).

## Publishing a listing

Write `OVERVIEW.md` beside `paseo-plugin.json` for the plugin page inside Paseo.
It helps someone decide whether to install your plugin; the install command is already at
the top of that page. A README assumes a GitHub audience and carries installation
instructions, technical details, and badges. Long, AI-generated READMEs make people read
past that material to understand what a plugin does.

`OVERVIEW.md` is required to list your plugin in the registry. Commit it beside
`paseo-plugin.json` in the source repository at the pinned commit. The registry resolves it
relative to the manifest, under `pluginPath` for monorepos. Include it in the published npm
package too; the scaffold's `files` list includes it. Replace the scaffold's guidance comment
with useful facts before publishing.

The repository overview takes precedence over a registry import stopgap. Online validation
fails when the pinned commit has no `OVERVIEW.md`, except for unchanged imported records
that already carry `plugins/<owner>/<slug>.md` in the registry repository. Every version bump
requires a repository overview and removes the stopgap in the same PR. A bump without the
repository overview fails validation. README files do not supply the overview.

Author overviews and registry stopgaps follow the same content contract, in this order.
Choose headings only when they help; length follows complexity. A theme needs one paragraph.

1. Explain what the plugin is and does in plain terms first.
2. Explain how it works only when that is not obvious.
3. Explain setup when needed: settings, accounts, tokens, providers, external tools, or other
   plugins. Include applicable daemon version and operating system requirements. Setup
   guidance is allowed; installation instructions are not.
4. Explain capabilities and settings worth understanding, what each option does, what the
   plugin reads or sends and where, permissions, and known limits.

Use sentence case and plain factual language, with no em dashes. Omit installation commands,
badges, changelog, contributing or license sections, marketing, and unsupported claims.
Avoid implementation filler such as empty cleanup functions, catalogs of theme-token fields,
or lists of absent features. Keep only what helps someone choose the plugin.

If your plugin is an unchanged imported record, you can propose an author-written overview
to replace the registry stopgap. Do not add import credit to your own `OVERVIEW.md`.

See [Your listing page](https://paseo.sh/docs/plugins/publishing.md#your-listing-page).

## Typecheck and manage

When editing a plugin, typecheck its source before install or reload:

```bash
npm run typecheck
paseo plugin install /absolute/path/to/plugin
paseo plugin install /absolute/path/to/plugin --id another-runtime-id
paseo plugin install npm:@acme/paseo-review
paseo plugin install npm:@acme/paseo-review@1.2.0
paseo plugin install github:owner/repository
paseo plugin install github:owner/repository --ref main
paseo plugin update my-plugin
paseo plugin ls
paseo plugin reload my-plugin
paseo plugin logs my-plugin
paseo plugin disable my-plugin
paseo plugin enable my-plugin
paseo plugin remove my-plugin
```

For npm, ensure npm is on the daemon's `PATH`; use that host's registry configuration and credentials. Install selectors choose
content once; they do not pin updates. `install` and `add` are aliases. Follow the
[publishing guide](https://paseo.sh/docs/plugins/publishing.md) for Paseo's package contents and
preparation requirements; standard npm publishing commands apply.

Use `--host <url>` when managing a daemon other than the CLI default. A Git source that must install or generate something declares `build` in `paseo-plugin.json` as a list of argv arrays; Paseo runs them without a shell on install and update and keeps the old version if one fails. Plugin source edits require `paseo plugin reload`; config changes to the global switch require `paseo reload`. A failed plugin reload stays failed; inspect `paseo plugin ls` for the load error and `paseo plugin logs <id>` for subprocess output, fix the source, typecheck, and reload again. `remove` keeps local source directories and deletes managed Git/npm installations.

Do not restart the daemon to load source changes. Restarting it can kill the agent performing the work.

For an old mixed entry, follow the standalone [runtime-entry migration guide](https://paseo.sh/docs/plugins/migration) mechanically.
