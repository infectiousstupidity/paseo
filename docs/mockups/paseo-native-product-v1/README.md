# Paseo native product prototype v1

**Design prototype, not production Paseo.** Open `index.html` in a current Chromium, Firefox or Safari browser. No build, dependencies or server are required. The only fixture data in the HTML is invented for the demo or adapted from the supplied UI screenshots; no credentials, live host connections, Git operations or Shiori execution are present.

## Try the main journeys

1. Start in **Current Paseo**: the Midnight-theme workspace sidebar, native-style tab strip, agent transcript/composer, Markdown support pane, quota/history/schedules/settings and project rows. Flip to **Proposed Paseo** without changing workspace. The A/B labels are always visible in the header.
2. In Proposed, open **Home → SEICHO review**. The exact same `REV-SEI-042` opens from Project Overview and Runs. Approving removes it from Home's Needs you; it does not silently commit or push anything.
3. Open **SEICHO → Plan**, reorder eligible `TASK-22` with arrow controls or drag/drop. `TASK-23` stays blocked. Select task, authorize an example run, switch agent **Focus / Activity / Full**, open the split diff, select line 17 and choose **Ask / Comment / Steer**. Reopen Review to submit saved comments or approve; open Git finalization separately.
4. **SEICHO → Knowledge → Capture** an Idea, Note, Question or task *proposal*. Open planning, choose a **Prototype profile**, preview in the native-style Browser pane, annotate an element, explicitly **Accept reference v1**, then return to Plan. Generated tasks and agent work are examples, not real project mutations.
5. **Export for AI chat**, inspect included assets, then **Import** a `.html`, `.md`, `.zip` or image filename to a selected simulated host/path. Choose conflict handling; inspect the added file under Files. Import does **not** imply design acceptance.
6. Use **New agent** or **New terminal** with no project. Try close on an agent or running terminal to see the different archive/terminate confirmations. Open **Tools → Review skill**, Schedules (including proposed cloud-condition toggle), Usage, Hosts, Settings, Add Project and Command Center (`Ctrl+K`).
7. Resize to 390 px: the sidebar becomes a menu and agent/supporting pane become individually navigable. Same demo IDs and state survive the layout change while the page remains open.

All buttons that appear to perform an external action explicitly update local in-memory fixtures only. State resets on refresh. Some peripheral host/settings controls are representative, not full reimplementations.

## Scenario index

| Scenario | Entry point / action |
| --- | --- |
| S1 Morning | Proposed → Home → Needs you → Review → close/back |
| S2 Standalone | New agent or New terminal in proposed sidebar |
| S3 First-class Project | SEICHO project row → Overview / Plan / Runs / Knowledge |
| S4 Capture and plan | Project → Capture → Knowledge → Start planning conversation |
| S5 HTML design | Project → Prototype → Browser preview → Annotate → Accept v1 |
| S6 Execution | Plan → move ready task → Authorize run → workspace |
| S7 Observe and steer | Workspace → Activity → diff lines → Ask / Comment / Steer |
| S8 Review and Git | Home or Runs → shared Review → approval → Git finalization |
| S9 Cloud exchange | Prototype / Project → Export → Import → Files |
| S10 Optimization | Tools → Review skill → optional reviewers → synthesis |
| S11 Scheduling | Schedules → New schedule → condition toggle (concept only) |
| S12 Mobile/Mac | Resize browser to 390 / 1280 / 1440 widths; retain task and review |
| S13 Native parity | Current/Proposed sidebar + tab menu, Command Center, Settings |
| S14 Diagnostics | Workspace → Agents inspector → model, reasoning, unavailable metrics; Tools |

## Information architecture / decisions

The shell keeps Paseo's sidebar, workspace panel tree, tabs and composer. **Home** is a cross-project projection rather than a second queue; **Project** is a durable destination that links SEICHO identity, Shiori tasks, Git state and Paseo executions; **Workspace** continues to handle actual agents/terminals/diffs; **Tools** houses schedules, skills, optimization and configuration. `REV-SEI-042`, `TASK-21`, `RUN-SEI-021` refer to one set of in-memory sample objects across these surfaces. A first-class Project is **proposed**, not present in the Current baseline.

Accepted product direction: explicit focus, context-anchored comments, one review entity, native panes and standalones, approval separated from Git finalization. Still to decide in implementation: project vs workspace top-level tabs, agent tab archive semantics vs hide, exact host file-transfer transport, true source revisions/events, child agent action capabilities and telemetry provenance, accepted feature identity, conditional scheduling ownership and device-specific saved layouts. User approval of the redesign is still pending.

## Verification and provenance

`node --check` on the extracted inline JS and `node node-smoke.cjs` succeeded in this environment (17 fixture transition tests). Browser screenshots were **not** captured: managed Chromium policy rejects every navigation, including `file://`, `http://127.0.0.1` and `data:` with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Therefore visual parity, keyboard/touch behavior in a real rendered browser, and viewport overflow remain **unverified**. `visual-review.md` records the limitation and remaining comparison work. Do not treat this as a finished screenshot-approved UI.

For browser verification on a machine without the managed policy, use an existing Playwright installation or `npm install --no-save playwright`, then `node visual-capture.cjs`. The script uses an isolated headless browser, screenshots only this HTML fixture, and does not focus any active Electron window. Evidence outputs go to `./.visual-evidence/` (ignored locally, not committed). Compare 2048×828 to the supplied installation reference, then review all requested sizes. The original reference screenshots are deliberately **not** committed; the user has not authorized publishing screenshots containing local sessions or paths.

See [`visual-review.md`](visual-review.md) for screenshot inventory, static source/token comparison, visual blocker and next steps, and [`parity.md`](parity.md) for source-linked capability coverage.
