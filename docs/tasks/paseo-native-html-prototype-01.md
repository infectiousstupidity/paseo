# Paseo native-UI prototype 01 — faithful baseline + integrated interactive redesign

**Status:** Ready for a fresh design/prototyping agent once the user supplies current Paseo screenshots. **Type:** prototype/documentation only; NO production Paseo/Shiori/SEICHO/Pivolution implementation. **Owner:** Paseo fork. **Target:** one coherent working HTML/React prototype, with Current/Proposed comparison and visual evidence. **Date:** 2026-10-15.

## Agent assignment (read this first)

Build a **high-fidelity, fully navigable interactive prototype of the proposed Paseo experience, visibly grounded in the ACTUAL CURRENT Paseo UI**. The user will provide screenshots of their current installed Paseo fork in addition to this repository. Start by reconstructing the existing desktop shell accurately, not by designing a standalone Shiori app or a generic AI dashboard. Once the baseline resembles the actual application, progressively integrate the accepted project-centric, agent-activity, review and idea-to-product workflows. Let the user switch between **Current Paseo** and **Proposed Paseo** while retaining the same project/route/viewport where possible.

**The prototype is the deliverable.** Do not refactor, modify, run mutating commands against, or replace the real application. Do not start a background agent, Shiori task runner, or live backend. All execution, writes, provider quotas, agent outputs, filesystem transfers and Git operations inside the mock are explicitly simulated with deterministic fixtures and honest UI states.

### Inputs / reading order (all required)

1. **Screenshots supplied by the user in the new agent session**. Inventory them before coding: filename/attachment, screen, target device, viewport/DPR if available, UI state and timestamp. The images show what the user really sees; treat them as the visual baseline, not as copyable artwork. If screenshots are not yet accessible, ask for them and inspect the code/docs in the meantime; **do not claim screenshot-matched fidelity** without them. Additional screenshots are welcome during iteration.
2. [Paseo's product direction](../plans/paseo-product-direction-2026-10.md) — accepted jobs-to-be-done, domain boundaries, feature-parity and UX direction.
3. [Prototype scenario and acceptance contract](../design/paseo-next-prototype-contract.md) — S1–S14, live interactions, responsive states and proof requirements.
4. [Earlier exploration](../plans/paseo-shiori-workspace-exploration.md) — reuse native panes, Shiori context/review, interaction, quota and known open questions. Its old layout diagrams are *exploration*, not the new shell baseline.
5. Actual present source of this Paseo fork, especially:
   - `docs/design.md`, `packages/app/src/styles/theme.ts` and `packages/app/src/components/ui/`;
   - `packages/app/src/components/left-sidebar.tsx`, `packages/app/src/components/sidebar/`, related workspace and project rows/actions;
   - `packages/app/src/screens/workspace/workspace-screen.tsx`, `workspace-desktop-tabs-row.tsx`, `workspace-new-tab-menu.tsx`, `workspace-tab-menu.ts`, `packages/app/src/panels/panel-manifest.ts`;
   - `packages/app/src/panels/agent-panel.tsx`, `provider-subagent-panel.tsx`, `packages/app/src/composer/`, file/diff/browser/terminal panels and native Git controls;
   - `packages/app/src/screens/new-workspace-screen.tsx`, `projects-screen.tsx`, `settings-screen.tsx`, `schedules-screen.tsx`, host/usage and import-session flows.
6. Reference integration contracts, **only as needed**: [Shiori plan](https://github.com/infectiousstupidity-labs/shiori/blob/main/docs/plans/paseo-integrated-workflow-direction.md), [SEICHO capture](https://github.com/infectiousstupidity/seicho/blob/main/docs/plans/paseo-project-capture-handoff.md), [Pivolution workbench](https://github.com/infectiousstupidity/pivolution/blob/main/docs/PASEO_OPTIMIZATION_WORKBENCH.md).

Previous standalone project/workspace mock screenshots, Shiori v5 and earlier generated HTML are **not** correct representations of the Paseo shell. Do not use their layout as the base or visual acceptance target; salvage only useful behavior after checking the current source.

## What the screenshots should cover

The user will supply whatever they have. Make a short screenshot inventory and record coverage/gaps. Prioritize:
- Normal Paseo overview/left sidebar showing projects, nested workspaces, usage and bottom navigation (including Help/Settings/Hosts/Add Project).
- Agent session (idle and actively working) with composer and tabs, subagent panel if available, side-by-side files/changes/diff.
- A current Shiori workspace and its project/sidebar/review or task experience (to identify overlapping navigation).
- Settings, Hosts, Add Project/New Workspace, Usage/Codex quota, Schedules, and Git/Files/Browser panels where screenshots exist.
- At least one desktop ultrawide/full-size screenshot and, if available, Mac/mobile widths.

Do not wait for every optional screenshot to start. For uncovered screens, derive conservative baseline composition and behavior from real source code, mark lower-confidence regions, and request targeted captures when essential. No user screenshot should be committed if it shows private sessions, paths, account details or credentials without explicit approval. Local comparisons/evidence may remain in ignored output folders.

## Execution stages — keep them in this order

### A. Audit and current-shell baseline

1. Check current HEAD. Map **real** navigation objects: global routes, project vs workspace vs agent identity, sidebar footer, top tab targets, split/explorer panes, command/search, settings/hosts/schedules/usage, Git/files/browser/terminal, and active session lifecycle. Note where current mock UX had duplicated Needs Review and Project Review.
2. Build a **Current Paseo** view using the real shell composition: left sidebar/sidebar group hierarchy, title and tab bars, native workspace panel split, composer dock, footer/tool buttons and representative existing flows. Use the fork's actual tokens, sizes, spacing, typographic hierarchy, icons and interaction conventions; compare to supplied screenshots. Fidelity matters more than speculative improvements at this stage.
3. Reuse existing Web-compatible source components **only if isolated reuse is practical without starting/mutating the app or pulling in most of RN/Expo state**. Otherwise reproduce their visual and behavioral contracts in an isolated HTML/React prototype. Do not build a second implementation inside `packages/app/` just to prototype.
4. Inspect tab X / archive / terminal close semantics in source. Do **not** assume clicking X always means harmless hide; mock any currently ambiguous or proposed lifecycle changes with clear labels and confirmation. Existing behavior wins for Current mode.

### B. Proposed integrated design

Evolve the same shell rather than replace it:
- **Global Home:** explicit Focus, genuine Needs you, running agents/tasks across projects, queue and next eligible work, verified recent results, compact live/stale/unknown 5-hour and weekly usage. No endless vertical dashboard or tiny centered lists.
- **First-class Project:** selecting SEICHO reaches a persistent Project Home with Overview/Plan/Runs/Knowledge (labels may improve with evidence). Show real-feeling Task/Feature relationships, ideas, notes/questions/decisions, blockers and reason, current orchestrator, Git state, planned order, schedules and quick capture. Distinguish SEICHO personal Project identity, Shiori software Project, Git repo, workspace and sessions.
- **Agent/workspace:** retain recognizable native tabs/split panes, provider/model/thinking/composer, files/diff/browser/terminal. Add Focus/Activity/Full presentation over the same simulated session, live observed file changes, clear orchestrator-child hierarchy, elapsed/model/reasoning and only trustworthy-or-unavailable telemetry.
- **Context selection and review:** select actual mock code lines or Markdown/agent text -> context-aware Ask / Comment / Steer with exact location, revision, destination, delivery/queued status and no forced interruption; inspect diff and results beside session; single shared global/project review object and rich evidence, multi-comment bundle and explicit approvals.
- **Idea -> product:** capture idea -> plan -> generate profile-based runnable UI prototype -> annotate -> accept reference/version/screenshots -> create task plan -> reorder/authorize -> simulated execution/check/review -> verified receipt and Git finalization. Depict the future **in-Paseo Preview pane + annotation -> submit -> agent edit -> live refresh** loop from [the embedded HTML mock idea](../plans/paseo-embedded-html-mock-workflow.md), using only fixtures for the current task. Start/run/finish states must connect; never silently auto-approve or mark Done after mere process exit.
- **Tools:** native access to Schedules, Usage, Hosts, Settings, Add Project, plus Skills / Optimization Workbench, quick one-click Review Skill/Tool with deterministic checks, optional independent local/cloud reviewers and proposal synthesis. Scheduling includes proposed condition-based cloud capacity with clear 'concept only' indication.
- **Artifacts and external cloud chats:** preview 'Export for AI chat' package, show drag/drop import of HTML/ZIP/Markdown/images to a selected host/path with conflict/overwrite choice and separate 'accept as reference' step. Optional external browser chat does not have to automate third-party websites.
- **Standalone use:** quick New Agent and New Terminal not tied to a project. Preserve native History/Search/Command Center/Schedules and existing footer actions.

This task is for interactive **visual/behavior simulation**, not implementing these underlying capabilities. **Do not turn this into a real embedded preview/dev-server/annotation dispatcher implementation.** The separately documented in-app workflow is future Paseo work, after the standalone redesign is reviewed.

### C. Current vs Proposed comparison

- Include a prominent but non-obtrusive **Current / Proposed** control, always labeled. Preserve the same selected project/workspace/session, route and viewport where meaningful. If a new view has no original equivalent, show a faithful original destination/empty state and say why—not a fabricated 'old' dashboard.
- Prefer an A/B toggle (not two fake applications in separate windows); optional synchronized side-by-side comparison may be added if usable on ultrawide.
- No screenshot flattened as an interactive mock. Real buttons, tab controls, navigation, dropdowns, selection/annotation, inspectors and state transitions should respond. Baseline screenshots are reference images for validation, not replacement UI backgrounds.
- Make visible whether the user is looking at existing behavior, a proposed UX, or a simulated execution outcome. Keep the sample project/task/review/run IDs consistent across modes and routes.

### D. Interactive user journeys

Implement the coherent representative storylines in [S1–S14](../design/paseo-next-prototype-contract.md). **Spend interaction depth on the critical path**:
1. Home attention -> SEICHO -> exact item review -> return.
2. New standalone agent and terminal without a project.
3. SEICHO Project -> Idea/Note -> Planning -> Prototype/annotation -> accepted design -> Plan/Task.
4. Plan -> reorder eligible Task -> authorize run -> observe root/child agents and editing -> select diff lines -> Ask/Steer -> Review -> final receipt.
5. Export cloud-chat package -> import revised artifact -> inspect it in project/Files.
6. Tools -> Review Skill multi-model configuration -> proposal; Schedules and usage inspection.
7. Device-size navigation: desktop -> Mac laptop -> phone while retaining selection.

All S1–S14 must be **reachable and intelligible**. For peripheral Settings/Hosts/plugin management paths, a faithful simplified interactive destination is enough: don't recreate the entire underlying app. For critical journeys above, actions must change coherent local fixture state (e.g., a review disappears from Needs you only after Approve, queue order actually changes when reordered, draft comments persist until sent, and import conflict changes state). Any button that cannot act must be explicitly disabled with an explanation; no fake successful network or Git actions.

### E. Visual verification, iteration and proof

1. Capture side-by-side baseline comparisons: supplied **real installed Paseo screenshots** vs prototype **Current** at matching viewport/DPR/state. List visual discrepancies and resolve significant hierarchy, spacing, color, type, sidebar width, tab/pane structure and composer position differences **before** polishing Proposed.
2. Then capture proposed UI screenshots at **3440x1440 (primary)**, **5120x1440**, **2560x900**, **1440x900**, **390x844**, and a representative MacBook laptop width. At least Home, Project Home, running agent/split diff, review, and one modal/inspector; sample states include idle, running, blocked, stale/unavailable and completed-with-evidence.
3. Use existing Playwright tooling if helpful; do not capture or focus the user's active Electron window unless explicitly permitted. For current live-Electron capture, prefer existing isolated harness/docs and report unavailable host access rather than manufacturing real screenshots.
4. Visually inspect captured screenshots, iterate until Current resembles references and Proposed looks like the same product. Required: readable hierarchy, balanced use of ultrawide space, accessible body contrast, readable 13px+ informative secondary text, keyboard focus, reduced motion, no giant dead center/empty canvas, no all-gray text wall, no too-small accordion chevrons, no overlapping layers or missing primary actions.
5. Test representative interactions automatically where low-cost: routes, A/B toggle with retained selection, stateful review/queue actions, native close confirmation simulation, annotation target, import conflict, stand-alone new agent/terminal, narrow viewport navigation. At minimum run a scripted smoke walk of primary journeys and manually inspect screenshots. Record outcomes, not invented passes.
6. Write a **feature-parity checklist** referencing actual Paseo source/UI and supplied screenshot evidence, with Current/Proposed reachability and any gaps. Flag proposal-only functionality separately from regressions.

## Deliverables

- A runnable, shareable interactive **HTML/React mock**, preferably under `docs/mockups/paseo-native-product-v1/` with a short README and a stable single entrypoint. If self-contained HTML is practical, export `docs/mockups/paseo-native-product-v1.html`; if not, supply exact install/run instructions and an optional bundled export. Keep files isolated from production code. Do not add backend dependencies, providers, migrations or real daemon calls.
- A screenshot/reference inventory: file, view, resolution, state, source (user screenshot vs code-derived), missing reference, and fidelity status. Use local ignored artifacts for private screenshots; the inventory itself may be checked in without sensitive details.
- A short, **grounded UX design note** explaining proposed IA (Home, Project, Workspace, Tools), why native tab/session semantics are preserved, improvements over current friction points, and clear remaining design questions. Mark accepted vs proposed.
- Screenshot comparisons and a `visual-review.md` summary with linked/safe evidence, observed mismatches and unresolved states. If screenshots cannot be committed safely, document locally generated output paths and describe them honestly.
- One navigable scenario index with how to reach S1–S14 (optional in-mock guided tour), parity matrix, and a concise user-facing handoff with start command, most important test journeys and genuinely unverified interactions. Do not make an unnecessarily large documentation pile.

## Definition of done — all must hold

- [ ] Actual current fork source was inspected; screenshots supplied by the user were inventoried and used; unsupported screenshot coverage is explicitly noted.
- [ ] Current view faithfully reproduces identifiable Paseo chrome/navigation/pane behavior at a reference viewport, with screenshot evidence and meaningful differences called out.
- [ ] Proposed view is visibly an evolution of the same product, **not** the rejected Shiori-centric mock; switching Current/Proposed works and preserves corresponding context.
- [ ] Settings, Hosts, Add Project, New Workspace, Usage, Schedules, History/Search, files/diff/browser/terminal/Git, agent import and existing pane actions are reachable in the mock. No existing feature is silently removed.
- [ ] S1–S14 can be explored; deep interactions above are stateful, navigation/back works, and both project-attached and unattached agent/terminal paths are clear.
- [ ] One shared review item behaves consistently from Home and Project; task and run states distinguish Planned, Ready (derived), Blocked, Needs review, Running and Done, including truthful simulated evidence.
- [ ] Diff selection -> context-aware Ask/Comment/Steer, combined feedback, and orchestrator child inspection are demonstrated without vague routing or fake success.
- [ ] Skills/Optimization, prototype profile and cloud-chat artifact exchange are represented with functional interaction models, not decorative cards.
- [ ] Desktop ultrawide, laptop and mobile screenshots are inspected for hierarchy/legibility/overlap/keyboard and touch paths; problem screenshots have fixes or explicit unresolved notes.
- [ ] Prototype runs from documented commands, passes basic smoke checks, includes no live private data/credentials, and no production application or server changes.
- [ ] Final handoff includes exact committed artifact paths, verification actually run, and open design questions. Do not claim the user has approved the redesign; the next phase is user visual feedback and iteration before implementation tasks.

## Work hygiene / stop rules

- Protect the user's active sessions. Avoid launching live Shiori jobs, writing real Git files or using real cloud quotas merely to make a mock feel interactive.
- Do not spend effort implementing VS Code IDE parity, a new agent SDK, a real filesystem transfer system, real remote web-chat automation, new Shiori tables, queue logic or conditional scheduler in this task.
- Fix design issues discovered by actual screenshots/interaction first; prioritize correct navigation and source-faithful behavior over elaborate animations or aesthetics.
- If a critical current screenshot is missing, clearly note the fidelity limit and request the targeted reference rather than confidently inventing the screen. If full direct component reuse proves expensive, use isolated HTML/React with visual parity and document that decision.
- Commit the prototype and compact docs to the Paseo repo on the authorized working branch; use logical commits, never force-push. Do not modify other repos as part of this mock. Summarize what changed and how to open it.

**Acceptance owner:** user will personally compare mock with their real Paseo screenshots and click through the day-to-day workflows; design is not approved until that review.
