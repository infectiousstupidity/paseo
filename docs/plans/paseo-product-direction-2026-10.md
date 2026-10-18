# Paseo: product direction and experience contract

Status: **accepted product direction / planning capture**, 2026-10-15. Not an implementation specification, not a claim that capabilities below already work. **Next design step:** [Paseo native HTML prototype Task 01](../tasks/paseo-native-html-prototype-01.md) reconstructs current UI from fork source and user screenshots first, then builds a screenshot-validated Current/Proposed interactive comparison. Production application changes remain out of scope. The native application and Shiori integration must be inspected and tested before slicing Tasks.

**Product outcome:** Paseo becomes the single everyday interface for turning ideas into verified products. It is a project partner, execution cockpit, review environment and development workspace. It must retain effortless standalone agent/terminal use. Shiori owns project/task/orchestration truth, Paseo owns native sessions/panes/hosts/desktop UI, SEICHO owns the broader personal project registry, and Pivolution owns retrospective analysis.

Related: [existing Paseo/Shiori exploration](paseo-shiori-workspace-exploration.md), [next prototype contract](../design/paseo-next-prototype-contract.md), [Shiori integration direction](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/plans/paseo-integrated-workflow-direction.md), [SEICHO capture boundary](https://github.com/infectiousstupidity/seicho/blob/main/docs/plans/paseo-project-capture-handoff.md).

## Desired daily experience

1. Open Paseo and see genuine cross-project attention, explicit personal Focus, active work, verified completions and what can run next. No duplicate Review queue and no noisy dashboard.
2. Start an unattached agent chat, or an unattached terminal on a selected host/default home directory, in one action. Never require a project, worktree or Shiori context for either.
3. Select a Project as a **first-class persistent destination**, not merely a heading under Workspaces. See meaningful progress, current runs, task relationships, ideas, questions, decisions, notes, tasks, blockers, origin Git status and next actions.
4. Enter an existing **native Paseo workspace** to operate agents, terminals, browsers, files, diffs and splits. A project can link multiple workspaces across hosts, including isolated task worktrees. Switching panes is not creating or switching projects.
5. From any selected task/paragraph/code line/diff/screenshot/UI element, ask, comment or steer without manually finding filenames or copying text. Keep source/revision, destination and delivery status visible.
6. Read agent sessions in a high-signal Focus view; inspect live observed changes in Activity; retain Full conversation/tool history. Review code or visual evidence from beside the agent with direct feedback and approval controls.
7. Schedule work by cadence, requested time or validated execution condition; inspect 5-hour/weekly cloud pools, reset/freshness and local fallback. **Run after current agent** lets an approved Shiori Task wait behind an ordinary Paseo session's specific work and known subagents, without converting that session into a Shiori Task. Never promise that capacity, completion or concurrency is available based on guesses.
8. Capture new ideas and decisions, prototype UI from approved templates, iterate with Agentation-style annotations, approve the reference, derive implementation Tasks, run/verify/review/finalize, and preserve every linked artifact.
9. Use the same tasks/sessions/review state on Windows ultrawide, MacBook and phone. Responsive presentation differs, underlying identity and execution location do not.
10. Inspect installed skills, tools, prompts and agent workflows; launch evidence-backed one-click reviews, including optional independent local/cloud reviewers and a synthesizer.
11. Exchange prototypes, screenshots, plans and generated files with external cloud chats without reassembling context. Drag/drop into a real selected project directory; browser-hosted web chats are optional.
12. Let SEICHO, CLI, integrations and model-driven commands safely propose or perform narrow project operations, including captured notes, without inventing a second project-state store.

## Information architecture: four jobs, one shell

- **Home (global):** Current Focus (explicit user selection), Needs you (actual approvals/questions/failed or blocked handoffs), Running (live agents/tasks), Queue/Next, Recent verified outcomes. A compact always-available usage/capacity indicator. Do not conflate active task or currently viewed project with Focus.
- **Projects:** project index and a persistent Project Home. Within a project: Overview, Plan (features/ideas/tasks/map/queue), Runs (real agent executions and evidence), Knowledge (notes/questions/decisions/docs). Git, capture and New Agent actions remain accessible in context. These are suggested labels/hierarchy, subject to interactive validation; avoid duplicate subnavigation.
- **Workspaces:** the existing native pane/tab/split-tree with conversation, draft, terminal, browser, file editor/explorer, diff, pull request and plugin panels. The active project may have several. Project selection alone should not terminate or launch sessions.
- **Tools / configuration:** Schedules, Usage, Hosts, Settings, installed skills, optimization analysis and command center. Preserve existing source capabilities even if some move within navigation.

**Hierarchy:** SEICHO personal Project identity (cross-domain, when linked) -> Shiori software Project/Plan -> feature/area (projection or approved Shiori identity) -> Idea/Task/Question/Decision/Note/Review -> Paseo execution workspace(s)/agent session(s)/artifacts. Git repository, branches and worktrees are version-control identities, not duplicated project records. Monorepos and several projects per repository remain possible. A worktree can be created for a task automatically; users need not manage it before planning.

## Existing Paseo feature parity is mandatory

Inventory each capability in the current fork and preserve its reachable user path:
- Sidebar new workspace; add existing directory/clone GitHub/create directory as Project; host selection and per-host workspaces; local checkout/worktree and starting ref; projects and workspace settings.
- Persistent bottom actions for Add Project, Usage, Hosts, Help, Settings; History/session browser, Search/Command Center, Schedules, plugin navigation, sidebar preferences/filter/group by project or status; keyboard shortcuts.
- Project/workspace edit, label, pin, rename, read/unread, archive, folder/open-new-window and path/branch copy actions.
- Native tab lifecycle, drag/move/split/resize/maximize/focus/persistence, browser and terminal profiles, agent session import/refresh, model/provider/thinking/modes, attachments, voice and supported Pi subagent controls.
- Files, diff, Git changes/commit/push/pull/merge/PR review, terminal processes, project scripts; app and host configuration including connection, diagnostics, pairing, updates, permissions and plugins.
- Responsive/mobile and Mac support, existing keyboard accessibility, real host/source status, safe errors and empty states.

**Critical behavior:** closing an agent tab in the current fork can archive its agent; closing a terminal tab can terminate the process after confirmation, while some subagent tabs are layout-only. Never casually redefine X as harmless dismiss. The new prototype must expose an intelligible Close view vs Stop/Archive policy, with real implementation semantics separately verified before any changes.

## One continuous outcome-first workflow

~~~text
Capture idea -> project-aware discussion -> propose decisions and scope
 -> UI prototype (when useful) -> annotate/ask/iterate
 -> accept versioned design/reference + screenshots + behavior
 -> propose features, task docs, dependencies, evidence and queue order
 -> approve plan/permissions -> start serial authorized work
 -> implement -> deterministic checks -> independent review -> bounded fixes
 -> screenshot + interaction/functional verification
 -> focused human judgment only where necessary
 -> safe Git reconciliation/commit/push per policy -> project updated
~~~

One durable linked feature/work item should navigate its ideas, conversations, references, tasks, runs, evidence and result. Implement as links/projections over Shiori's existing records before introducing any new persisted entity. Preserve exact accepted spec and artifact versions; agents must not silently move the visual target or decide that unverified execution means Done.

## Contextual interaction contract

- Selection across agent messages, Markdown, tasks, graph nodes, diffs, source files, screenshots and rendered UI yields **Ask**, **Comment**, **Suggest change/Steer**, **Explain**, and **Open source** only where appropriate.
- A minimal context reference contains target kind, stable project/task/session/artifact identity, exact source revision plus section/range/region, and permitted destination. Respect source/host access boundaries.
- **Ask** is a read-only side inquiry by default, not an interrupt or new mutating run. **Steer** targets a declared current agent, displays delivery as sent/queued/interrupt-required/unavailable, and never promises to change an in-flight tool operation. **Comment** is a saved draft until explicitly submitted/bundled. Structured approval is separate from both.
- Re-anchor only on proof; otherwise mark stale and let the user inspect. Prevent feedback drafts from being lost on navigation. Preserve ability to see source and answer side by side; review annotations are never implicit task spec modifications.
- Study Plannotator, HumanLayer and existing Agentation Pi dispatch plans; validate actual plugin/RPC support before adopting transport or per-annotation agent spawning.

## Agent output, execution and review

- Focus: objective, milestone, current status, concise evidence, blocker and next valid action; no fake progress or wall of indistinguishable tool prose.
- Activity: real observed tool/file events, paths, change ranges, status and action to open native diffs. Do not confuse tool intention with observed filesystem results.
- Full: original ordered transcript/tools, searchable and accessible. Rendering compression must not discard data or secretly shrink provider context.
- Execution inspector: root orchestrator -> children -> specialist role, parent relation, model/provider, reasoning, tokens/context, elapsed, live activity, retries, supported Stop/Interrupt/Resume semantics, grounded TPS/TTFT/prefill/cache/usage only when sources support them. Aggregate concurrent sessions across hosts without double counting.
- Shared review inspector from Home, Project, Task or Agent. Show what changed, why, what passed, what's missing, suggested next action, diff/screenshot/evidence and precise Approve/Request changes/Reject rules. No duplicate global/project queues.
- Real Git/source reconciliation and checks remain owned by the existing Shiori/Paseo code; respect dirty checkout and conflicting writes. Parallel read-only investigations differ from parallel mutating workers.

## Prototypes and external artifacts

**Future native workflow:** [Embedded HTML mock preview and feedback in Paseo](paseo-embedded-html-mock-workflow.md) — an in-workspace live Preview pane beside the agent, anchored annotations, explicit submit -> agent edit -> hot reload, and versioned acceptance. This is a future implementation idea, distinct from the current standalone interactive mock task; no embedded production runtime is claimed.

- Deterministic **Prototype Profiles** define approved design tokens, typography, layout, preferred dependencies (e.g. React, Mantine, Tailwind where compatible, Joyride for tours, Agentation for development), scaffold, browser/test fixture, viewports, export and version. Defaults plus project overrides; avoid installing libraries without need.
- Prefer a pinned runnable Vite/React project as canonical when dependencies are used; optionally generate portable HTML. Approved starter components, layouts and visual references reduce repetitive re-prompting, not creativity. The future native Preview should read this project artifact directly instead of requiring HTML download/re-upload.
- A prototype revision preserves source, lockfile/profile version, captured screenshots, verified states, accepted interactions and design decision. Screenshot comparison + functional checks run with controlled browser/Electron capture, without stealing desktop focus; bound fixer iterations and label unverified results.
- **Export for AI chat:** select exact assets and bounded context, redact/check secrets, generate portable files and a copyable request; no invented external chat integration. **Import:** drag files onto project/feature/folder, show real host/path/conflict, safe file/ZIP handling and real on-disk write through authenticated host. Display immediately in explorer/Git; import alone is not acceptance of generated content.
- Embedded ChatGPT/Claude/etc. in Paseo browser is optional and contingent on real login/site/embedding constraints; external Firefox workflow must work independently.

## Assistant commands and optimization

- Paseo Assistant = a thin natural-language router to authenticated, typed project/session/action commands, not a constantly running autonomous model. Direct UI/CLI/API actions should be deterministic; ambiguous project identity/unsafe permission gets clarification or a reviewable proposal.
- SEICHO imports Signal/bookmarks/inbox messages, links a canonical Project using explicit known source IDs, then routes an authorized note/question/task proposal to Shiori/Paseo commands. Never create/merge projects from filename similarity or model guesses. Never let an untrusted message become arbitrary shell execution.
- Optimization Workbench discovers installed skills/tools/prompts/hooks/MCP servers per host and shows effective scope/version, with **Review skill/tool** actions. Mechanical checks first; optional independent local + cloud reviews on identical revision, reconcile disagreements, propose a diff, run controlled eval/verification, require review for protected edits. No three-model tax on trivial operations.
- Reuse Pivolution read-only longitudinal evidence and Shiori controlled-eval/runner/proposal APIs. Scheduled competitor/Paseo self-reviews produce *proposals* and should not self-modify the application or install new tools without authorization.

## Performance, scheduling and permission invariants

- Keep 5-hour + weekly pooled cloud usage and reset times visible, with observed freshness and unknown states. Reuse codex-lb read-only usage and Paseo source registration; Shiori can read for route admission without another quota ledger.
- Schedules can request fixed times, recurrences or conditions such as proven capacity reset; current Paseo cadence scheduling exists, conditional start is a proposed extension. Shiori owns a single durable queue and eligible-task admission, not another scheduler. A blocked queue head must not be silently skipped; display why.
- **Selected-agent completion condition (planned):** From an agent pane or Project Task/Run-plan action, capture the chosen Paseo agent and its currently observed work; prepare/approve Shiori Tasks while it runs; show **Queued · waiting for current agent** with an exact link and reason, including active child agents. Paseo owns live managed-agent/child evidence; Shiori owns the persistent wait, final admission and normal Harness. A parent marked `idle` while children still run is not a completed job. An unrelated standalone Pi process, another unconnected host, or unknown provider child status is not silently counted as finished. The first release is a selected managed agent, not inferred global mutating-agent surveillance. See [Shiori UX-17](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/tasks/ux-17-external-agent-aware-admission.md) and [UX-16 prompt batch](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/tasks/ux-16-batch-prompt-intake.md).
- Default to the cheapest safe deterministic operation: no model for lookups, routing known IDs, scaffold generation, data writes, screenshot capture or objective checks. Use models for genuine interpretation/design/judgment, with bounded context and configurable provider routing.
- Cross-device UI presents identical authoritative entities and permissions, with device-appropriate navigation/layout. Reopening on S23/M1 is view transfer, not a duplicate execution or migration of the working host.

## Current decisions vs open design

**Accepted directions:** first-class Project navigation; native Paseo split/tab preservation; no competing task/queue/review database; project-independent agent/terminal; contextual anchored feedback; evidence-based output and reviews; reproducible prototyping; real import/export; typed secure commands; skills/optimization workbench; cross-device continuity.

**Proposed until tested:** exact labels/tabs, sidebar hierarchy, session close behavior changes, one work-item/feature identity, generic context-reference schema, host file-transfer transport, conditional scheduler admission, source event granularity, cloud web-chat embedding, multi-model review UX, named layout presets, optimization telemetry availability.

**Not claimed:** live multi-device proof; reliable prefill for every provider; safe parallel Git mutation; browser-based cloud chat automation; built-in IDE parity with VS Code. Rich native editing is a future increment, not a prerequisite for useful files/diffs.

Next step is **design exploration**, not implementation Tasks. Read [next prototype contract](../design/paseo-next-prototype-contract.md); make an interactive coherent app mock against the actual fork shell, with functional scenario walkthroughs and feature-parity checks before deriving focused implementation tasks.
