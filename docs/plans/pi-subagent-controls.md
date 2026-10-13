# Pi subagent controls and compact panel — delivery plan

Status: **04 and 05 implemented in code, live acceptance unproven; 06 and 07 pending**. Verified against Paseo main `afdb8157a1` and the public `nicobailon/pi-subagents` RPC implementation on 2026-10-13. This follows the completed [Pi subagent monitor](./pi-subagent-monitor.md). The checked-in [interactive V2 HTML mock](../mockups/paseo-subagents-v2.html) is the visual/interaction reference, not executable production UI. **Task 06 requires capturing that mock and the actual Electron app in matched states, comparing side by side, correcting layout and repeating**. Use Paseo's own components and tokens; do not port the HTML sample's CSS or fabricated demo data.

## Goal

In the existing subagent track/popover, identify the actual child, inspect trustworthy status and outcome, and directly control an eligible Pi child **without consuming parent-agent model tokens**. A stopped child is *not* a paused/resumable child. The UI must never accidentally stop a parent async run or an unrelated sibling.

## Verified architecture

Paseo's daemon and Pi agent run in different processes. The `pi-subagents` in-process event-bus RPC (`subagents:rpc:v1:request`, `subagents:rpc:v1:reply:<requestId>`, `subagents:rpc:v1:ready`) can only be called by an extension **within the Pi process**. The injected Paseo integration at `packages/server/src/server/agent/providers/pi/agent.ts` already registers local commands and sends correlated `ctx.ui.notify` markers back to the daemon. Extend that facility instead of adding a websocket connection to Pi, filesystem control writes, or model-mediated prompts.

The upstream RPC advertises `ping`, `status`, `manage`, `spawn`, `steer`, `interrupt`, `stop`, `resume`, `cost`. This feature must expose only reviewed controls, not a generic caller-supplied RPC dispatch. Advertised methods/version from the **installed** extension are authoritative.

IMPORTANT TARGETING: `stop({runId})` targets the **whole async run**. To stop a **single** child, the upstream RPC requires an exact `childId`, resolved against the run's actual `status.steps` (see `src/runs/shared/child-identity.ts`). Supplying `index` alone to `stop` does **not** safely select a child. Never guess `childId` from a Paseo row ID, tool-call ID, array position, fleet key, or task prompt. Upstream fleet keys are display-only and deliberately opaque. The existing Paseo Pi adapter `extensions/pi-subagents/index.ts` correlates `toolCallId` and `runId` but does not publish a validated control identity. Foreground and other-provider children can be displayed without being controllable.

Upstream `stop` acknowledgement means `state: stopping`, **not** terminal proof. Keep the UI pending until observed terminal status. Stop is not Resume: upstream revival rejects a stopped run. Steer can be delivered or queued. Resume needs a nonempty instruction and verified eligible paused/recoverable state.

## Delivery order

1. [04 — Prove the in-process Pi RPC bridge](../tasks/pi-subagent-controls-04-pi-rpc-bridge.md)
2. [05 — Authoritative child targeting, Status, Stop, and Steer](../tasks/pi-subagent-controls-05-targeted-actions.md)
3. [06 — Compact, legible panel and action UX](../tasks/pi-subagent-controls-06-panel-v2.md)
4. [07 — Interrupt/Resume only with verified semantics](../tasks/pi-subagent-controls-07-interrupt-resume.md)

Every slice is a separate commit. Implement 07 only if its live semantics can be proven; otherwise leave those buttons absent and mark task blocked with evidence. No automated retries of mutating RPCs. Do not make a best-effort fallback to a parent natural-language prompt.

## Visual hierarchy (Paseo design tokens, not raw HTML styles)

- Compact header: active / attention / finished totals, never a dense metadata string or oversized status badge.
- Ordered sections (only when populated): **Needs attention**, **Working**, **Recent results**. Do not make each row its own bordered card.
- Row: concise human task/action title; below, a single meaningful *outcome/activity* line. Place small status/role at the end. Full original prompt, repo paths, model/usage, exact source details, timestamps and actions belong in the one expanded row. Do not pretend a stale `## TL;DR` or `## Review` Markdown heading is a result.
- Only one expanded row; keep it inside the existing scrollable `ComposerTrackPill` compact sheet/desktop popover. Short expanded task section, last observed result, then actions near the top.
- Stop is visible only on *verified controllable* running children. Confirm destructive Stop with target name; disable while pending; show `Stopping…` after acknowledgement and `Stopped` only when status confirms. Steer has a short input and reports `Queued` vs `Delivered` exactly. `Status` is read-only; it must not poll for every closed row. Failed controls retain the row and show error.
- The summary should not invent success, findings, grouping, agent model or elapsed execution time. Extract useful final report content from explicit structured evidence or skip Markdown headings; otherwise use neutral `Result unavailable`.
- Preserve keyboard navigation, sibling action Pressables (no nested buttons), scroll height, 360px wrapping, dark-mode contrast ≥4.5:1 for normal text, accessibility, reduced motion, and the ordinary managed/Pi-other-provider child behavior.

## Compatibility, security, and performance

Feature capability is gated by the daemon and live Pi bridge handshake. Old clients/daemons and missing/older `pi-subagents` remain functional: no actions appear where unsupported. Validate authenticated daemon session/parent/child ownership **before** executing, and let upstream validate current-session ownership again. Never accept untrusted `asyncDir`, raw code, `spawn` or `manage` operations from the app. Read and implement existing `docs/protocol-compatibility.md`, `docs/rpc-namespacing.md`, `docs/permissions.md` contracts.

No frequent status timers, heavy per-child transcripts, new stores, additional external processes, or generic extension-control frameworks. Preserve task archive/dismiss semantics and Shiori-independent operation.

## Completion criteria

Live Pi async child: target resolved → status read → Stop confirmed → accepted receipt → observed terminal state. A sibling stays running after a single-child Stop. Steer shows queued/delivered truthfully. Missing targets and unsupported versions never display controls. Other provider children still open normally. The V2 mock and real Electron panel must be screenshot-captured in matched desktop collapsed, desktop expanded running/findings and 360px states; compare, fix and recapture until the Task 06 visual gate passes. Document exact evidence paths and outstanding differences; no fake screenshots or unverified claims. Existing focused Pi adapter, daemon RPC, protocol, client, and app test files pass with relevant typechecks, lint, formatting. Never restart the active Paseo daemon on port 6767.
