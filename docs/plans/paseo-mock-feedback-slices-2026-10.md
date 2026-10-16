# Paseo mock — feedback slices (2026-10-15)

**Status:** in progress — S0–S10 are implemented in the mock (harness 401/401 at the S10 checkpoint). S11a, S11b, S12, S13 remain. **Target:** `docs/mockups/paseo-mock.html` (6,441 lines, untracked). **Type:** mock/prototype only — no production Paseo, Shiori, SEICHO or Pivolution change, no real execution, no real Git.

Governing contract: [Paseo product direction](paseo-product-direction-2026-10.md) (accepted directions: contextual anchored feedback, Ask/Comment/Steer semantics, native pane/tab parity, "Proposed until tested: exact labels/tabs"). Prototype scenario contract: [paseo-next-prototype-contract.md](../design/paseo-next-prototype-contract.md).

## Ground rules for every slice

1. One file, string-template rendering. `render()` rebuilds `#app.innerHTML` wholesale and then restores focus/scroll/text-input selection (`focusIdentity` L5348, `findFocus` L5357, `finishRender` L5374). Any new interaction must survive a full re-render, or it will feel broken.
2. State lives in `st` (L4296+). Persisted keys: `paseo-concept-04-prefs`, `paseo-snippet-library`. New state must be validated on read like the existing code does — a stale `localStorage` shape must not crash the mock.
3. Everything stays a fixture. Never imply a real run, real write, real model call or real Git action. Label sample data honestly (but in plain words — see slice S13).
4. Verify each slice with the smoke harness (S0) plus screenshots at **3440x1440**, **2560x900**, **1440x900**, **390x844**. Playwright chromium is already installed in this repo.
5. Do not add a build step, framework or dependency to the mock.

## What the mock actually does today (audit of the 14 points)

| #   | Feedback                              | Where it lives now                                                                                               | Actual behaviour today                                                                                                                                                                                                                                                  |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Character-level targeting             | `diffPanel()` L4906; `case "line"` L5815; `annotationInspector()` L5152                                          | Each diff line is one `<button data-action="line:N">`. Target is `{file, line, revision}` only. No range, no column, no sub-line selection.                                                                                                                             |
| 2   | Return to review after save           | `case "saveAnnotation"` L5823; `case "bundle"` L5846; `inspectPane()` L5207                                      | Saving a comment pushes to `st.comments`, shows a toast, and **stays on the Feedback tab**. The Review tab shows no count, so you have to find the bundle yourself.                                                                                                     |
| 3   | "Ask side question"                   | `annotationInspector()` L5167; `case "saveAnnotation"` L5839                                                     | Toast only: "Side inquiry prepared." **No thread is rendered anywhere.** It is a dead end.                                                                                                                                                                              |
| 4   | "Steer"                               | same L5167 / L5840                                                                                               | Toast only: "Steering message queued. Delivery not confirmed." No queue, no state, no link to what is visible in the file. Activity view (`sessionMain()` L4930) is a static list.                                                                                      |
| 5   | Thinking → output                     | `sessionMain()` "full" branch L4940                                                                              | One static `Pi · Thinking` block in Full view. No link from reasoning to the tool calls or the code it produced.                                                                                                                                                        |
| 6   | Jargon                                | global                                                                                                           | "Provenance" (L5124), "Verification receipt", "deterministic checks", "observed", "fixture-r2", "delivery", "gate", "orchestrator/specialist", "vertical slices", "reconcile", "artifact", "canonical", "projection".                                                   |
| 7   | Turn history in chat                  | `sessionMain()` L4930–4940; `renderPaneBody()` L5046                                                             | **Nothing.** The mock has no turn rail at all. Real Paseo has `packages/app/src/agent-stream/chat-outline/rail.tsx` (the thin, hard-to-use rail in the screenshot).                                                                                                     |
| 8   | Stable content width                  | CSS L652–662, L1394, L1507, media queries L2031/2049/2057/2076/2116/2145/2342/2357/2394/2402/2426/2436/2452/2465 | `.screen` = `min(100% - 112px, 1620px)`, `.screen.project` = 1660, `.screen.compact` = 1400, `.session-content` = 880, `.composer` = 880, plus 2500px/4200px overrides. 30 different `max-width` values. Confirmed: every page is a different measure.                  |
| 9   | Slice detail                          | `diagramWorkstreams()` L4767                                                                                     | The `01 / FOUNDATION … 05 / RELEASE` columns are plain `<g><rect><text>` with **no `data-action`**. Not clickable. No slice entity exists in state.                                                                                                                     |
| 10  | Chained runs                          | `case "authorizeRun"` L5742, `finishRun` L5756                                                                   | One run at a time (`st.currentRunningTask`, `st.runName`). No run list, no sequence, no scheduling of a chain.                                                                                                                                                          |
| 11  | Diagram too big + duplicated          | `diagramAgent()` L4787 in `runsContent()` L4820; `agentsInspector()` L5140                                       | Runs page renders a 1050x295 tree; the inspector renders a second 372x255 tree of the same thing. Both visible at once.                                                                                                                                                 |
| 12  | One workspace per project?            | `projectData[].workspace` (single string), `layoutFor(key)` L4474, sidebar `projectRow()` L4659                  | The model **allows** many (`st.layouts` is keyed by any string, `"standalone"` proves it), but the mock only ever creates one per project and there is **no create-workspace action anywhere**.                                                                         |
| 13  | Closing panes/tabs                    | `renderNativeLeaf()` L5086–5090; `case "paneClose"` L5572; CSS `.native-tab-close` L3206                         | Tab close exists but is a 12px icon at `opacity:0.6` — effectively invisible. The pane menu (L5090) offers New tab / Split right / Split down and **no Close pane, no Maximize**. Closing the last tab silently removes the pane.                                       |
| 14  | Duplicate Diff/Files/Terminal/Browser | `supportPanel()` L4909–4920; `renderPaneBody()` L5068; `case "paneShow"` L5540                                   | Confirmed. The default layout (L4474) already has tabs named **Changes / Files / Terminal / Browser**, and `supportPanel()` renders a second button row inside the pane labelled **Diff / Files / Terminal / Browser**. Two controls, inconsistent names, same targets. |

## Decisions (settled 2026-10-03 — build to these)

**D1 — Side chat shape (S6).** **Decided: right-side drawer over the inspector**, main session stays visible. Build it to see how it looks. Inline chip left in the transcript at the point of the question; every answer offers **Copy / Add to main chat / Save to project knowledge / Delete**; labelled temporary, can be kept open.

**D2 — Steer honesty model (S7).** **Decided: yes** to the visible queue **Draft → Queued → Delivered at next safe point → Applied / Interrupt required / Unavailable** with **Cancel before delivery**. Steer never rewrites an in-flight edit. **Request changes on finished work is a separate action** from steer a running agent.

**D3 — Thinking trace (S9).** **Decided: one fully worked example** (reasoning → decision → action → result → the exact lines). Everywhere else: "Reasoning not available for this step". No invented reasoning.

**D4 — Scheduling (S11a + S11b).** **Decided: yes, and wider than chaining.** A **Sequence** is an ordered list of _existing_ things — tasks from the task board, prompts, or whole runs — with a per-step approval gate. A **Schedule** fires a sequence, several runs together, or a solo task, on a timer/cadence (like Paseo's native cadence scheduling, improved), by hand, or when another run finishes. No new execution engine: mock-level records referencing existing runs and tasks.

**D5 — Workspaces (S12).** **Decided: yes.** `workspaces[]` per project, layout keyed by workspace id, **New workspace** in the project header, the sidebar project expander, and the workspace location bar.

**D6 — Naming (S2 and S13).** **Decided:** **Changes** (not Diff), **Files**, **Terminal**, **Browser**, **Main agent** (not orchestrator), **Helper agent** (not specialist/child), **Approval step** (not gate), **Checks that ran** (not verification receipt), **Where this came from** (not provenance), **feedback list** (not bundle).

## Slices

Sizes: S ≈ under an hour of mock editing, M ≈ a focused session, L ≈ a focused session with new state + new surface.

### Wave 1 — shell fixes, no new concepts (do first, lowest risk)

**S0 — Verification harness + shared tokens (S).** Prerequisite for everything.

- Add `docs/mockups/paseo-mock-smoke.mjs`: run the mock's `<script>` in a `vm` sandbox and assert on rendered HTML, following the proven pattern in `docs/mockups/paseo-native-product-v1/node-smoke.cjs`. Export `{state, action, render}` the same way.
- Add `docs/mockups/paseo-mock-shots.mjs`: Playwright screenshots at 3440x1440, 2560x900, 1440x900, 390x844 for Home, Project/Plan, Project/Runs, Workspace, Review inspector.
- Add the plain-language word list (S13) as a grep check in the smoke script so later slices cannot reintroduce jargon.
- Acceptance: `node docs/mockups/paseo-mock-smoke.mjs` passes against the **current** file (baseline, before any behaviour change).

**S1 — One content width everywhere (#8, S).**

- Replace `.screen` / `.screen.project` / `.screen.compact` (L652–662) with a single container using two tokens in `:root`: `--content` (page measure) and `--measure` (prose/reading measure). Delete the per-page `max-width` overrides and the 2500px/4200px width bumps; express them as one `--content` change per breakpoint.
- `.session-content` (L1394) and `.composer` (L1507) use `--measure`, so the chat column and its composer always match.
- Acceptance: at 3440x1440 the left edge of the content column is identical on Home, Projects, Project/Overview, Project/Plan, Project/Runs, Knowledge, History, Settings; at 390x844 nothing clips and gutters stay ≥16px.

**S2 — Pane control surface: one way to switch, one way to close (#13 + #14, M).**

- Delete the Diff/Files/Terminal/Browser button row from `supportPanel()` (L4909–4920). The tab strip is the only view switcher. `pane-top` keeps the pane title + the pane menu.
- Rename the `diff` tab label from "Changes" or "Diff" to one word everywhere (`newTab()` L4447).
- Make tab close always visible on the selected tab and on hover/focus for others (CSS L3206), with a real hit target (≥24px).
- Add to the pane menu (L5090): **Close pane**, **Maximize pane** (and restore), **Move pane to new tab group**. Closing a pane that holds an agent or terminal keeps the existing confirmation (`case "paneClose"` L5572, `modalConfirm` L6018) — parity rule from the product direction: X is not a harmless dismiss for agents/terminals.
- Add `Ctrl/Cmd+W` (close tab in focused pane) to the keydown handler at L6130.
- Remove the render-time mutation of `st.support` inside `renderPaneBody()` (L5068) — derive it from the tab instead.
- Acceptance: every pane can be closed by click and by keyboard; closing the last tab in a split collapses the split cleanly; no duplicated view switcher anywhere; agent/terminal close still confirms.

**S3 — Execution diagram: smaller, shown once (#11, S).**

- Replace the 1050x295 tree in `runsContent()` (L4820) with a compact one-line hierarchy (main agent + up to N helpers as chips/rows with status, model, elapsed) and a single **Open execution tree** action.
- Keep the full tree in exactly one place: `agentsInspector()` (L5140). When the inspector is open, the Runs page shows the compact form only.
- Acceptance: at 1440x900 the Runs page shows the tree once; the diagram never occupies more than ~120px of vertical space outside the inspector.

### Wave 2 — the feedback model (the core of the complaint)

**S4 — Select any part of a diff line (#1, M).**

- Replace whole-line `<button>`s in `diffPanel()` (L4906) with selectable `<code>` text plus a hover/click gutter affordance. On mouse-up inside the diff, show a small popover: **Comment on this / Ask about this / Steer with this**.
- New target model: `{file, revision, startLine, endLine, startCol, endCol, text}`. Render the selected range with a highlight overlay so it survives re-render (`finishRender` L5374 must restore range highlights, not just input selection).
- Keep whole-line selection as the coarse path (click the gutter). Multi-line ranges supported.
- `annotationInspector()` header shows the exact range, e.g. `src/recipe-import.ts · line 6, characters 24–44 · sample version r2`, with the selected text quoted.
- Acceptance: select half a changed line → the popover appears → the saved comment carries the character range and quotes exactly the selected text; selecting across two lines works; the highlight is still there after any re-render.

**S5 — Save returns you to the review bundle (#2, S).**

- `case "saveAnnotation"` (L5823) with mode `comment`: push the comment, then set `st.inspector = st.reviewInspector` (Review) and keep the diff scroll position + selection.
- Add a live count badge to the Review tab in `inspectPane()` (L5217) so the bundle is always visible: `Review · 3`.
- Bundle drafts must survive navigation between routes (already in `st.comments`; make sure `navigate()` L5449 does not clear them, and add a "N unsent comments" indicator when leaving the review).
- Acceptance: click a diff range → write → **Save to feedback list** → the inspector is on Review with the item listed and the count updated, without any manual navigation; the diff is still scrolled to the same place with the range still highlighted.

**S6 — Side chat, visible (#3, L).** Depends on S4, decision D1.

- New state `st.sideChats: [{id, title, target, model, messages[], pinned, temporary}]`.
- New surface: right-side drawer over the inspector, main session stays visible. Header: "Side chat · temporary · not part of the main conversation" + model picker (a different model is allowed).
- Entry points: **Ask** from a selection (S4), a **Side chat** button in the composer, and a top-bar **New side chat** (optionally project-attached, for the "quick question / add this idea to the repo docs" case).
- Leave an inline chip in the transcript at the point of the question: `Side chat: <question>` → click reopens the drawer.
- Answer actions: **Copy**, **Add to main chat**, **Save to project knowledge**, **Delete chat**. A small counter in the pane header lists open side chats.
- Fixture answers only, clearly labelled sample.
- Acceptance: from a diff selection, Ask opens a visible thread beside the session; the main transcript is unchanged; "Add to main chat" appends a user message to the main session; closing and reopening restores the thread; the drawer works at 390x844 (full-width sheet).

**S7 — Steer with honest delivery states (#4, M).** Depends on S4, decision D2.

- New state `st.steerQueue: [{id, target, text, state, createdAt}]` with states `draft / queued / delivered / applied / interrupt_required / unavailable / cancelled`.
- Render the queue in `agentsInspector()` (L5140) and as a compact strip above the composer when non-empty.
- Add a demo control that advances the state machine (same spirit as the existing "Complete sample run" at L5756), so the mock shows Queued → Delivered at next safe point → Applied.
- In the Activity view (`sessionMain()` L4930) add an explicit visibility line: "Working tree as of 09:22 — these changes are already written" vs "the agent is mid-edit; nothing new to show yet", plus a **Show me the file now** action.
- Rename the review-page action **Request changes** so it is clearly different from steering a live agent.
- Acceptance: queue a steer → its state is visible and advances → cancel works before delivery → the mock never claims an in-flight edit was changed.

### Wave 3 — reading the agent, and planning objects

**S8 — Turn rail in the chat (#7, M).**

- Add a rail to the agent pane (`renderPaneBody()` L5046, `sessionMain()` L4930): one marker per turn, always visible (not hover-only), ≥8px hit target with a 24px row.
- Hover/focus preview card: turn number, your prompt (truncated), what the agent produced (files touched, checks), elapsed.
- Active/current turn is marked while reading; clicking jumps the scroll container (`#session-scroll`) and the rail highlights the visible turn on scroll.
- Keyboard: `[` / `]` previous/next turn, `g` then number optional. Add to the keydown handler at L6130.
- Deliberately better than the current Paseo rail (`packages/app/src/agent-stream/chat-outline/rail.tsx`): visible labels, larger targets, preview on hover, keyboard steps.
- Acceptance: from the bottom of a long session you can reach any named turn in one click or one keypress; the rail is visible at 390x844 (collapsed to a bottom sheet or edge strip).

**S9 — Thinking → what it produced (#5, M).** Depends on S8, decision D3.

- In Full view, make thinking blocks collapsible and attach a **led to →** link to the specific tool calls and output they produced; number the trace (1 reasoning → 2 decision → 3 action → 4 result).
- Add **Why this change?** on a diff hunk that opens the trace beside it.
- Honest gaps: everywhere without fixture reasoning shows "Reasoning not available for this step" rather than invented text.
- Acceptance: one hunk traces from reasoning to the exact produced lines; unavailable steps say so; the trace is reachable from both the transcript and the diff.

**S10 — Slice detail page (#9, M).**

- Make the workstream columns in `diagramWorkstreams()` (L4767) clickable (`data-action="slice:foundation"` etc.), and add the same entries to the mobile list below the diagram.
- New state `st.slices: [{id, name, outcome, scope[], done[], remaining[], tasks[], notes[], references[], runs[]}]` and a new route/section `slice` reached from the Plan page (a full-width detail panel, not a modal).
- Show: what this slice is for, planning-phase checklist (what is still open in planning), linked tasks with status, notes/ideas/questions, references (prototype, docs), and any run already made for it with its status.
- Acceptance: click `01 / FOUNDATION · MVP scope` → a page opens with its scope, remaining planning items, TASK-20/TASK-24 links, notes, and the linked run; back returns to Plan with the same lens selected.

**S11a — Sequences: one run made of existing runs and tasks (#10, M).** Depends on S10, decision D4.

- New state `st.sequences: [{id, name, steps: [{kind: "task"|"run"|"prompt", ref, gate: "auto"|"approval", status}], onFailure: "stop"|"continue"|"ask", status}]`.
- Create from the task board ("put these 5 tasks in a sequence"), from a run ("add this run to a sequence"), or from the schedules page. Order with the existing ↑↓ pattern (L4811). Preview: `TASK-24 → TASK-21 → TASK-22 → review step`.
- Start with the same honest simulation as `authorizeRun` (L5742): one step at a time, blocked step shown with its reason, never silently skipped. Sequence status strip in the workspace sidebar: "Sequence · step 2 of 5 · waiting on you".
- Acceptance: build a 5-task sequence, start it, watch it advance step by step, and see the failure policy honoured when a step is blocked.

**S11b — Schedules: fire sequences, runs or tasks on a timer (new, M).** Depends on S11a, decision D4.

- New state `st.schedules: [{id, name, targets: [{kind, ref}], trigger: {mode: "time"|"cadence"|"weekdays"|"onFinish", at?, every?, days?, parentRef?}, enabled, nextFires[], lastRuns[]}]`.
- The schedules page becomes real rows instead of the `cadence` fixture ("Daily 07:00 · Next 10h 14m"): what fires, when, the next three fire times, the last three outcomes, and a **Pause** switch.
- A schedule may hold one sequence, several runs together, or a single solo task/prompt. Mixed targets are allowed and shown as a list, not merged into one blob.
- "When X finishes" trigger wires a schedule to a run's completion — the chain behaviour, expressed as a schedule rather than a hidden pipeline.
- Acceptance: one schedule containing 2 runs + 1 solo task on a weekday cadence shows its next three fire times; pausing it updates the workspace sidebar; a "when RUN-TASK-21 finishes" schedule fires in the mock when that run is completed.

**Not in scope for S11a/S11b:** real cron, timezones, retry policy, notification routing, concurrency limits.

**S12 — Multiple workspaces per project (#12, M).** Decision D5.

- Add `workspaces[]` to `projectData`; key `st.layouts` by workspace id instead of project id (`layoutFor()` L4474, `enterLayout()` L4537, `workspacePage()` L5113).
- Add **New workspace** in: the project header (L4725), the sidebar project expander (`projectRow()` L4659), and the workspace location bar (L5113). Name/host/branch(worktree) chosen in a small modal, reusing the existing modal pattern (`case "modal"` L6008).
- Sidebar lists all workspaces for a project; the workspace bar gets a switcher.
- Acceptance: create a second workspace for SEICHO, each keeps its own panes/tabs/split ratios independently, and switching workspaces never closes a session.

**S13 — Plain-English pass (#6, M).** Do last, after surfaces settle; the word list is enforced from S0 onward.

- Replace in all user-visible strings: Provenance → **Where this came from**; Verification receipt → **Checks that ran**; deterministic checks → **Automatic checks**; observed changes → **Changes you can see**; fixture-r2 → **sample version r2**; orchestrator → **Main agent**; specialist / child agent → **Helper agent**; gate → **Approval step**; delivery → **sent**; bundle → **feedback list**; artifact → **file**; reconcile → **merge and commit**; vertical slice → **part of the feature**; stale → **out of date**; transcript → **full conversation**; projection → **view**; canonical → **main**.
- Keep real identifiers (TASK-21, RUN-S21, file paths, model names) untouched.
- Acceptance: the smoke grep check finds no banned word in rendered strings; a non-developer can read every page top to bottom.

## Order and parallelism

```
S0 ─┬─ S1 (width)
    ├─ S2 (panes)          independent, parallel-safe (different regions)
    └─ S3 (diagram)
S4 (range select) → S5 (bundle return) → S6 (side chat) → S7 (steer)
S8 (turn rail) → S9 (thinking trace)
S10 (slice page) → S11a (sequences) → S11b (schedules)
S12 (workspaces)            independent
S13 (language sweep)        last
```

**Status:** S0–S10 done (plus Stop/Interrupt on the execution tree, which was not in the plan). S11a is next, then S11b, S12, and S13 last.

Fastest useful path if you want to stop early: **S0 → S1 → S2 → S4 → S5 → S3** fixes the daily friction (width, duplicate controls, closing, sub-line targeting, save-and-return, diagram bloat) without needing any new product decision. S6/S7/S9/S11 are the ones that need D1–D4 agreed first.

## Explicit non-goals

- No production code change, no real agent execution, no real Git, no real model calls.
- No new persistence layer in the mock beyond the existing `localStorage` pattern.
- No new framework, bundler or dependency in the mock.
- No attempt at IDE parity, real file editing, or real multi-device sync inside the mock.
- Do not redesign the sidebar or the IA again in these slices; the current IA is accepted direction.
