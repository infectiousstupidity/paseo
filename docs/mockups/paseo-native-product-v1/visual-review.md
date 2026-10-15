# Reference inventory, visual review, and evidence status

## User screenshots (unpublished references)

All ten screenshots supplied in the request are 2048×828 PNGs; apparent origin is the user's Paseo desktop installation. Original display pixel dimensions/DPR and capture scaling are unknown. No user screenshots or account/path text were committed. Only filename/coverage data appears here.

| Local filename (2026-10-15) | View / state | Baseline confidence |
| --- | --- | --- |
| `054945.png`, `054952.png` | Workspace: Shiori agent transcript, split Markdown preview, plugin/sidebar, command/composer area; duplicate images | High for shell, relative proportions and state |
| `054957.png` | Codex quota cards; 5-hour/weekly layout | High |
| `055002.png` | History list / recent sessions | High |
| `055010.png` | Search / command center overlay | High |
| `055018.png` | New schedule modal | High |
| `055040.png` | Settings → General | High |
| `055049.png` | Settings → Sidebar | High |
| `055056.png` | Settings → Agents | High |
| `055111.png` | Settings → Host Projects detail | High |

Missing direct screenshot references: true New Workspace dialog, Add Project, Hosts overview, active agent/subagent control panel, tab close confirmations, native Files/Git/browser/terminal screens, mobile and macOS layouts. Those portions are conservatively derived from code and must not be presented as screenshot-matched. Screenshots were inspected as visual references only, not copied into mock backgrounds.

## Baseline reconstruction audit

The uploaded installation screenshots use the Midnight palette. Actual fork `packages/app/src/styles/theme.ts` defines `midnightDarkColors` with sidebar `#121420`, workspace/surface0 `#161820`, surface1 `#1c1e27`, surface2 `#252731`, muted text `#9a9db0`. The prototype is initialized with this family; sidebar width is about 232 CSS px at supplied image scale (exact physical DPR unknown). Native route composition was checked against `left-sidebar.tsx`, `sidebar-nav-rows.tsx`, `workspace-desktop-tabs-row.tsx`, `panel-manifest.ts`, `agent-panel.tsx`, `projects-screen.tsx`, `schedules-screen.tsx` and `settings-screen.tsx`. Relative pane split, tab strip, composer, footer icons and project hierarchy follow the photographed installation as closely as possible without launching it.

Known qualitative differences from the photographs: mock secondary preview contains shorter Markdown; tab titles/workspace fixture content are simplified; native icons, type hinting, exact footer density, scrollbar styling, toolbars and some resizable behaviors are approximations. Settings show representative controls instead of all registered fields. The mock uses larger secondary text intentionally for readability, not a pixel-perfect 2048-pixel downscaled image.

## Actual verification result

- **PASS**: JavaScript syntax (`node --check`); fixture state-machine test (`node node-smoke.cjs`), 17/17 checks. Covered A/B context, shared approval, queue safeguards, authorization, source line annotation, feedback bundle, terminal close confirmation, capture, prototype acceptance, safe import conflict, schedule, tools, and settings/navigation.
- **BLOCKED**: Browser-rendered screenshots. Environment policy `/etc/chromium/policies/managed/000_policy_merge.json` blocks all browser URL navigation. Attempts to capture `file://`, local HTTP and `data:` yielded `net::ERR_BLOCKED_BY_ADMINISTRATOR`. No screenshots were manufactured or treated as passing.
- **NOT YET VERIFIED**: Desktop screenshot comparison, layout and visual discrepancy resolution, touch interaction, keyboard focus tab-order, responsive overlap and screenshots at requested widths. This is an explicit acceptance gap, not a pass.

## Screenshot capture checklist for unrestricted browser

Run `node visual-capture.cjs` with Playwright available locally. Output is `.visual-evidence/` and not added to Git. Inspect: baseline Current at **2048×828** against source captures; Current at **3440×1440**; Proposed Home, Project, active workspace/diff/review/modal at **3440×1440**, **5120×1440**, **2560×900**, **1440×900**, **1280×800** (laptop), and **390×844**. Record actual device DPR if known and avoid comparing scaled 2048 pixel source as native 3440 without accounting for scale.

For each state compare sidebar widths, title/tab alignment, screenshot use of whitespace, contrast, footer availability, inspector overlap, copy length/wrapping, modal bounds and phone focus/keyboard behavior. Fix specific screenshots before asking the user to approve any redesign. No active Electron window should be moved/focused; use only the isolated prototype browser.
