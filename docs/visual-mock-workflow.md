# Live visual mock workflow (planned)

**Status:** Design captured; no end-to-end implementation or MCP handoff verified.
**Next:** Prove stage 1 with one existing Paseo HTML mock. Do not rebuild the mock or change Paseo's UI architecture first.

## Outcome

Edit one persistent, Git-backed preview with an agent instead of downloading successive HTML files:

```text
open live mock → click element / annotate → submit feedback
      ↑                                       ↓
see live changes ← Pi edits source ← feedback reaches agent
      └────────── review / repeat ────────────┘
                         ↓ approved
               reuse in the real application
```

The user and agent can inspect the same worktree's preview. Annotations point at exact elements and describe changes; no manual screenshot/chat/file transfer is required. Visual overrides are suggestions, not completed source edits.

## Reuse what Paseo already provides

- **Workspace scripts + service proxy:** Use an existing `paseo.json` `type: service` script, or add one for the prototype, to serve its worktree-scoped live preview. The [service proxy](service-proxy.md) already handles HTTP and WebSocket upgrades; do not build another preview router. Use Vite only when the prototype needs its dev server/HMR.
- **Pi + Paseo tools:** Pi is already a supported provider. Paseo's opt-in browser tools expose tabs, snapshots, screenshots, page actions, logs, and evaluation ([browser](../public-docs/browser.md), [browser tools](../public-docs/browser-tools.md)). Agents can verify their work in a **separate tab** from the user's review tab.
- **Playwright:** Already used in Paseo. Prefer a small set of meaningful interaction/viewport checks and headless Shiori/CI verification. The Paseo browser requires a connected desktop browser host; it is not the unattended browser runner.
- **Design system:** Reuse actual Paseo React Native / React Native Web components and `packages/app/src/styles/theme.ts`. Follow [design.md](design.md) and [qa.md](qa.md). Avoid maintaining an unrelated HTML-only implementation of approved controls.

A Firefox extension does **not** automatically run inside Electron's embedded browser. The initial user annotation surface may remain Firefox even though Paseo hosts the agent.

## Stages

### 1. Prove the loop — first task

Use the current Paseo HTML prototype **unchanged** as the initial test fixture, tracked in a Git worktree. Serve it through a live-reloading workspace service.

1. Open the preview in Firefox with **Design Mode**; use Paseo's separate browser tab for the agent.
2. Test Design Mode **Local MCP** feedback delivery to **Pi launched by Paseo**. Check actual Pi MCP discovery/config and the extension's handoff behavior; this integration is **not verified**.
3. Submit feedback on a specific element. Pi edits the tracked source, verifies it, and the existing preview refreshes without downloading or restarting.
4. Repeat for **three rounds**, including a second comment submitted while Pi is working. Report any manual handoff, stale target, or connection failure rather than hiding it.

**Done:** Three real annotation → Pi source-edit → live-preview cycles, without copying feedback into chat or generating downloadable HTML files. Record commands, configuration, limitations, and a short capture. If Local MCP cannot reach a remote Pi, test locally first and document the network boundary before building a bridge.

### 2. Modularize without creating a second app

Once stage 1 works, split the prototype by meaningful responsibility: layout/screen, reusable controls, design tokens, and realistic fixture data. Keep one entrypoint and live URL.

For Paseo/Shiori, favor an **Expo / React Native Web fixture screen using real components** so approved work can move into production. For a separate browser-only project, React + Vite is reasonable. Avoid Astro for this interactive app workflow and avoid two implementations of the same button. A visual CSS edit in Design Mode still needs to be translated into React Native styling where applicable.

**Done:** Change a panel in one focused source module without rewriting the rest of the mock; the preview remains interactive.

### 3. Reusable component catalog

Reuse the components Paseo already ships before extracting new ones. Index a small set of proven controls and layout patterns with the source path, variants, example usage, and token references. Follow [design.md](design.md): a semantic primitive shared by three or more places belongs in the UI primitives.

Only create a shared package across repositories when multiple real consumers need compatible code. Different runtimes may share design decisions or tokens without sharing the exact component implementation. Add Storybook **only if** independent state/variant previews become worthwhile; Storybook and Astro are not prerequisites.

**Done:** The agent can locate and use the existing Button/tokens rather than inventing another style.

### 4. Durable feedback and focused verification

After the MCP proof, make submitted feedback survive reload/disconnect. A minimal record should identify project, worktree, source revision, element locator, comment, and status. Re-resolve or ask for review when an element changed since annotation; never silently apply to an unrelated element.

One agent writes to a given worktree at a time; additional feedback waits. Mark a comment applied only after the source changes and is verified, and let the user approve the result. Reuse Paseo session control and Shiori's existing Task/review/queue boundaries for substantial tracked work. **Do not** build another generic task runner or turn every minor annotation into a Shiori Task.

Run targeted checks for affected interactions, console errors, horizontal overflow, and important screens at 1440×900, 2560×900, and 390×844. Keep screenshot baselines in a consistent environment and only where they prevent real regressions.

**Done:** Pending feedback survives a stopped agent or closed browser; edits do not race; failures remain visible and retryable.

### 5. First-class Paseo experience

When the external loop is reliable, assess a native annotation mode for Paseo's existing workspace browser: select element, attach comment, submit to current agent, track status, and view live changes in the same preview. Reuse the working feedback contract and browser tools. Do **not** assume Firefox/Chrome extensions can be installed directly into Electron.

Prefer a small supported integration/plugin surface if possible; modify core only when the necessary browser hooks cannot be exposed cleanly. Preserve split panes/tabs and worktree identity.

**Done:** Open preview → annotate → Pi updates → review/approve without leaving Paseo; the capability can be reused in other projects.

## Constraints and first experiments

- **Access:** Development previews and annotation data stay local or behind a VPN/authenticated proxy. Paseo's daemon password does **not** protect proxied workspace services; never expose a development preview to the public Internet unprotected ([service proxy](service-proxy.md)).
- **Remote use:** Check whether Firefox + Design Mode Local MCP and the target Pi process must share a host. Cross-machine/private preview access is a separate question from cross-machine MCP handoff.
- **Separation:** Do not let an agent take over the browser tab the user is currently annotating. Both tabs can use the same preview URL and Git tree.
- **Lean agent context:** Give Pi the exact element/annotation and relevant component files; avoid full mock dumps and giant feedback transcripts.
- **No premature framework migration:** Prove the loop with the current HTML before changing it into reusable app components. No new Storybook, Astro, agent-browser, queue engine, or shared design-system package for stage 1.

## Resume here

1. Locate the current Paseo HTML prototype and select its Git worktree (do not assume the chat attachment is already committed).
2. Check existing `paseo.json` services and Paseo browser/Pi MCP configuration.
3. Run stage 1 and document what actually worked or failed.
4. Only then choose the smallest change needed for stage 2.
