# Paseo + Shiori workspace — living exploration

**Status:** Exploration; no implementation plan or feature-completion claim.  
**Updated:** 2026-10-13  
**Purpose:** Record the intended daily experience, design direction, existing building blocks, and unanswered questions. Update this document as decisions change. Create separate implementation plans and Tasks only after the workflows and contracts are settled.

## Outcome we want

An integrated coding and project workspace where it is obvious **where I am, what I am doing, and what needs me next**. Navigate projects and their features visually; work with agents; review and approve output; keep decisions and documents up to date without searching old sessions or repeatedly explaining context.

The main use is a **3440 × 1440** desktop, sometimes **5120 × 1440**. The same work must remain usable on a **MacBook Air M1** and **Samsung S23**.

~~~mermaid
flowchart LR
    P["WHERE · Project and feature"] --> W["WORK · Chat, plan, code, review"]
    W --> N["NEXT · Decisions and attention"]
    N --> P
~~~

- **Where:** project switcher, project outline, visual map of areas/components, related Ideas, Tasks and Decisions.
- **Work:** one clearly dominant active surface. Supporting panes appear because they are relevant or explicitly pinned.
- **Next:** unresolved approvals, failed checks, blocked Tasks, important results. No duplicate project dashboard.

## Daily workflows

| Situation | Expected experience |
| --- | --- |
| Quick unrelated question | Open a clean chat with no forced project structure or Shiori panels. |
| Explore SEICHO Inbox UI | Select the project and area; see a visual breakdown of components and what is planned, finished or only an idea. |
| Start planning for Chat output > Buttons | Click the feature/area, start a planning session, and receive relevant context automatically. |
| Record a decision | Discuss the choice, review the proposed change, accept it, and let Shiori update the correct project record and linked documents. |
| Implement a Task | Open a focused agent session with the specific Task, acceptance criteria, repository context, progress and verification evidence. |
| Review agent output | Highlight sections, add several comments, then send one clearly addressed feedback bundle or approve the exact pending request. |
| Ask a quick side question | Open a small, separate agent conversation beside the main work. The main agent keeps running and its context stays unchanged. |
| Return after unattended work | See what completed, what was verified, what is blocked, and what needs approval without reading the entire transcript. |

## Workspace layout and visual rules

**Direction agreed:** use Paseo's existing native tab/split-pane tree, movement, resize and persistence. Extend it with optional presentation modes and reusable layouts; do not build another nested window manager.

~~~mermaid
flowchart TB
    T["Top · Project / current scope / layout"]
    subgraph AREA["Native Paseo split workspace"]
        direction LR
        L["Left · Project outline"]
        C["Center · Main work"]
        R["Optional work panes · Map / Review / Quick ask / Diff"]
        S["Shiori attention · Focus / Needs you"]
    end
    T --> AREA
~~~

**Pane modes:** normal tabs; quiet header; docked/locked with tab bar hidden. Lock prevents accidental movement, not content updates. Edit/unlock restores clear move, split, resize and close controls. All modes use the same underlying pane identities and state.

**Layouts:** start with Quick chat, Planning, Implementation and Review. Save custom presets; remember a workspace's manual arrangement. Choose a default and optionally select a preset when a **new** workspace/session is created from an explicit purpose or Shiori Task type. Never rearrange an existing hand-customized workspace because an agent's output changed.

**Project navigation:** explore moving the active project's outline to the left and adding a project switcher near the top. Keep Shiori's right-hand view for attention and current execution, rather than repeating the entire project tree. Exact left/right ownership remains open.

**Visual acceptance rules:**
- A single obvious task or decision owns the primary attention area. Do not show every capability at once.
- Distinguish **action**, **information**, **status** and **history** through position, size, spacing and recognizable controls—not tiny labels alone.
- Readable typography, contrast, focus states, restrained accent use, consistent alignment; avoid a wall of equally weighted text, excessive cards and dead space.
- Keep the chat timeline scannable: collapse low-value tool activity, show meaningful milestones, keep Full view available.
- Support mouse/keyboard on desktop and touch/long-press on mobile. Collapse secondary panes into navigable views rather than scaling ultrawide geometry down to a phone.
- Follow [Paseo design](../design.md), [Shiori design](https://github.com/infectiousstupidity-labs/shiori/blob/main/DESIGN.md) and SEICHO's approved design tokens. The earlier **V5 mock is a rejected visual direction**, not an implementation reference. Validate the next design against actual user journeys before slicing engineering Tasks.

## Chat interactions and review

~~~mermaid
flowchart TB
    A["Agent output or selected text"]
    A --> B{"What do I want to do?"}
    B --> C["Approve / Reject · Native request"]
    B --> D["Comment / Suggest edit · Draft"]
    B --> E["Ask · Independent side agent"]
    D --> F["Review bundled feedback and destination"]
    F --> G["Current agent · One message"]
    F --> H["Fresh agent · Separate session"]
    F --> I["Shiori · Idea / Decision / Task proposal"]
~~~

- **Native decisions:** structured Pi/Paseo confirmation and question requests render compact inline controls. Approval responds to the waiting request. A suggested reply to ordinary text is **not** a permission approval. Plain-text suggestions should be narrowly scoped and optional, without another LLM call.
- **Annotations:** attach to exact message/document ID, text span and content revision. Drafting is local/mechanical. Multiple comments can be previewed as one bundle. Default destination is the **current agent**, explicitly shown; a new session or Shiori record requires deliberate selection. Never silently submit comments while highlighting.
- **Approval versus feedback:** two different operations. Approving cannot silently discard unsent notes; sending notes does not implicitly approve a protected change.
- **Quick questions:** separate short-lived or reusable child conversation inside the current pane/workspace. It can receive selected text, stable references and optional read-only repository context. It must not silently edit files, steer the parent or append its history. Allow follow-ups and an explicit “send to main agent” action.
- **Focus and result receipts:** Focus hides repetitive chatter without reducing the underlying model context. End-of-work receipts separate agent claims from observed test/Git/visual proof, show unknowns honestly and offer targeted actions.

**Related existing work:** [Agentation annotation dispatch](./agentation-per-annotation-agents.md) and [Pi subagent controls](./pi-subagent-controls.md). Agentation's per-annotation investigation/implementation dispatch is a separate, explicitly authorized workflow—not automatic spawning from every chat comment. Do not represent Stop as Pause/Resume.

## Project map and durable knowledge

Visual exploration should be possible without opening long Markdown files:

~~~mermaid
flowchart LR
    P["SEICHO"] --> I["Inbox UI"]
    I --> O["Chat output"]
    I --> V["Source viewer"]
    I --> L["Inbox list"]
    O --> B["Buttons"]
    B --> X["Ideas · Tasks · Decisions · Documents"]
    X --> Y["Start planning / Add idea / Open Task"]
~~~

A selected node shows, in plain language, **what exists, what is decided, what is planned, what is done, and what remains uncertain**, with source links on demand. A click can start a new discussion already scoped to that node, or capture an Idea to refine before turning it into an executable Task.

**Do not invent a parallel project database.** Shiori remains authoritative for its one-Plan-per-Project model, Tasks, Ideas, Questions, Decisions, Notes, Reviews and links to Markdown. The map is initially a **navigation/projection layer** over those records and identified document sections. Whether a durable area/component identity is needed must be established before changing Shiori's model. Do not claim an “Idea” is planned work or a discussion is an accepted Decision.

Accepted decisions should have short understandable summaries, links to the originating discussion/evidence, and explicit superseded history. Technical detail stays accessible without becoming the default reading experience.

## Project-aware sessions and deterministic updates

When starting from a selected project/area/Task, the system—not the model guessing filenames—resolves stable IDs, authoritative decisions, linked documents, relevant sections and scope. Supply a **small, bounded context packet**, not the entire project's history.

~~~mermaid
flowchart TB
    A["Select project / area / Task + session purpose"]
    A --> B["Shiori resolves IDs, documents, decisions and constraints"]
    B --> C["Bounded context packet to agent"]
    C --> D["Agent proposes a structured change"]
    D --> E["Shiori validates scope, versions and permissions"]
    E --> F{"Protected project truth?"}
    F -->|Yes| G["Human reviews and approves"]
    F -->|No, authorized| H["Apply allowed update"]
    G --> H
    H --> I["Update canonical record / exact document section"]
    I --> J["Refresh project map and session references"]
~~~

**Proposed tool families (concepts, not committed API names):**
- Get context for a specific project/area/Task.
- Capture an Idea or propose a Decision.
- Propose a change to a Task's acceptance criteria or document section.
- Review and apply an approved change to the authoritative record and correct Markdown file.

Prefer extending Shiori's existing domain commands and document reference/version system. The agent supplies **meaning and proposed content**; deterministic code handles destination, section selection, formatting rules, permissions, optimistic concurrency and audit history. Changes with an ambiguous target must ask or produce a reviewable proposal. No arbitrary file rewrite or silent modification of accepted project truth.

**Intended savings:** fewer repository searches, less repeated context, fewer model-mediated bookkeeping steps. Exact token savings need measurement. UI hiding alone does not shrink the main agent's context.

## Native inference information and cloud quota

Replace scattered composer-plugin pills with one quiet **native chat performance strip**, expandable for technical details.

| Compact information | Expanded, when available |
| --- | --- |
| Model, agent status, context usage | Input/output tokens, context window, cost |
| Decode tokens/second | TTFT, prefill rate and other latency measurements |
| Cache reuse | Provider-reported cached tokens or trustworthy hit-rate calculations |
| Cloud capacity | Account/pool windows, resets, status and freshness |

- **No invented metrics.** Stream-based TPS is measurable; TTFT is not identical to pure prefill time; real prefill/cache values require trustworthy provider/backend telemetry. Say “unavailable” when not reported. Keep update frequency low and avoid high-frequency React rerenders.
- **Codex-LB:** move its 5-hour/weekly pooled quota from the separate workspace-header plugin button into Paseo's native Usage system where the data model fits. Paseo already exposes usage-source registrations; confirm the pooled-account semantics first. Preserve daemon-only credentials, the documented GET /v1/usage behavior, and unknown/stale states. Do not duplicate Codex-LB quota accounting or redemption.
- Shiori can still read the same bounded quota state for its routing decisions; it must not maintain a competing quota ledger.

## Product boundaries and upstream maintenance

~~~mermaid
flowchart TB
    UI["Paseo fork · Native navigation / panes / chat / telemetry"]
    AD["Shiori integration · Native-looking project UI and commands"]
    CORE["Shiori domain · Project state / context / harness / audit"]
    DB[("Shiori PostgreSQL")]
    UI <--> AD
    AD --> CORE
    CORE --> DB
~~~

**Preferred direction:** a first-class Paseo + Shiori experience; keep Shiori domain behavior and database ownership modular. Use Paseo for workspace navigation, session and pane lifecycles; Shiori for project truth and task orchestration. Bundling Shiori as built-in is worth investigating, but **physical merger into Paseo core is not decided**. Current built-in-plugin packaging/dependency and startup constraints need a real feasibility check.

Keep upstream merges practical by concentrating fork-specific changes behind focused boundaries; review upstream improvements in isolation and validate affected behavior. “Agents can merge code” is not evidence of runtime compatibility.

## Existing foundations to reuse

| Already in code / documented | Still to design or prove |
| --- | --- |
| Native split tree, tab movement, resize and per-workspace layout persistence | Hidden/locked pane chrome, named reusable presets, safe selection rules |
| Pi structured interaction requests and Paseo question UI | A coherent inline interaction/annotation experience |
| Shiori project Task/Decision/Proposal state and PostgreSQL | Stable feature-map relationships and precise doc-section edits |
| Existing diff review and chat session support | Cross-document annotations, side-question context isolation and submission routing |
| Paseo native Usage reports and registered usage sources | Codex-LB pooled quota mapping; per-turn telemetry completeness |
| Pi subagent targeted-control work | Remaining installed-Pi/live visual acceptance; interrupt/resume safety |
| Agentation task series | Approved end-to-end integration proof and exact authorization boundary |

Code availability does **not** imply the visual or real-host workflows are validated.

## Questions to resolve before writing implementation Tasks

1. **Information design:** For Quick chat, Planning, Implementation and Review, what is the one primary surface and what stays hidden until requested? Test with real tasks, not decorative demo content.
2. **Native layout:** How do locked panes coexist with movable tabs, Explorer/Shiori sidebars, focus and restoration, multi-window state and phone layouts? Define “unlock/edit layout” behavior.
3. **Project map:** What stable identity connects a visual component to Ideas, Tasks, Decisions and exact document sections without introducing a second canonical hierarchy?
4. **Writing changes:** Which Shiori commands already cover Idea/Decision/Task updates? What minimal typed document-patch API remains, and how are stale versions, conflicts and review handled?
5. **Side-question and review:** What is the exact session lifecycle, context boundary, draft storage owner, and approval/message routing for each action?
6. **Integration shape:** What does native host UI need from Shiori that the current plugin SDK cannot expose? Test that before committing to bundling or core imports.
7. **Performance:** Which TPS, prefill, cache and quota fields have real authoritative sources on Pi/local inference/cloud, and at what refresh cost?
8. **Cross-device presets:** Should each device class have an independent layout selection while sharing project/task context?

## How to continue this document

- Edit the relevant section when a decision changes. Do **not** append chat transcripts or duplicate existing task specs.
- Mark each new claim as **agreed direction**, **existing/proven**, or **open/proposed**. Include a link to code, docs or an observed test when claiming something works.
- Keep diagrams and user journeys current. Prefer short sentences and exact labels over implementation jargon.
- Keep this document exploratory. Once a workflow and technical boundary are validated, link to a separate focused plan and sliced Tasks; do not convert this document into a giant implementation checklist.
