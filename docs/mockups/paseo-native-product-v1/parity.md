# Existing Paseo parity and proposed behavior

Reference fork: `infectiousstupidity/paseo` on main, inspected 2026-10-15. Relevant source: `packages/app/src/components/left-sidebar.tsx`, `components/sidebar/sidebar-nav-rows.tsx`, `screens/workspace/workspace-screen.tsx`, `workspace-desktop-tabs-row.tsx`, `workspace-tab-menu.ts`, `workspace-new-tab-menu.tsx`, `panels/panel-manifest.ts`, `panels/agent-panel.tsx`, `panels/provider-subagent-panel.tsx`, `screens/new-workspace-screen.tsx`, `screens/settings-screen.tsx`, `screens/schedules-screen.tsx`, `screens/projects-screen.tsx`, and `styles/theme.ts`. Source remains untouched.

| Native capability | Current prototype | Proposed prototype | Coverage / caveat |
| --- | --- | --- | --- |
| Sidebar projects and nested workspaces | Yes | Yes | Sample projects; not live list or actual collapse settings |
| New workspace, add project / folder / clone | Modal | Modal | Path and host selection simulated; no real I/O |
| Standalone agent/terminal | New workspace / tabs | Top-level quick actions | Provider/model/host/path fixture; no live process |
| Workspace tab strip, split supporting pane, reselect | Yes | Yes | No actual drag/multi-split/persistence; buttons change pane/tab |
| Agent/composer/model/reasoning | Yes | Yes + Focus/Activity/Full | Transcript fixture; send saves local sample message |
| Agent/subagent inspector | Linked detail | Expanded tree and controls | Child Stop/Interrupt simulated, telemetry unavailable |
| Files/Markdown/diff/browser/terminal/Git | Tab and pane selection | Same pane targets | Fixture contents only; no real explorer, diff/git backend |
| Tab X: archive / terminal terminate | Confirmation in both modes | Confirmation + proposed semantics caveat | Native `agent` archive and terminal lifecycle must be validated before implementation |
| History/Search/Command Center | Yes | Yes | Search filters local example rows; Ctrl+K command menu |
| Shiori plugin navigation | Yes | Tools / project-linked view | No plugin replacement or new state store |
| Schedules | Yes | Yes + conditional concept | Calendar cadence fixture; cloud reset condition clearly speculative |
| Codex quota/Usage | Yes | Yes | Static reference values, never treated as live/admission-safe |
| Hosts and host settings | Yes | Yes | Sample connection states and simple destinations |
| App/host settings, plugins, permissions | Yes | Yes | Representative tabs and editable local controls; not every native field |
| Provider/agent import | Command → import example | Command → import example | Route is present, not a real session import |
| Sidebar preferences, keyboard nav | Example settings | Example settings | Full native preference semantics not replicated |
| Git commit/push/PR | Git menu | Git reconciliation receipt | No network calls or real Git writes; PR view only a conceptual route |
| Voice, file attachment, session restoration | Listed in context | Not implemented | Missing interactive native fidelity: must be explicitly addressed later |
| Mac/mobile navigation | Responsive CSS | Responsive CSS | Real browser visual/touch proof pending due managed Chromium block |

Proposed-only concepts: Home attention, durable Project Overview/Plan/Runs/Knowledge, a shared review inspector, task queue reorder/authorization, revision-anchored feedback, stepwise idea-to-prototype-to-task, external artifact import/export, skill/tool review workbench, explicit unknown telemetry and conditional capacity scheduling. These are **not claims about existing Paseo/Shiori capabilities**.

Remaining parity holes before declaring full task acceptance: true close/archive semantics and native pane drag/split resizing, actual imported session UX, voice/attachments, keyboard focus/touch validation, a complete Settings/Hosts/Add Project comparison and screenshot verification. This prototype deliberately avoids introducing fake live integrations.
