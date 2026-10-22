# Shiori isolated visual capture — Verify a nonintrusive real Paseo host

Status: planned; requires an isolated QA host. This is **host capture support**, not a Shiori UI redesign, new browser controller, or extension API. See [visual implementation cross-repo plan](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/plans/isolated-visual-implementation.md).

## Outcome

A Pi/Shiori agent can capture the actual Shiori plugin inside a **separate Paseo Electron host** at narrow sidebar and wider workspace widths, without interacting with, focusing, restarting, or changing the user's running Paseo daemon/window.

## Existing mechanisms to inspect first

- `packages/desktop/scripts/verify-electron-cdp.mjs` already imports Playwright and captures genuine renderer screenshots and geometry.
- `packages/desktop/capture-harness/` and `docs/browser-capture-harness.md` already prove real-Electron compositor behavior; notably their macOS nonfocusing `showInactive()` procedure and Windows-relevant parked/copyable surfaces.
- `packages/desktop/playwright.config.ts` and `test:e2e:renderer` already provide Playwright infrastructure.
- `packages/app/` and the Shiori plugin API implement the actual React Native Web host; do not replace it with standalone HTML or a fake isolated React page.

## Implement

1. Investigate whether the existing desktop capture harness can mount a real installed Shiori plugin in a disposable host/user-data profile, isolated daemon/endpoints, with a real sidebar and optional full workspace. If it already can, **reuse it and add only the missing scenario/command and documentation**. Do not duplicate its capture or compositor logic.
2. If `verify-electron-cdp.mjs` is reusable only against a *normal* open host, extend its targeting/runner setup narrowly to target **only an owned isolated QA host**, identified by process, temporary profile and CDP port. Reject a target that belongs to the shared daemon. Never start, terminate, or reconfigure the shared resident Paseo instance.
3. Capture full UI screenshots with 420px Shiori explorer and one wide Shiori workspace in a meaningful ready/done/needs-input fixture state. Record viewport/DPR, host and plugin revisions, state/data origin, screenshot path, native host chrome behavior, and measured rectangles. Keep images in ignored QA artifacts.
4. Validate hidden capture freshness on Windows. Where a hidden compositor fails, use the existing inactive nonfocusing test-window technique if independently proven for that platform; do not call `show()`, `focus()`, or send OS mouse/keyboard commands. Never assume an Electron CDP screenshot is a physical window resize proof.
5. Demonstrate actual navigation to an appropriate Shiori state and recapture; verify image changes. Keep per-Project fixtures isolated from real Shiori PostgreSQL/task queues. An unavailable plugin fixture/host is a reported blocker, not justification for a fake screenshot.
6. Keep the change small. No playwright-core duplication, custom vision API, second MCP server, TesterArmy e2e, Midscene, Shiori scheduler or speculative refactor.

## Acceptance

- Actual Shiori plugin within an **isolated Electron Paseo host**, not a mock, generates nonblank distinct screenshots and metadata at both sizes. A stale or incorrect CDP target is refused.
- Shared Paseo daemon/session stays uninterrupted, no foreground-focus change occurs, no personal data read/write, and no orphan host process remains.
- Evidence is usable by the Shiori independent image reviewer. If only a controlled manual host check is possible, report that accurately and leave automated host-capture acceptance blocked.
- Any code is built atop existing desktop capture/test facilities, not a new framework.

## Minimal checks

```sh
node --check packages/desktop/scripts/verify-electron-cdp.mjs
npm run typecheck --workspace=@getpaseo/desktop
```

Only run a live Electron host visual proof on the isolated QA instance. Avoid broad renderer E2E tests against the user's normal desktop/daemon.
