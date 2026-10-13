# Pi subagent controls 07 — Only add Interrupt/Resume when semantics are proven

Status: **ready (conditional)**. Depends on [06](./pi-subagent-controls-06-panel-v2.md). [Plan](../plans/pi-subagent-controls.md).

## Decision

Upstream RPC includes `interrupt` and `resume`; their use is **not** interchangeable with Stop. The user asked for useful direct controls, not a fake reversible pause. The upstream `resume` path explicitly rejects a stopped run. Do not render a Resume button on a stopped child.

## Implement if validated

1. Live-test upstream `interrupt` for a controlled active single child and a multi-child async run: what state/results are persisted, whether parent and siblings change, and whether the specific child can resume. Read actual installed `pi-subagents` version as well as source.
2. Validate resumability from authoritative `status`/recovery information, not an inferred status icon or stale cached descriptor. Request the required nonempty message in the UI and display the **new async run** returned by `resume`, re-correlating identity; do not claim to restart the same process. Respect current-session ownership and capability ceilings.
3. Extend Task 05's narrow typed protocol only for actions proven safe and supported. Show **Interrupt** and **Resume** conditionally with precise explanations, confirmations and a visible queued/pending/revived outcome. Suppress for foreground/not-owned/stopped/unrecoverable children.
4. No generic pause abstraction, process-kill fallback, model prompt or filesystem RPC. No automatic retry of mutating actions. Missing proof means feature absent.

## Acceptance

One meaningful real integration for interrupt → eligible resumption, and one negative stopped → resume rejected, plus sibling isolation and wrong-session safety. Focused tests and relevant typecheck/lint/format, real panel screenshot at desktop + compact. If eligibility cannot be reliably established, mark task **blocked with evidence**, leave Interrupt/Resume hidden, and do not impede shipping validated Status/Stop/Steer.
