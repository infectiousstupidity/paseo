# Next Paseo interactive prototype: design and acceptance contract

Status: **design acceptance contract**, 2026-10-15. The design-capture phase is complete; the isolated HTML prototype is authorized by [Task 01](../tasks/paseo-native-html-prototype-01.md). Do not implement production Paseo/Shiori application changes. Source of requirements: [Paseo product direction](../plans/paseo-product-direction-2026-10.md). Read that first. Earlier standalone Shiori-style workspace mock and old v5 references are **rejected as the global Paseo shell**; do not reuse their navigation or pretend that they document native Paseo features. Preserve worthwhile interaction ideas only after reconciliation against real code.

**Mandatory starting point:** This is **not** a standalone new UI design. Start from the real current Paseo code and user-supplied screenshots. First build screenshot-validated **Current Paseo**, then an incremental **Proposed Paseo** using the *same shell*, with a context-retaining A/B toggle. See [the execution task](../tasks/paseo-native-html-prototype-01.md) for screenshot inputs, exact paths, fidelity evidence, mock-only boundaries, acceptance and handoff. Current installed screenshots determine real rendered appearance; current fork source determines native controls and behavior; this contract determines proposed design goals. Missing images lower baseline confidence and must be called out, not imagined.\n\n## Outcome

Build **one working interactive prototype** of a coherent Paseo shell that makes the intended idea -> prototype -> plan -> execute -> verify -> finish workflow obvious. Use existing Paseo UI structure, not a bespoke second tab manager or isolated Shiori app. A user should understand current location and required next action without knowing which subsystem owns data.

The prototype may use local fixture data but it must label sample/fake data clearly, keep consistent entities/statuses across screens, and implement navigable interaction states. No dead decorative actions or impossible transitions.

## Navigation and spatial contract

- Left primary rail/sidebar: Home (global), Projects, access to existing Workspaces/History, Search/Command Center, Schedules, Usage, Hosts, Add Project, New Workspace, Plugins and Settings/Help. Exact grouping is design work; absence of any native capability is a regression. Retain active session/workspace entries under their real project, including standalones. Keep keyboard and touch entry points.
- Project selection leads to a **persistent Project Home**, not a project dropdown whose only output is a task spreadsheet. Suggested project sections: Overview / Plan / Runs / Knowledge. A single inspector/selection model operates on tasks, features and durable context. Never repeat a full project review queue as a second task list.
- Native workspace remains the existing persistent tab/split/pane system, with a prominent active agent/terminal/files/browser/diff context. Workspace changes must not replace project navigation state; closing a view must display truthful running-agent/terminal semantics.
- Home across all projects is a **projection**, not a separate task manager. The same review item opened from Home and SEICHO must reach the same item and actions.
- Tools are easy to reach but not a permanent wall of navigation or widgets. Skill registry/Optimization Workbench can be explored from Tools; Settings, Hosts and Schedules remain native destinations.
- Real estate: prefer one dominant work surface plus optional resizeable inspector or supporting pane. Avoid centered 650px lists floating inside a 3440px/5120px empty canvas, redundant titlebars, all-gray low-contrast tables, microtypography and nested cards.

## Storyboards (must be navigable, not just screenshot compositions)

| ID | Initial state -> action -> result | Verification |
| --- | --- | --- |
| S1 Global morning | Reopen after overnight work -> Home shows focus, actionable reviews, running, queue, recent verified result -> open exact review -> return | Scope and status truthful; no duplicate global/project review |
| S2 Quick unrelated work | New Agent -> choose provider/model/thinking without project -> chat; New Terminal -> choose host/default directory -> running process | No forced repository/task context; no dummy project |
| S3 Enter project | Select SEICHO from project list/sidebar -> Project Home -> inspect current execution, blockers, map, tasks, notes/questions/decisions, Git freshness -> open real linked run | Project is persistent identity; tasks are not the only content; source links correct |
| S4 Capture and plan | Quick note/question/idea -> project knowledge; open planning session with bounded context -> propose decision/feature/tasks/dependencies -> approve individual protected updates | Capture is cheap; idea is not accidentally executable; acceptance separate from conversation |
| S5 HTML design | Start UI feature -> create prototype from profile -> preview in native browser -> annotate element -> Ask/Steer -> accept precise version + screenshots | Real artifact linkage, reusable template/profile, current source/revision and destination |
| S6 Manage execution | Inspect work graph/readiness -> drag/reorder eligible task -> choose run/model/unattended policy -> start -> monitor root and children | No implied concurrent mutation; queue behavior and admission blockers visible |
| S6b Queue behind normal agent | Ordinary Paseo agent is implementing with a live subagent -> capture next prompt -> approve Shiori Task draft -> **Run after this agent** -> view it waiting in existing queue -> parent turns idle while child runs -> child finishes -> eligible Task begins | One exact selected agent, child-inclusive evidence, queue head not skipped, no fabricated completion; no second scheduler or fake automatic action. Label mock-only states until backend guard is verified |
| S7 Observe/steer | Agent actively editing -> Focus/Activity/Full switch -> select observed changed lines in native diff -> ask side-question or targeted steering -> view receipt | Filename/range/revision preserved, ask doesn't secretly interrupt, no lost position |
| S8 Review/complete | Run done -> compact evidence receipt -> real diff and visual before/after -> annotated feedback or approve -> policy-governed reconcile/commit/push | Agent exit isn't verified Done; review and Git decisions explicit |
| S9 External cloud exchange | Export selected prototype/source/screenshots/context to a web chat -> user returns .html/.zip/.md -> drop on project folder -> inspect import conflict -> open real artifact in explorer/browser/Git | Real writable destination; export preview; import is not approval |
| S10 Tools and reviews | Tools -> Skills -> Review skill -> deterministic checks + optional local/cloud independent reviews -> synthesis -> proposed diff/eval -> approve/reject | Multiple models optional; real evidence and no review ritual for trivial items |
| S11 Automation | Schedule weekly competitor delta research -> proposed changes in project -> optional condition: cloud window available before authorized run | One queue/scheduler ownership, exact capacity freshness, no silent implementation of research |
| S12 Mobile/Mac | Open same project/review/agent on narrower display -> inspect details, approve and reply -> return to desktop | Same IDs/run, no auto-duplicated session, no horizontal scroll for required controls |
| S13 App parity | From every new surface reach Settings, Hosts, Add Project, New Workspace, session import/history, Schedules, provider Usage, terminal, files, browser, Git and plugin actions | Old Paseo actions remain usable; test X with agent and terminal state distinctions |
| S14 Diagnostics | Inspect global active sessions/concurrency and per-agent model/reasoning/TPS/cache/prefill when trustworthy; open self-review findings and skill/tool burden | Unknown metrics explicit; no invented figures |

Prototype can have lightweight fixtures for Shiori data and host telemetry, but fixtures must consistently model the SAME SEICHO Project, Task, execution and Review item through S1, S3, S6 and S8. Include examples of blocked, stale, idle and unavailable states; don't show everything running and green.

## Core interaction details to prototype

1. A global attention row opens the exact review inspector. Closing inspector returns to the originating context; it does not resolve/approve. The project contextual view uses the same review object.
2. Project Plan tasks can be filtered/reordered and opened in a side inspector. Show explicit read-only dependency and readiness state. Demonstrate drag/drop of one Task with keyboard alternative, and blocked-reorder explanation.
3. Agent display has Focus/Activity/Full modes; switching never loses transcript scroll/context. Live observed file modification opens split diff; selected range action opens anchored composer with **Ask / Comment / Steer** and exact destination. Ask is isolated by default; Steer may be queued or interrupt-required.
4. Orchestrator tree is navigable, shows subagent role/model/reasoning/status/elapsed/metric freshness, and exposes valid targeted actions including Stop where actually supported. No fake Stop=Pause semantics. For scenario S6b, the queue waiting condition must inspect the selected native agent **and reported children**; an idle parent or dismissed tab alone cannot mark the next Shiori Task eligible. Show unverified/unreachable evidence explicitly and let the user remove a hold deliberately.
5. Review shows summary + changes + checks + visual evidence + findings + decision controls. Comments can be drafted on several ranges then previewed and submitted as ONE feedback bundle. Approval is not feedback submission.
6. Project capture supports at least Note, Question, Idea and Task proposal. Changing accepted decisions or executable specs is an explicit proposal/approval, not an auto-save from conversation.
7. Import/export dialog previews paths and included artifacts, has safe conflict state, and shows source/version. Cloud provider web tab is optional, standalone browser remains viable.
8. Settings/Hosts/Add Project must be reachable with real labels and enough functional prototype behavior to prove the route and back navigation. Demonstrate native pane/tab close policy choices/confirmation where appropriate.

## Prototype technical and visual constraints

- Prefer a standalone runnable interactive HTML prototype as deliverable; a small Vite/React project is acceptable when needed for native-like interactions, along with a portable HTML export if feasible. Choose dependencies intentionally; for example Mantine + Tailwind only when styles coexist cleanly; React Joyride only if guided tour is part of the scenario; Agentation where actually interoperable. **This document does not mandate libraries that create needless complexity.**
- Use existing Paseo and SEICHO design tokens as primary input: near-black/off-white, accessible contrast AA >= 4.5:1 for body text, clear accent used sparingly, Lucide icons, reduced motion option, visible keyboard focus, purposeful spacing, readable 13px+ secondary instruction text. No green as default success-decoration accent.
- Design against primary 3440x1440; secondary 5120x1440, 1440x900, 2560x900, 390x844 and MacBook viewport. Screenshots at representative states, not just one desktop hero.
- Preserve deterministic fixture identities and navigation. Exact responsive behavior is required: secondary panes collapse into tabs/sheets on narrow screens, not 3 tiny columns.
- Avoid non-operational visual decoration, AI-dashboard-looking grids, giant blank space, tooltip-only critical actions, tiny chevrons, and multiple similar review or workspaces pages.
- Never use rejected old v5 or disconnected Shiori mock as acceptance target. Read actual Paseo fork before deciding where native buttons, pane targets, session controls and settings paths belong.

## Prototype deliverables

1. Information architecture and navigation map (global vs Project vs workspace vs inspector vs tool).
2. One interactive prototype implementing S1–S14 with meaningful clickable paths and at least blocked/review/idle/running/error states.
3. Responsive screenshots at specified sizes, and a short "existing Paseo parity" interaction checklist for Settings/Hosts/Add Project/new agent/new terminal/terminal and agent close/Git/files/browsers/plugins/schedules/history/usage.
4. Issue log for flows users cannot understand without guidance, and unresolved API/transport assumptions. Resolve them before handing developers implementation Tasks.
5. Then, and only then, break implementation into foundation and small independently verifiable vertical slices, with screenshot and functional acceptance per slice.

## Open questions for prototype evaluation

- Global sidebar hierarchy and top tabs: how to distinguish a Project Home view, a real execution workspace, and an agent tab while preserving native Paseo tab layout? Is Project Home a native app destination, a special workspace panel, or a pinned resource?
- Whether to keep current archive-on-close behavior or provide a separate "Close view" control; never silently change lifecycle.
- Which events can actually provide live trustworthy file diffs, subagent metrics, cache/prefill and cloud capacity across providers?
- Can the current server/plugin contract observe a **specific finished agent turn plus all associated managed/provider-native child work**, with durable identity and race-safe admission across daemon restarts? Otherwise, S6b is only a visually labeled proposed path, not an automatic launch.
- How to present useful project Features as navigation without inventing unapproved canonical Shiori feature objects?
- When is a contextual question a side agent versus a main-agent queued message, and how is a revision re-anchored?
- Which implementation of project drag/reordering, safe host file transfer and browser visual capture fits existing Paseo/Shiori plugin APIs?
- What navigation remains essential on mobile, and what desktop layouts should be stored per device?

**Success condition:** from first launch, user can move from "what needs me?" to "SEICHO idea" to "prototype" to "running implementation" to "verified review" and back in an intuitively continuous experience; existing Paseo development and configuration functions are still obviously usable.
