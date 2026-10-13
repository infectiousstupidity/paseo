# Pi subagent controls 07 — Only add Interrupt/Resume when semantics are proven

Status: **blocked — interrupt/resume deliberately not exposed (2026-10-13)**. Depends on [06](./pi-subagent-controls-06-panel-v2.md), which is implemented in code but lacks mandatory live/visual acceptance, and on live acceptance of [05](./pi-subagent-controls-05-targeted-actions.md). [Plan](../plans/pi-subagent-controls.md).

## Decision

Upstream RPC includes `interrupt` and `resume`; their use is **not** interchangeable with Stop. The user asked for useful direct controls, not a fake reversible pause. The upstream `resume` path explicitly rejects a stopped run. Do not render a Resume button on a stopped child.

## Implement if validated

1. Live-test upstream `interrupt` for a controlled active single child and a multi-child async run: what state/results are persisted, whether parent and siblings change, and whether the specific child can resume. Read actual installed `pi-subagents` version as well as source.
2. Validate resumability from authoritative `status`/recovery information, not an inferred status icon or stale cached descriptor. Request the required nonempty message in the UI and display the **new async run** returned by `resume`, re-correlating identity; do not claim to restart the same process. Respect current-session ownership and capability ceilings.
3. Extend Task 05's narrow typed protocol only for actions proven safe and supported. Show **Interrupt** and **Resume** conditionally with precise explanations, confirmations and a visible queued/pending/revived outcome. Suppress for foreground/not-owned/stopped/unrecoverable children.
4. No generic pause abstraction, process-kill fallback, model prompt or filesystem RPC. No automatic retry of mutating actions. Missing proof means feature absent.

## Blocking evidence (2026-10-13)

Source-level review is **not** a live acceptance run. This environment has only GitHub repository access, not the user's installed `pi-subagents` extension, running Pi parent session, actual child processes or Electron renderer. We could not identify the installed extension revision, send live interrupt/resume controls, inspect native persisted recovery proofs, verify sibling survival, or capture real panel screenshots. The current upstream `main` implementation is **not** proof of the user's installed behavior.

- **Task 06 is implemented in code but remains unverified.** The panel now exposes guarded Status/Stop/Steer for eligible Pi children; the required real Electron screenshot comparison and live child acceptance still have no evidence. Adding Interrupt/Resume before that gate would be speculative.
- **A paused/recoverable child cannot be identified by Task 05's current public state.** `ProviderSubagentStatus` represents running/completed/failed/canceled; its server-only `controlTarget` is revoked outside `running`. The existing `PiRpcAgentSession.controlSubagent` rejects an inactive run or child for mutating actions. Neither an old row nor a `controlEligible` flag proves native recovery eligibility or a persisted resumable state.
- **Native targeting differs from Stop.** In upstream [RPC implementation](https://github.com/nicobailon/pi-subagents/blob/main/src/extension/rpc.ts), `interrupt` and `resume` normalize `id/runId/dir/index`, not the verified `childId` required by Task 05's safe Stop. A displayed row/index cannot be assumed immutable while parallel children change. Sibling isolation and selection across status→action races require actual proof.
- **Stopped means not resumable.** Upstream [resume target resolver](https://github.com/nicobailon/pi-subagents/blob/main/src/runs/background/async-resume.ts) rejects both `state: stopped` and individually stopped steps; it validates persisted session files, recovery descriptors, worktree/cwd and capability ceilings. Upstream `resume` demands a nonempty `message`. Recovery creates a **new** child/run where revival is needed; it does not continue the stopped process.
- **Paseo cannot currently issue the control mid-turn.** `agent.ts` rejects its slash/RPC bridge as `busy` while the parent Pi agent is running a turn. This is another actual behavior that must be tested, not bypassed through a parent prompt or alternate filesystem/process operation.

**Fail-closed decision:** Do **not** add `interrupt` or `resume` to protocol schemas, the in-process bridge, app client or panel yet. The existing `status/stop/steer` allowlist is unchanged. Added protocol tests explicitly reject unproven interrupt/resume requests and responses; the native target store regression now uses the required `snapshotId` and checks canceled targets lose eligibility. Code checks and tests were **not run** in this GitHub-only environment. Changes committed and pushed as requested, regardless of verification status.

## Minimal evidence required to unblock

1. Finish Task 06's real panel and visual review. In an isolated/disposable running Pi parent, capture the **installed** `pi-subagents` version/revision and its live `ping` capabilities/method list. Record parent session ID and observed exact native child identities, without exposing paths/IDs through a new client RPC.
2. Run a controlled **single-child async** case: acquire fresh targeted native status and persisted recovery evidence, invoke Interrupt exactly once, observe whether the native child/run becomes `paused`, terminal, or another state and whether a recoverable artifact exists. Never interpret an interrupt receipt as resumability proof.
3. Where the native state is provably recoverable, supply a nonempty instruction to Resume **once**; inspect the returned new run identity and reconcile its fresh status. Verify preserved session/capability ceilings and describe the UI as **revived in a new run**, not unpaused in place. Reject any claim of success lacking that identity.
4. Repeat with **two simultaneously active children** and record the untouched sibling before and after Interrupt, and before and after eligible Resume. Prove that `runId + index` selects the intended *exact* child despite intervening status changes; if not, upstream needs a safer identity contract before this feature can ship.
5. Negative live cases: stopped whole run, stopped child in a multi-child run, missing/unrecoverable session or descriptor, expired/cross-session parent, completed/foreground/non-Pi child and capability ceilings. Confirm explicit failures and **zero** actions against the parent or siblings.
6. Only after the above, extend the narrow daemon/client protocol, identity revalidation and Task 06 controls; add receipts, errors, confirmations and focused integration tests, then capture the actual desktop and compact panel. Do not infer eligibility from a stored status icon and do not automatically retry mutations.

If any of these proofs fails, retain this blocked status and leave both controls hidden. No simulated test or static upstream test replaces acceptance against the installed extension.

## Acceptance

One meaningful real integration for interrupt → eligible resumption, and one negative stopped → resume rejected, plus sibling isolation and wrong-session safety. Focused tests and relevant typecheck/lint/format, real panel screenshot at desktop + compact. If eligibility cannot be reliably established, mark task **blocked with evidence**, leave Interrupt/Resume hidden, and do not impede shipping validated Status/Stop/Steer.
