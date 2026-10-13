# Agentation Task 01 — integration evidence and remaining live gate

Reviewed 2026-10-13. Status: **PARTIAL — LIVE GATE BLOCKED/UNVERIFIED**. This is evidence for [Task 01](../tasks/agentation-01-integration-proof.md), not authorization to build the production dispatcher. Paseo and SEICHO applications were **not** changed as part of this task.

## Actual execution environment

This execution used a hosted Linux development container with Node `v22.16.0`; not the user's Windows 11 SEICHO desktop/Paseo daemon/Pi host. `pi` was not installed or on PATH. The container could not reach github.com using `git ls-remote` (DNS resolution failed). Repository sources were read through the GitHub connector and upstream public documentation; neither is evidence of an installed runtime version. No authenticated Paseo daemon, active parent Pi session, actual Agentation MCP server, Windows Electron development app, or personal local home directory was available. No inference should be drawn about the user's installed versions, child execution, permission success, or model token usage.

## Verified from current source, not live runtime

1. **Intent.** SEICHO `apps/desktop/src/renderer/dev/dev-annotation-host.tsx` sets `onSubmit={submit}`; `submit` snapshots an array of annotations and awaits `globalThis.seicho.exportDevAnnotations(batch)`. This is an intentional Send event (not `annotation.created`) and currently exports one combined Task. It does not dispatch a Pi child. `onAnnotationAdd` only stores the local screen lookup. The existing fallback retains the note on export failure.
2. **Session identity.** Current SEICHO `DevAnnotationBatch` exposes `screen` and `annotations: {id, screen, comment, ...}` but not Agentation's session ID. The current upstream Agentation API lists optional `sessionId` and `onSessionCreated(sessionId)` props, potentially avoiding invented identity. **Unverified for installed `agentation@3.1.2`** and actual endpoint/session lifecycle. Hash-route separation means an app-level ID is not automatically an annotation-session ID. Do not use a fabricated `source_session_id`; prove a persisted, source-qualified namespace and retries across routes/restarts first.
3. **SEICHO authority.** The only current writable Electron dev channel is `seicho:dev:exportAnnotations`, guarded by nonpackaged app, Vite origin/path, main-window/main-frame identity. It validates the checkout and writes `docs/tasks/`. It provides no Paseo authentication or dispatcher. That guard is valuable but insufficient as authorization at the Paseo daemon. Existing Paseo documentation uses authenticated principals/credentials; `workspace.write` is the semantic permission for agent control. **No safe existing credential/channel from SEICHO to Paseo has been demonstrated.**
4. **Pi bridge.** Current Paseo `packages/server/src/server/agent/providers/pi/subagent-rpc-bridge.ts` offers narrow `ping`, `status`, `stop`, and `steer` through an injected command (Task 04/05 code has advanced since original plan). **There is no exposed `spawn` method.** The host path is a Pi slash-command call and the agent adapter can report `busy` during an active parent turn. Do not assume this bridge can satisfy the zero-parent-turn, busy-parent dispatch requirement.
5. **Upstream Pi extension API.** `nicobailon/pi-subagents/docs/extension-api.md` documents the in-process `subagents:rpc:v1:request`/`reply:<requestId>` contract, async-only `spawn` with `context: "fresh"`, `status({id:"rpc-spawn-<requestId>"})` for lost-reply reconciliation, and runtime registration of a restricted agent with `tools: []`. Those are **upstream source capabilities**, not evidence that the exact locally installed `pi-subagents` supports or advertises them. A common reviewer agent must **not** be assumed read-only without checking its effective tools.

## Executable isolated storage probe

Commit contains [`scripts/agentation-01-storage-proof.mjs`](../../scripts/agentation-01-storage-proof.mjs). It is intentionally a **standalone node:test script** that creates and deletes an OS-temporary fake home, never writing to real `~/.agents/` or modifying production Paseo/SEICHO. Its source namespace is explicitly supplied as synthetic fixture data; it does **not** solve installed Agentation ID provenance.

Command exercised in hosted Linux:

```sh
node --test scripts/agentation-01-storage-proof.mjs
```

Result: **5 passed, 0 failed** (Node 22.16.0, Linux). Tested:
- identical submission is a no-op for a stable Markdown record;
- changed comment retains the original and creates a revision entry;
- separate annotation IDs or source namespaces do not alias;
- path traversal/symlinked feedback root/non-directory rejected;
- POSIX generated file mode `0600`, record confined to synthetic home.

**Limitations:** This is a *contract demonstration*, not production storage code or Windows NTFS proof. It lacks authenticated real submission, real timestamps, stable source-namespace ownership, durable run correlation, power-loss guarantees, complete schema parser, crash-lock recovery, Windows ACL checks, and full A→B→A explicit revision semantics. Do not promote it to product code unchanged or mark Task 01 accepted based on these mock/isolated tests.

## Live proof still required before Task 02

- On the actual Windows/Paseo installation, record `pi --version`, the **loaded** `pi-subagents` module/version (not only `npm ls`), `ping` advertised methods and exact parent session identity; complete Task 04's pending live gate without assuming prior tests prove it.
- Verify Agentation **installed version** callbacks and actual onSubmit 2-note delivery, `sessionId` lifecycle across Inbox→Today→Inbox, reload, retry, and independent app instances; choose and document the stable source namespace.
- Identify and test a real authenticated transport between SEICHO Electron main and Paseo **or** a user-initiated authenticated Paseo action with clear user ownership; check wrong-principal/wrong-parent rejections and `workspace.write` checks. No unauthenticated loopback endpoint or copied browser token.
- Establish which host/user's home owns `~/.agents/feedback/` (remote daemon home is not the Windows user's home). On that *actual* host, test durable write-before-spawn, duplicate submission, denial/locked/read-only full disk, private permissions/ACLs, and restart behavior. Do not use personal annotation data in public logs/commits.
- Prove a **true in-process Pi `spawn`** from the injected integration during idle, active parent turn, and idle parent with async child; no `runtimeSession.prompt` and no parent model tokens attributable to dispatch. Enforce a disposable child with verified `tools: []` and short bounded task, `context:"fresh"`, active parent/child/session IDs and cleanup. Do not run a separate Pi process as a substitute for this test.
- Drop an acknowledgment, check `status({id:"rpc-spawn-<requestId>"})` on the installed version, ensure child isn't duplicated, parent/session cleanup, no events leaking into the model conversation; record honest `uncertain` when evidence expires.

If any of these cannot be demonstrated, Task 01 remains **BLOCKED** and Task 02 must not begin. Static source review is not a live proof; tests run only inside a hosted Linux container cannot establish remote Windows/Pi facts.

## Sources checked

- [SEICHO renderer callback](https://github.com/infectiousstupidity/seicho/blob/main/apps/desktop/src/renderer/dev/dev-annotation-host.tsx)
- [SEICHO annotation DTO](https://github.com/infectiousstupidity/seicho/blob/main/apps/desktop/src/shared/dev-annotations.ts)
- [SEICHO IPC authorization](https://github.com/infectiousstupidity/seicho/blob/main/apps/desktop/src/main/dev-annotation-ipc.ts)
- [Paseo current bridge](https://github.com/infectiousstupidity/paseo/blob/main/packages/server/src/server/agent/providers/pi/subagent-rpc-bridge.ts)
- [Paseo permissions](https://github.com/infectiousstupidity/paseo/blob/main/docs/permissions.md)
- [Agentation API](https://www.agentation.com/api)
- [Pi subagents upstream extension API](https://github.com/nicobailon/pi-subagents/blob/main/docs/extension-api.md)
