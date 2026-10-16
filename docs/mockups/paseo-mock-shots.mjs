#!/usr/bin/env node
// Screenshots of docs/mockups/paseo-mock.html at the widths we care about.
//
//   node docs/mockups/paseo-mock-shots.mjs                 # all viewports, all screens
//   node docs/mockups/paseo-mock-shots.mjs --only workspace
//   node docs/mockups/paseo-mock-shots.mjs --viewport 3440x1440
//
// Output: docs/mockups/shots/<viewport>-<screen>.png
// Requires the chromium browser that is already installed with this repo's playwright.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mock = resolve(here, "paseo-mock.html");
const outDir = join(here, "shots");
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const only = argValue("--only");
const viewportArg = argValue("--viewport");

function argValue(name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}

// What a turn rail must satisfy at any width: marks for every turn, each one big enough to
// click, the current one visible, and nothing sitting on top of the conversation.
function railProblems(label, rail) {
  if (!rail) return [`${label}: no turn rail on screen`];
  const bad = [];
  if (rail.marks < 4) bad.push(`${label}: only ${rail.marks} turn marks`);
  if (rail.wide < 8 || rail.row < 24)
    bad.push(`${label}: turn mark ${rail.size}, under 8px wide or a row under 24px`);
  if (rail.visible !== "visible") bad.push(`${label}: the current turn mark is ${rail.visible}`);
  if (rail.covered.length) bad.push(`${label}: the rail covers ${rail.covered.join(", ")}`);
  return bad;
}

// What the reasoning trace must satisfy at any width: every copy of it on screen has all four
// numbered steps, it says what the reasoning led to, and a changed line still carries a
// control big enough to click. On a narrow screen the inspector closes when the diff comes
// forward, so the marked lines count as the trace being present.
function traceProblems(label, trace) {
  if (!trace) return [`${label}: no reasoning trace on screen`];
  const bad = [];
  if (!trace.hosts.length && !trace.marked)
    bad.push(`${label}: neither the reasoning nor the lines it produced on screen`);
  trace.hosts.forEach((steps, i) => {
    if (steps !== 4) bad.push(`${label}: trace ${i + 1} has ${steps} step(s), expected 4`);
  });
  if (trace.hosts.length && !trace.ledTo)
    bad.push(`${label}: the reasoning does not say what it led to`);
  if (trace.hosts.length && !trace.produced)
    bad.push(`${label}: the trace does not show the lines it produced`);
  if (trace.diff && !trace.asks.length)
    bad.push(`${label}: no Why this change? control on a changed line`);
  for (const size of trace.asks)
    if (size.wide < 40 || size.row < 22)
      bad.push(`${label}: Why this change? is ${size.label}, under 40x22`);
  if (trace.clipped.length) bad.push(`${label}: clipped ${trace.clipped.join(", ")}`);
  return bad;
}

// What the parts of the plan must satisfy at any width: the diagram is the wide-screen form
// and the list under it is the phone form, so exactly one of them may be showing, and every
// part has to be openable from whichever one is — at a size a thumb can hit.
function planPartsProblems(label, parts) {
  if (!parts) return [`${label}: no plan parts on screen`];
  const bad = [];
  if (parts.diagramShown === parts.listShown)
    bad.push(`${label}: diagram and list are both ${parts.diagramShown ? "shown" : "hidden"}`);
  if (parts.openable !== parts.total)
    bad.push(`${label}: only ${parts.openable} of ${parts.total} parts can be opened`);
  for (const size of parts.sizes)
    if (size.wide < 40 || size.row < 24)
      bad.push(`${label}: a part control is ${size.label}, under 40x24`);
  return bad;
}

// What one part's own page must satisfy: the planning content is on screen, the way back is
// there, the Plan tab stays marked, and no line of the checklist is squeezed out of its box.
function slicePageProblems(label, detail) {
  if (!detail) return [`${label}: no part detail page`];
  const bad = [];
  if (detail.missing.length) bad.push(`${label}: missing ${detail.missing.join(", ")}`);
  if (!detail.planTabActive) bad.push(`${label}: the Plan tab is not marked while a part is open`);
  if (detail.clipped.length) bad.push(`${label}: clipped ${detail.clipped.join(", ")}`);
  return bad;
}

// What a sequence page must satisfy at any width: the order chain shows every step, the page
// says which step it is on, a step that cannot be taken says why instead of offering a dead
// control, and the control that takes a step is still big enough to hit on a phone.
function sequenceProblems(label, seq) {
  if (!seq) return [`${label}: no sequence on screen`];
  const bad = [];
  if (seq.chips !== seq.rows)
    bad.push(`${label}: the order chain shows ${seq.chips} of ${seq.rows} steps`);
  if (!seq.onStep) bad.push(`${label}: the page does not say which step it is on`);
  if (seq.panels !== 1)
    bad.push(`${label}: ${seq.panels} places say where the sequence stands, expected 1`);
  if (seq.blockedWithoutReason) bad.push(`${label}: a step is called Blocked without saying why`);
  if (seq.runOnBlocked) bad.push(`${label}: a step that cannot be taken is offered as takeable`);
  for (const size of seq.takeControls)
    if (size.wide < 40 || size.row < 22)
      bad.push(`${label}: a step control is ${size.label}, under 40x22`);
  if (seq.clipped.length) bad.push(`${label}: clipped ${seq.clipped.join(", ")}`);
  return bad;
}

// What the strip in the workspace sidebar must satisfy: it is there while a sequence is
// going, it names the step, and it fits the screen it is drawn on.
function stripProblems(label, strip) {
  if (!strip) return [`${label}: no sequence strip in the sidebar`];
  const bad = [];
  if (!/step \d+ of \d+/.test(strip.text))
    bad.push(`${label}: the strip does not say which step it is on`);
  if (strip.hidden) bad.push(`${label}: the strip is hidden`);
  if (!strip.inside) bad.push(`${label}: the strip leaves the viewport (${strip.label})`);
  if (strip.clipped) bad.push(`${label}: the strip is clipped (${strip.label})`);
  return bad;
}

const VIEWPORTS = (
  viewportArg ? [viewportArg] : ["3440x1440", "2560x900", "1440x900", "390x844"]
).map((spec) => {
  const [width, height] = spec.split("x").map(Number);
  return { label: spec, width, height };
});

// Each screen is a list of mock actions applied in order, so the shot shows real state.
// `setDraft:` types into the annotation field, which no action can do by itself.
const SCREENS = [
  { name: "home", actions: ["home"] },
  { name: "projects", actions: ["projects"] },
  { name: "project-overview", actions: ["project:seicho"] },
  { name: "project-plan", actions: ["project:seicho", "section:plan"] },
  // slice S10: the parts of the plan, in the diagram on a wide screen and in the list on a
  // phone, and one part opened as a page of its own.
  { name: "plan-parts", actions: ["project:seicho", "section:plan", "lens:workstreams"] },
  {
    name: "slice-detail",
    actions: ["project:seicho", "section:plan", "lens:workstreams", "slice:foundation"],
  },
  { name: "project-runs", actions: ["project:seicho", "section:runs"] },
  { name: "project-knowledge", actions: ["project:seicho", "section:knowledge"] },
  { name: "workspace", actions: ["workspace"] },
  { name: "workspace-split", actions: ["workspace", "splitFirst"] },
  { name: "workspace-changes", actions: ["workspace", "workspaceView:changes"] },
  { name: "review-inspector", actions: ["workspace", "inspect:review"] },
  { name: "file-inspector", actions: ["workspace", "inspect:file", "line:6"] },
  { name: "agents-inspector", actions: ["project:seicho", "section:runs", "inspect:agents"] },
  {
    name: "side-chat",
    actions: [
      "workspace",
      "char:6:22:40",
      "feedback:ask",
      "setDraft:Why normalize here instead of translating the raw text?",
      "saveAnnotation",
    ],
  },
  // slice S7: the steer queue and the change-request list, both at every width.
  {
    name: "steer-queue",
    actions: [
      "workspace",
      "task:TASK-24",
      "authorizeRun",
      "char:6:22:40",
      "feedback:steer",
      "setDraft:Keep the original wording in the title.",
      "saveAnnotation",
      "setDraft:Do not touch the heading levels.",
      "steerDraft",
      "workspaceView:activity",
      "showFile",
    ],
  },
  // slice S8: the turn rail, in the summary view and in the full conversation.
  { name: "turn-rail", actions: ["workspace", "setTurn:4"] },
  { name: "turn-rail-full", actions: ["workspace", "workspaceView:full", "setTurn:4"] },
  {
    name: "change-request",
    actions: [
      "workspace",
      "inspect:qa",
      "setDraft:The normalized terms drift from the glossary.",
      "requestChanges",
    ],
  },
  // slice S9: the reasoning trace, in the conversation and beside the change it explains.
  {
    name: "thinking-trace",
    actions: ["workspace", "workspaceView:full", "whyChange:6", "traceStep:2:3"],
  },
  { name: "thinking-trace-changes", actions: ["workspace", "whyChange:6", "traceDiff:2"] },
  { name: "history", actions: ["history"] },
  { name: "schedules", actions: ["sideClose", "schedules"] },
  { name: "schedules-paused", actions: ["schedules", "scheduleToggle:schedule-1"] },
  { name: "schedules-form", actions: ["schedules", "scheduleNew"] },
  {
    name: "schedules-form-weekdays",
    actions: ["schedules", "scheduleNew", "scheduleField:mode:weekdays"],
  },
  {
    name: "schedules-sequence",
    actions: [
      "sequenceFromQueue",
      "schedules",
      "scheduleNew",
      "scheduleField:name:Oppgavene i rekkefølge",
      "scheduleTarget:sequence:$seq",
      "scheduleSave",
    ],
  },
  { name: "schedules-sidebar", actions: ["workspace:seicho", "inspect:shioriHome"] },
  { name: "settings", actions: ["settings"] },
  // Slice S11a: one run made of work that already exists. The order chain, a step that
  // cannot be taken, the choice the policy puts in front of you, and the strip the workspace
  // sidebar shows while a sequence is going. $seq is the sequence the screen just made.
  {
    name: "sequences",
    actions: [
      "project:seicho",
      "section:plan",
      "sequenceFromQueue",
      "sequenceStart:$seq",
      "sequenceRun:$seq",
    ],
  },
  {
    name: "sequences-running",
    actions: [
      "project:seicho",
      "section:plan",
      "sequenceFromQueue",
      "sequenceStart:$seq",
      "sequenceRun:$seq",
      "sequenceRun:$seq",
      "finishRun",
    ],
  },
  {
    name: "sequences-blocked",
    actions: [
      "project:seicho",
      "section:plan",
      "sequenceFromQueue",
      "sequenceStart:$seq",
      "sequenceRun:$seq",
      "sequenceRun:$seq",
      "sequenceRun:$seq",
    ],
  },
  {
    name: "sequences-ask",
    actions: [
      "project:seicho",
      "section:plan",
      "sequenceFromQueue",
      "sequencePolicy:$seq:ask",
      "sequenceStart:$seq",
      "sequenceRun:$seq",
      "sequenceRun:$seq",
      "sequenceRun:$seq",
    ],
  },
  { name: "sequence-strip", actions: ["workspace", "inspect:shioriHome"] },
];

const browser = await chromium.launch();
const problems = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(pathToFileURL(mock).href, { waitUntil: "load" });

  for (const screen of SCREENS) {
    if (only && !screen.name.includes(only)) continue;
    await page.evaluate(() => window.__PASEO_MOCK__.action("home"));
    for (const step of screen.actions) {
      await page.evaluate((key) => {
        const api = window.__PASEO_MOCK__;
        if (key.startsWith("setDraft:")) {
          api.state.commentDraft = key.slice("setDraft:".length);
          return;
        }
        // Which turn the rail marks is state, not an action: setting it keeps the shot on the
        // view the screen is about instead of jumping the pane to the full conversation.
        if (key.startsWith("setTurn:")) {
          api.state.turnRailActive = Number(key.slice("setTurn:".length));
          return;
        }
        let resolved =
          key === "splitFirst"
            ? `paneSplit:right:${api.state.layouts[api.state.currentLayoutKey].id}`
            : key;
        // A sequence is created by the screen's own actions, so the screen names the one it
        // made instead of counting what earlier screens left behind.
        if (resolved.includes("$seq"))
          resolved = resolved.replaceAll("$seq", api.state.sequences.slice(-1)[0]?.id ?? "");
        if (resolved) api.action(resolved);
      }, step);
    }
    // A step that only sets state (setDraft:, setTurn:) leaves the page as it was; render once
    // more so the shot shows that state.
    await page.evaluate(() => window.__PASEO_MOCK__.render());
    const file = join(outDir, `${viewport.label}-${screen.name}.png`);
    await page.screenshot({ path: file });

    // Overflow check: nothing should stick out of the viewport.
    const overflow = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll(
        ".app, .work-body, .view, .screen, .inspector, .pane, .side-drawer, .steer-queue, .steer-item, .steer-strip, .activity-visibility, .turn-rail, .turn-marker, .turn-preview, .turn-block, .seq-strip, .seq-preview, .seq-block, .seq-actions, .task-row",
      )) {
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.left < -1 || r.width > innerWidth + 1) {
          bad.push(`${el.className || el.tagName} ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
      }
      return bad;
    });
    if (overflow.length)
      problems.push(`${viewport.label} ${screen.name}: overflow ${overflow.join(" | ")}`);

    // The rail has to survive every width: visible marks, big enough to click, and clear of
    // the conversation it sits beside.
    if (screen.name.startsWith("turn-rail")) {
      const rail = await page.evaluate(() => {
        const bar = document.querySelector(".turn-rail");
        if (!bar) return null;
        const r = bar.getBoundingClientRect();
        const mark = bar.querySelectorAll("button.turn-marker")[3];
        const cs = getComputedStyle(mark);
        const covered = [
          ...document.querySelectorAll(
            ".session-content .message, .session-content .turn-block, .session-content .code-block, .session-content h1",
          ),
        ]
          .map((el) => {
            const a = el.getBoundingClientRect();
            const w = Math.min(a.right, r.right) - Math.max(a.left, r.left);
            const h = Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top);
            return w > 2 && h > 2 ? `${el.className} ${Math.round(w)}x${Math.round(h)}` : null;
          })
          .filter(Boolean);
        return {
          marks: bar.querySelectorAll("button.turn-marker").length,
          size: `${cs.width} x ${cs.height}`,
          wide: parseFloat(cs.width),
          row: parseFloat(cs.height),
          visible: getComputedStyle(bar.querySelector("button.turn-marker.active")).visibility,
          covered,
        };
      });
      problems.push(...railProblems(`${viewport.label} ${screen.name}`, rail));
    }

    // The trace has to survive every width too: all four steps, the link out of the reasoning,
    // and a control on the changed line that is still clickable.
    if (screen.name.startsWith("thinking-trace")) {
      const trace = await page.evaluate(() => {
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return {
            wide: r.width,
            row: r.height,
            label: `${Math.round(r.width)}x${Math.round(r.height)}`,
          };
        };
        const clipped = [
          ...document.querySelectorAll(
            ".trace-step, .trace-line, .trace-calls span, .diff-line-row",
          ),
        ]
          .filter(
            (el) =>
              el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "hidden",
          )
          .map((el) => `${el.className} ${el.scrollWidth}>${el.clientWidth}`);
        return {
          hosts: [...document.querySelectorAll(".trace-steps")].map(
            (n) => n.querySelectorAll(".trace-step").length,
          ),
          ledTo: !!document.querySelector(".trace-led-link"),
          produced: !!document.querySelector(".trace-produced"),
          diff: !!document.querySelector(".diff-line"),
          asks: [...document.querySelectorAll(".btn.why-change")].map(rect),
          marked: document.querySelectorAll(".diff-line-row.produced").length,
          clipped,
        };
      });
      problems.push(...traceProblems(`${viewport.label} ${screen.name}`, trace));
    }

    // Slice S11a: the sequence page at every width — the order chain, the step it is on, and
    // what happens when a step cannot be taken.
    if (screen.name.startsWith("sequences")) {
      const seq = await page.evaluate(() => {
        const chain = document.querySelector(".seq-preview");
        if (!chain) return null;
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return {
            wide: r.width,
            row: r.height,
            label: `${Math.round(r.width)}x${Math.round(r.height)}`,
          };
        };
        const rows = [...document.querySelectorAll(".task-row")];
        const blocked = rows.filter((row) => row.querySelector(".status.blocked"));
        return {
          chips: chain.querySelectorAll("span").length,
          rows: rows.length,
          onStep: /step \d+ of \d+/.test(document.body.innerText),
          blockedWithoutReason: blocked.filter(
            (row) => row.querySelectorAll(".task-desc span").length < 2,
          ).length,
          panels: document.querySelectorAll(".seq-block").length,
          runOnBlocked: blocked.filter((row) => row.querySelector("[data-action^='sequenceRun:']"))
            .length,
          takeControls: [
            ...document.querySelectorAll(
              "[data-action^='sequenceRun:'], [data-action^='sequenceApprove:'], [data-action^='sequenceSkip:'], [data-action^='sequenceRetry:']",
            ),
          ].map(rect),
          clipped: [...chain.querySelectorAll("span")]
            .filter(
              (el) =>
                el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "hidden",
            )
            .map((el) => `${el.textContent} ${el.scrollWidth}>${el.clientWidth}`),
        };
      });
      problems.push(...sequenceProblems(`${viewport.label} ${screen.name}`, seq));
    }

    // Slice S11a: the strip in the workspace sidebar is the only sign a sequence is going
    // while you are somewhere else. It has to be on screen, name the step, and fit.
    if (screen.name === "sequence-strip") {
      const strip = await page.evaluate(() => {
        const el = document.querySelector(".seq-strip");
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: el.innerText,
          label: `${Math.round(r.width)}x${Math.round(r.height)}`,
          inside: r.left >= -1 && r.right <= innerWidth + 1,
          clipped: el.scrollWidth > el.clientWidth + 1 && cs.overflowX === "hidden",
          hidden: cs.display === "none" || cs.visibility === "hidden",
        };
      });
      problems.push(...stripProblems(`${viewport.label} ${screen.name}`, strip));
    }

    // Slice S10: the plan's parts, and one part opened from them.
    if (screen.name === "plan-parts") {
      const parts = await page.evaluate(() => {
        const total = window.__PASEO_MOCK__.state.slices.length;
        const shown = (el) => !!el && getComputedStyle(el).display !== "none";
        const svg = document.querySelector(".dd-frame .diagram-svg");
        const list = document.querySelector(".dd-frame .mobile-diagram-list");
        const openable = [...document.querySelectorAll("[data-action^='slice:']")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return {
          total,
          diagramShown: shown(svg),
          listShown: shown(list),
          openable: openable.length,
          sizes: openable.map((el) => {
            const r = el.getBoundingClientRect();
            return {
              wide: r.width,
              row: r.height,
              label: `${Math.round(r.width)}x${Math.round(r.height)}`,
            };
          }),
        };
      });
      problems.push(...planPartsProblems(`${viewport.label} ${screen.name}`, parts));
    }
    if (screen.name === "slice-detail") {
      const detail = await page.evaluate(() => {
        const need = [
          "Back to plan",
          "What this part covers",
          "Planning checklist",
          "Linked tasks",
          "Run already made for this part",
          "Notes, ideas and questions",
        ];
        const pageRoot = document.querySelector(".screen");
        const text = pageRoot ? pageRoot.textContent.replace(/\s+/g, " ") : "";
        const clipped = [
          ...document.querySelectorAll(".check-list div, .list-row p, .knowledge-notes .note-line"),
        ]
          .filter(
            (el) =>
              el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "hidden",
          )
          .map((el) => `${el.className} ${el.scrollWidth}>${el.clientWidth}`);
        const active = document.querySelector(".tabs button.active");
        return {
          missing: need.filter((t) => !text.includes(t)),
          planTabActive: !!active && active.textContent.includes("Plan"),
          clipped,
        };
      });
      problems.push(...slicePageProblems(`${viewport.label} ${screen.name}`, detail));
    }
  }

  if (errors.length)
    problems.push(`${viewport.label}: console/page errors ${errors.slice(0, 4).join(" | ")}`);
  await context.close();
}

await browser.close();

const count =
  VIEWPORTS.length * (only ? SCREENS.filter((s) => s.name.includes(only)).length : SCREENS.length);
console.log(`${count} screenshots in ${outDir}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log("  -", p);
  process.exitCode = 1;
} else {
  console.log("no overflow, no console errors");
}
