#!/usr/bin/env node
// Measures the content column on every page of the mock, at several viewport widths.
// Slice S1 acceptance: the content column must be the same width on every page.
//
//   node docs/mockups/paseo-mock-widths.mjs
//   node docs/mockups/paseo-mock-widths.mjs 2560x900

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const url = pathToFileURL(
  new URL("./paseo-mock.html", import.meta.url).pathname.replace(/^\//, ""),
).href;

const specs = (process.argv[2] || "3440x1440,2560x900,1440x900,390x844").split(",");

const screens = [
  ["home", ["home"]],
  ["projects", ["projects"]],
  ["project/overview", ["project:seicho"]],
  ["project/plan", ["project:seicho", "section:plan"]],
  // Slice S10: the parts lens draws its diagram at wide widths and swaps to a list on a phone;
  // one part opened as a page of its own has to sit in the same content column.
  ["project/plan/parts", ["project:seicho", "section:plan", "lens:workstreams"]],
  ["project/slice", ["project:seicho", "section:plan", "lens:workstreams", "slice:foundation"]],
  // Slice S11a: a sequence is a project section of its own, so it gets the same column.
  ["project/sequences", ["project:seicho", "section:sequences"]],
  ["project/runs", ["project:seicho", "section:runs"]],
  ["project/knowledge", ["project:seicho", "section:knowledge"]],
  ["history", ["history"]],
  ["schedules", ["schedules"]],
  ["hosts", ["hosts"]],
  ["settings", ["settings"]],
  ["workspace", ["workspace"]],
];

const browser = await chromium.launch();

for (const spec of specs) {
  const [width, height] = spec.split("x").map(Number);
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(url);

  const rows = [];
  for (const [name, actions] of screens) {
    await page.evaluate(() => window.__PASEO_MOCK__.action("home"));
    for (const key of actions) await page.evaluate((k) => window.__PASEO_MOCK__.action(k), key);
    rows.push(
      await page.evaluate((label) => {
        const pick = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
          };
        };
        const screen = pick(".screen") || pick(".work-body");
        const prose = pick(".session-content") || pick(".composer");
        return {
          name: label,
          screen,
          prose,
          gutters: screen ? `${screen.left} / ${innerWidth - screen.right}` : "?",
        };
      }, name),
    );
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n== ${spec} ==`);
  for (const row of rows) {
    const s = row.screen;
    console.log(
      `${pad(row.name, 18)} ${pad(s ? s.left : "?", 5)}${pad(s ? s.right : "?", 7)}${pad(s ? s.width : "?", 7)}gutters ${row.gutters}${
        row.prose ? `  prose ${row.prose.width}` : ""
      }`,
    );
  }
  // The workspace is a full-bleed pane tree, not a measured document page: compare it by
  // its reading measure instead of its container width.
  const pages = rows.filter((r) => r.screen && r.name !== "workspace");
  const widths = pages.map((r) => r.screen.width);
  const spread = Math.max(...widths) - Math.min(...widths);
  const measures = rows.filter((r) => r.prose).map((r) => r.prose.width);
  const measureSpread = Math.max(...measures) - Math.min(...measures);
  console.log(
    `  document pages: ${widths.length} · width spread ${spread}px ${spread === 0 ? "OK" : "<-- inconsistent"}` +
      ` · reading measure ${measures.join("/")} ${measureSpread === 0 ? "OK" : "<-- inconsistent"}`,
  );

  await context.close();
}

await browser.close();
