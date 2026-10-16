#!/usr/bin/env node
// Verification harness for docs/mockups/paseo-mock.html.
//
// Runs the mock's own <script> in a vm sandbox with a minimal DOM stub, then drives it
// through every route, section, pane and action. It asserts on the rendered HTML string.
// No browser, no build step, no new dependency.
//
//   node docs/mockups/paseo-mock-smoke.mjs                 # render + dead-end + scenarios
//   node docs/mockups/paseo-mock-smoke.mjs --strict-language  # also fail on jargon (S13)
//
// See docs/plans/paseo-mock-feedback-slices-2026-10.md (slice S0).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const mockPath = join(here, "paseo-mock.html");
const html = readFileSync(mockPath, "utf8");

const STRICT_LANGUAGE = process.argv.includes("--strict-language");

// ---------------------------------------------------------------- extract script

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const source = scripts[scripts.length - 1];
if (!source || source.length < 1000) fail(`could not find the mock <script> in ${mockPath}`);

// ---------------------------------------------------------------- DOM stub

const listeners = [];
const store = new Map();

function makeElement(id) {
  const el = {
    id,
    innerHTML: "",
    style: {},
    dataset: {},
    value: "",
    textContent: "",
    scrollTop: 0,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getAttribute: () => null,
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    focus() {},
    blur() {},
    remove() {},
    closest: () => null,
    contains: () => false,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    matches: () => false,
  };
  return el;
}

const appEl = makeElement("app");

const documentStub = {
  getElementById: (id) => (id === "app" ? appEl : null),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }),
  removeEventListener() {},
  activeElement: null,
  body: makeElement("body"),
  documentElement: makeElement("html"),
};

const windowStub = {
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
};

const sandbox = {
  document: documentStub,
  window: windowStub,
  innerWidth: 1440,
  matchMedia: windowStub.matchMedia,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  setTimeout: () => 0,
  clearTimeout: () => {},
  console,
  Math,
  Date,
  JSON,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Set,
  Map,
  RegExp,
  Error,
  TypeError,
  isNaN,
  parseInt,
  parseFloat,
  encodeURIComponent,
  decodeURIComponent,
};
sandbox.globalThis = sandbox;
sandbox.window.document = documentStub;
sandbox.window.localStorage = sandbox.localStorage;

try {
  new Script(source, { filename: "paseo-mock.html:script" }).runInNewContext(sandbox);
} catch (error) {
  fail(`the mock script threw while loading: ${error.stack || error}`);
}

const api = windowStub.__PASEO_MOCK__;
if (!api?.state || typeof api.action !== "function" || typeof api.render !== "function") {
  fail(
    "window.__PASEO_MOCK__ must expose { state, action, render } — found:",
    Object.keys(api || {}),
  );
}
const { state: st, action } = api;

const render = () => {
  api.render();
  return appEl.innerHTML;
};

// ---------------------------------------------------------------- assertions

let failures = 0;
let checks = 0;
const pending = [];
const pageSnapshots = new Map();

function fail(...args) {
  console.error("\x1b[31mFAIL\x1b[0m", ...args);
  process.exitCode = 1;
  failures++;
}

function check(name, condition, detail = "") {
  checks++;
  if (!condition) fail(name, detail);
}

function visit(label, fn) {
  try {
    const out = fn();
    if (!out || out.length < 200) fail(`${label}: rendered only ${out?.length ?? 0} chars`);
    return out || "";
  } catch (error) {
    fail(`${label}: threw ${error.message}`);
    return "";
  }
}

// ---------------------------------------------------------------- 1. every page renders

const pages = [];

function page(label, fn) {
  const out = visit(label, fn);
  if (out) pages.push({ label, out });
  pageSnapshots.set(label, snapshot());
  return out;
}

page("home", () => (action("home"), render()));
page("projects", () => (action("projects"), render()));
page("history", () => (action("history"), render()));
page("schedules", () => (action("schedules"), render()));
page("hosts", () => (action("hosts"), render()));
page("usage", () => (action("usage"), render()));
page("tools", () => (action("tools"), render()));
page("settings", () => (action("settings"), render()));

for (const project of ["seicho", "pivolution", "atlas", "northwind", "larkspur"]) {
  page(`project:${project}`, () => (action("project:" + project), render()));
  for (const section of ["overview", "plan", "runs", "knowledge"]) {
    page(`project:${project}/${section}`, () => (action("section:" + section), render()));
  }
}

page("workspace", () => (action("workspace"), render()));

for (const inspector of ["review", "qa", "shiori", "agents", "approvals", "task", "file", "diff"]) {
  page(`inspector:${inspector}`, () => (action("inspect:" + inspector), render()));
}

page("workspace:activity", () => (action("workspaceView:activity"), render()));
page("workspace:changes", () => (action("workspaceView:changes"), render()));
page("workspace:files", () => (action("workspaceView:files"), render()));
page("workspace:terminal", () => (action("workspaceView:terminal"), render()));
page("workspace:browser", () => (action("workspaceView:browser"), render()));

// --- slice S6: a side chat is a temporary question beside the main session. The drawer
// overlays the inspector, and the chip is the only thing the main transcript gains.
page("side-chat", () => {
  action("workspace");
  action("char:6:22:40");
  st.commentDraft = "Why normalize here instead of translating the raw text?";
  action("feedback:ask");
  action("saveAnnotation");
  action("clearToast");
  // A second question is already typed, so replaying the ask control does real work.
  st.commentDraft = "Does the term list cover drinks?";
  return render();
});

// --- slice S7: the steer queue only exists once something is in it, so render a page
// with a live queue. The dead-end probe then covers the queue's own controls.
page("workspace:steer-queue", () => {
  startSampleRun();
  steerTheSelection();
  st.commentDraft = "Do not touch the heading levels.";
  action("steerDraft");
  action("workspaceView:activity");
  action("clearToast");
  return render();
});

// --- slice S9: the one worked reasoning trace, in the conversation and beside the diff.
page("thinking-trace", () => {
  action("workspace");
  action("workspaceView:full");
  action("whyChange:6");
  action("traceStep:2:3");
  return render();
});
page("thinking-trace:in-changes", () => {
  action("workspace");
  action("whyChange:6");
  action("traceDiff:2");
  return render();
});

// --- slice S10: the plan page's parts lens, and one part opened as a page of its own.
page("project:seicho/plan:parts", () => {
  action("project:seicho");
  action("section:plan");
  action("lens:workstreams");
  return render();
});
page("project:seicho/slice", () => (action("slice:foundation"), render()));

// ---------------------------------------------------------------- 2. no leaked placeholders

const LEAK = /\bundefined\b|\bNaN\b|\[object Object\]|\[object Object\]|>\s*null\s*</g;
for (const { label, out } of pages) {
  const hits = [...out.matchAll(LEAK)].map((m) => m[0]);
  check(
    `${label}: no leaked values in markup`,
    hits.length === 0,
    hits.length + " hit(s): " + uniq(hits).join(", "),
  );
}

// ---------------------------------------------------------------- 3. every control is wired

const KNOWN_COMMANDS = new Set(
  [...source.matchAll(/^\s*case "([a-zA-Z][a-zA-Z-]*)"/gm)].map((m) => m[1]),
);

const seenActions = new Map();
for (const { label, out } of pages) {
  for (const m of out.matchAll(/data-action="([^"]+)"/g)) {
    const key = m[1];
    if (!seenActions.has(key)) seenActions.set(key, label);
  }
}

for (const [key, where] of seenActions) {
  const command = key.split(":")[0];
  check(
    `control "${key}" (first seen on ${where}) names a known command`,
    KNOWN_COMMANDS.has(command),
    `no case "${command}" in action()`,
  );
}

// ---------------------------------------------------------------- 4. dead-end probe
// The failure mode we are hunting is a control whose only effect is a toast: the user
// clicks and nothing on screen changes (feedback points 3 and 4). We replay each control
// from the page it was found on and diff the state.
//   toastOnly  -> a real finding: the click produced a message and nothing else
//   noChange   -> informational: toggles and already-selected items legitimately no-op

function snapshot() {
  try {
    return JSON.stringify(st);
  } catch {
    return null;
  }
}

function diffKeys(a, b) {
  const x = JSON.parse(a);
  const y = JSON.parse(b);
  return Object.keys(x).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
}

const TOAST_FIELDS = new Set(["toast"]);

const toastOnly = new Map();
const noChange = new Map();

for (const { label, out } of pages) {
  const keys = uniq([...out.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]));
  const pageState = pageSnapshots.get(label);
  if (pageState === undefined) continue;
  for (const key of keys) {
    restore(pageState);
    render();
    try {
      action(key);
      render();
    } catch (error) {
      fail(`control "${key}" (on ${label}) threw: ${error.message}`);
      continue;
    }
    const changed = diffKeys(pageState, snapshot());
    if (changed.length === 0) add(noChange, key, label);
    else if (changed.every((k) => TOAST_FIELDS.has(k))) add(toastOnly, key, label);
  }
}
restore(pageSnapshots.get("home") ?? snapshot());
render();

function add(map, key, label) {
  if (!map.has(key)) map.set(key, label);
}

// ---------------------------------------------------------------- 5. scenarios
// Behaviour we want locked in. Update these as slices land.

// --- slice S6 helpers: look at the transcript region alone, so the drawer cannot hide
// a change to the main session.
const CHIP = /<div class="side-chat-chips">[\s\S]*?<\/div>/;

function transcript(out) {
  const from = out.indexOf('id="session-scroll">');
  if (from === -1) return "";
  const end = out.indexOf('<div class="composer-wrap">', from);
  // Drop the two closing tags of the session wrappers: content is appended inside them.
  return out.slice(from, end === -1 ? out.length : end).replace(/<\/div><\/div>$/, "");
}

function askAboutSelection() {
  action("workspace");
  action("char:6:22:40");
  st.commentDraft = "Why normalize here instead of translating the raw text?";
  action("feedback:ask");
}

// The same tab the mock's own composer actions resolve to.
function activeTab() {
  const leaf = leaves().find((l) => l.id === st.focusPaneId) || leaves()[0];
  return st.tabsById[leaf?.selected] || null;
}

// --- slice S7 helpers: steering only means something while a run is actually going, so
// start the one sample run that is authorized to start.
function startSampleRun() {
  action("workspace");
  action("task:TASK-24");
  action("authorizeRun");
  if (st.execution !== "running") throw new Error("the sample run did not start");
}

function steerTheSelection(text = "Keep the original wording in the title.") {
  action("char:6:22:40");
  st.commentDraft = text;
  action("feedback:steer");
  action("saveAnnotation");
}

// --- slice S8 helpers: the turn rail is keyboard reachable, so drive the key handlers the
// mock registers instead of calling the action behind the key.
function pressKey(key, extra = {}) {
  const event = {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: { id: "", closest: () => null, matches: () => false, dataset: {} },
    preventDefault() {},
    ...extra,
  };
  for (const l of listeners) if (l.type === "keydown") l.fn(event);
}

function turnActions(out) {
  return [...out.matchAll(/data-action="(turn:[^"]+)"/g)].map((m) => m[1]);
}

// The inspector's own markup. A check written against the whole page could pass on text the
// main view happens to show, which is the opposite of what an inspector check means.
function inspectorMarkup(out) {
  const from = out.indexOf('id="sidebar-panel"');
  if (from < 0) throw new Error("no inspector on screen");
  const to = out.indexOf("</aside>", from);
  return out.slice(from, to < 0 ? undefined : to);
}

const scenarios = [
  {
    name: "closing a tab in a one-tab pane does not break the workspace",
    setup: () => action("workspace"),
    run: () => {
      const leaf = firstLeaf();
      if (!leaf) throw new Error("no pane found");
      action(`paneClose:${leaf.id}:${leaf.tabs[0]}`);
      render();
    },
    expect: () => render().includes('class="app"'),
  },
  {
    name: "splitting then closing a pane returns to the pane count you started with",
    requires: "paneRemove",
    setup: () => action("workspace"),
    run: () => {
      const before = leafCount();
      action(`paneSplit:right:${firstLeaf().id}`);
      render();
      const after = leafCount();
      if (after !== before + 1) throw new Error(`split did not add a pane (${before} -> ${after})`);
      const extra = leaves()[1];
      action(`paneRemove:${extra.id}`);
      // A pane holding a live session asks first, same as closing its tab would.
      if (st.modal) action("modalConfirm");
      render();
      return leafCount() === before;
    },
    expect: (result) => result === true,
  },
  {
    name: "every tab exposes a close control",
    setup: () => action("workspace"),
    run: () => render(),
    expect: () => {
      const out = render();
      return leaves().every((leaf) =>
        leaf.tabs.every((id) => out.includes(`data-action="paneClose:${leaf.id}:${id}"`)),
      );
    },
  },
  {
    name: "every pane exposes a way to close the pane itself",
    requires: "paneRemove",
    setup: () => action("workspace"),
    run: () => {
      // The control lives in the pane menu, so open it before looking.
      const all = leaves();
      action(`paneMenu:${all[0].id}`);
      return render();
    },
    expect: () => {
      const out = render();
      return (
        out.includes('data-action="paneRemove:') &&
        out.includes("Close pane") &&
        out.includes('data-action="paneMaximize:')
      );
    },
  },
  {
    name: "maximizing a pane hides the others and restores them",
    requires: "paneMaximize",
    setup: () => {
      action("workspace");
      action(`paneSplit:right:${firstLeaf().id}`);
      render();
    },
    run: () => {
      action(`paneSplit:right:${firstLeaf().id}`);
      render();
      const all = leaves();
      action(`paneMaximize:${all[1].id}`);
      render();
      const maximized = (render().match(/class="native-leaf/g) || []).length;
      action(`paneMaximize:${all[1].id}`);
      render();
      const restored = (render().match(/class="native-leaf/g) || []).length;
      return maximized === 1 && restored === all.length;
    },
    expect: (result) => result === true,
  },
  {
    name: "saving a feedback comment lands you back on the review list",
    setup: () => {
      action("workspace");
      action("line:6");
      st.commentDraft = "Rename this helper.";
    },
    run: () => {
      action("saveAnnotation:comment");
      return render();
    },
    expect: () =>
      st.inspector === st.reviewInspector &&
      ["qa", "shiori"].includes(st.inspector) &&
      render().includes(`Review · ${st.comments.length}`),
  },
  {
    name: "the diff offers targets smaller than a whole line",
    requires: "char",
    setup: () => action("workspace"),
    run: () => {
      const hits = [...render().matchAll(/data-action="char:(\d+):(\d+):(\d+)"/g)];
      return hits.length >= 4;
    },
    expect: (r) => r === true,
  },
  {
    name: "clicking one word targets only that word",
    requires: "char",
    setup: () => action("workspace"),
    run: () => {
      const h = [...render().matchAll(/data-action="char:(\d+):(\d+):(\d+)"/g)][0];
      if (!h) throw new Error("no character targets rendered");
      action(`char:${h[1]}:${h[2]}:${h[3]}`);
      render();
      return (
        st.selectedRange?.line === Number(h[1]) &&
        st.selectedRange.from === Number(h[2]) &&
        st.selectedRange.to === Number(h[3]) &&
        st.inspector === "annotation"
      );
    },
    expect: (r) => r === true,
  },
  {
    name: "clicking a second word widens the target to the span between them",
    requires: "char",
    setup: () => action("workspace"),
    run: () => {
      const sameLine = new Map();
      for (const h of render().matchAll(/data-action="char:(\d+):(\d+):(\d+)"/g)) {
        if (!sameLine.has(h[1])) sameLine.set(h[1], []);
        sameLine.get(h[1]).push(h);
      }
      const pair = [...sameLine.values()].find((list) => list.length >= 2);
      if (!pair) throw new Error("no line offers two targets");
      action(`char:${pair[0][1]}:${pair[0][2]}:${pair[0][3]}`);
      action(`char:${pair[1][1]}:${pair[1][2]}:${pair[1][3]}`);
      render();
      return (
        st.selectedRange.from === Math.min(pair[0][2], pair[1][2]) &&
        st.selectedRange.to === Math.max(pair[0][3], pair[1][3])
      );
    },
    expect: (r) => r === true,
  },
  {
    name: "a saved comment keeps the exact characters it was about",
    requires: "char",
    setup: () => {
      action("workspace");
      const h = [...render().matchAll(/data-action="char:(\d+):(\d+):(\d+)"/g)][0];
      action(`char:${h[1]}:${h[2]}:${h[3]}`);
      st.commentDraft = "Name this differently.";
    },
    run: () => {
      const before = st.comments.length;
      action("saveAnnotation:comment");
      return st.comments.length === before + 1 && /:\d+-\d+ @/.test(st.comments.at(-1).source);
    },
    expect: (r) => r === true,
  },
  {
    name: "the view switcher appears once per pane",
    setup: () => action("workspace"),
    run: () => render(),
    expect: () => {
      const out = render();
      const dupes = (out.match(/data-action="paneShow:[^"]*:diff"/g) || []).length;
      return dupes <= leaves().length;
    },
  },

  // --- slice S3: the execution diagram is small on the Runs page and drawn once, in the dock
  {
    name: "the Runs page shows the compact hierarchy and no diagram at all",
    setup: () => {
      action("project:seicho");
      action("section:runs");
    },
    run: () => {
      const out = render();
      const pageArea = out.slice(0, dockStart(out));
      return {
        compact: pageArea.includes('class="exec-summary"'),
        trees: treeCount(out),
        diagrams: (pageArea.match(/class="diagram-svg/g) || []).length,
      };
    },
    expect: (r) => r.compact && r.trees === 0 && r.diagrams === 0,
  },
  {
    name: "the compact form names the main agent and every helper with status, model and elapsed",
    setup: () => {
      action("project:seicho");
      action("section:runs");
    },
    run: () => execChips(render()),
    expect: (chips) =>
      chips.length === 4 &&
      chips.filter((c) => /Main agent/.test(c.html)).length === 1 &&
      chips.filter((c) => /Helper agent/.test(c.html)).length === 3 &&
      chips.every(
        (c) =>
          c.name &&
          /class="exec-meta">[^<]/.test(c.html) &&
          /class="status [^"]*">[^<]/.test(c.html) &&
          /class="exec-elapsed">[^<]/.test(c.html),
      ),
  },
  {
    name: "the full tree appears once, and only inside the execution inspector",
    setup: () => {
      action("project:seicho");
      action("section:runs");
      action("inspect:agents");
    },
    run: () => {
      const out = render();
      const cut = dockStart(out);
      return (
        treeCount(out) === 1 &&
        treeCount(out.slice(0, cut)) === 0 &&
        treeCount(out.slice(cut)) === 1
      );
    },
    expect: (r) => r === true,
  },
  {
    name: "the tree is gone as soon as you leave the execution inspector",
    setup: () => {
      action("project:seicho");
      action("section:runs");
      action("inspect:agents");
    },
    run: () => {
      action("inspect:task");
      return treeCount(render());
    },
    expect: (n) => n === 0,
  },
  {
    name: "Open execution tree opens the inspector and leaves the compact form on the page",
    setup: () => {
      action("project:seicho");
      action("section:runs");
    },
    run: () => {
      const button = [...render().matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].find((m) =>
        m[2].includes("Open execution tree"),
      );
      if (!button) throw new Error("the Runs page renders no Open execution tree control");
      const key = (/data-action="([^"]+)"/.exec(button[1]) || [])[1];
      if (!key) throw new Error("Open execution tree has no data-action");
      action(key);
      return { key, out: render() };
    },
    expect: ({ key, out }) =>
      st.inspector === "agents" &&
      key !== "none" &&
      treeCount(out) === 1 &&
      out.slice(0, dockStart(out)).includes('class="exec-summary"'),
  },
  {
    name: "selecting an agent in the compact form opens the inspector on that agent",
    setup: () => {
      action("project:seicho");
      action("section:runs");
      action("inspect:close");
    },
    run: () => {
      const chips = execChips(render());
      if (!chips.length) throw new Error("the compact form renders no agent chips");
      const pick = chips[chips.length - 1];
      action(`agent:${pick.id}`);
      return { pick, out: render() };
    },
    expect: ({ pick, out }) =>
      st.inspector === "agents" &&
      st.selectedAgent === pick.id &&
      out.includes(`· ${pick.name}</strong>`) &&
      treeCount(out) === 1,
  },
  {
    name: "every page draws the execution tree at most once",
    run: () => {
      const routes = [
        ["home"],
        ["projects"],
        ["history"],
        ["schedules"],
        ["hosts"],
        ["usage"],
        ["tools"],
        ["settings"],
        ["project:seicho"],
        ["project:seicho", "section:overview"],
        ["project:seicho", "section:plan"],
        ["project:seicho", "section:runs"],
        ["project:seicho", "section:knowledge"],
        ["workspace"],
      ];
      const wrong = [];
      for (const route of routes) {
        action("home");
        for (const key of route) action(key);
        action("inspect:agents");
        const n = treeCount(render());
        if (n !== 1) wrong.push(`${route.join(">")}=${n}`);
      }
      return wrong;
    },
    expect: (wrong) => wrong.length === 0,
  },
  {
    name: "the execution surfaces say main agent and helper agent, nothing else",
    setup: () => {
      action("project:seicho");
      action("section:runs");
      action("inspect:agents");
    },
    run: () => {
      const words = [executionWords(render())];
      // The dock's own demo actions speak about the same agents; their wording counts too.
      for (const key of ["agentStop", "agentInterrupt"]) {
        action(key);
        words.push(st.toast || "");
      }
      return words.join(" ");
    },
    expect: (text) => {
      const banned =
        /\borchestrat\w*\b|\bspecialist\w*\b|\bchild\b|\broot session\b|\bprovenance\b|verification receipt|deterministic check|fixture-r/i;
      return /main agent/i.test(text) && /helper agent/i.test(text) && !banned.test(text);
    },
  },
  // --- slice S6: a side chat is a temporary question beside the main agent session
  {
    name: "a side chat can be started from the top bar, the composer and a selection",
    setup: () => action("workspace"),
    run: () => {
      const workspace = render();
      action("char:6:22:40");
      action("feedback:ask");
      const annotation = render();
      return (
        workspace.includes('data-action="sideChatNew"') &&
        workspace.includes('data-action="sideChat"') &&
        annotation.includes("Ask in a side chat")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "asking from a selection opens a side chat that carries the exact target",
    setup: askAboutSelection,
    run: () => {
      action("saveAnnotation");
      const out = render();
      const chat = st.sideChats[0];
      return (
        st.sideChats.length === 1 &&
        chat.temporary === true &&
        st.sideChat === chat.id &&
        out.includes('class="side-drawer"') &&
        out.includes("src/recipe-import.ts · line 6 · characters 22–40") &&
        out.includes("“normalizeNorwegian” replaces the call") &&
        out.includes("Sample answer · no model call") &&
        out.includes("No model was called")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the main transcript gains only the side chat chip",
    setup: askAboutSelection,
    run: () => {
      const before = transcript(render());
      action("saveAnnotation");
      const after = transcript(render());
      return after.replace(CHIP, "") === before && after.includes('class="side-chat-chip"');
    },
    expect: (ok) => ok === true,
  },
  {
    name: "closing the drawer keeps the thread and the chip reopens it",
    setup: () => {
      askAboutSelection();
      action("saveAnnotation");
    },
    run: () => {
      const id = st.sideChats[0].id;
      action("sideClose");
      const closed = render();
      action("sideOpen:" + id);
      const open = render();
      return (
        st.sideChats.length === 1 &&
        !closed.includes('class="side-drawer"') &&
        closed.includes(`data-action="sideOpen:${id}"`) &&
        open.includes("Why normalize here instead of translating the raw text?")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "every answer offers copy, add to main chat, save to knowledge and delete",
    setup: () => {
      askAboutSelection();
      action("saveAnnotation");
    },
    run: () => {
      const id = st.sideChats[0].id;
      const out = render();
      return (
        ["sideCopy:", "sideToMain:", "sideSave:", "sideDelete:"].every((a) =>
          out.includes(`data-action="${a}${id}"`),
        ) &&
        out.includes("Add to main chat") &&
        out.includes("Save to project knowledge") &&
        out.includes("Delete chat")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "adding the answer to the main chat appends it and changes nothing else",
    setup: () => {
      askAboutSelection();
      action("saveAnnotation");
    },
    run: () => {
      const id = st.sideChats[0].id;
      const before = transcript(render());
      action("sideToMain:" + id);
      const after = transcript(render());
      const tab = activeTab();
      return (
        tab.messages.length === 1 &&
        tab.messages[0].source === "from side chat" &&
        after.startsWith(before) &&
        after.includes("You · from side chat")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "saving the answer to project knowledge puts it in the knowledge list",
    setup: () => {
      askAboutSelection();
      action("saveAnnotation");
    },
    run: () => {
      action("sideSave:" + st.sideChats[0].id);
      const saved = st.knowledgeNotes.length;
      action("project:seicho");
      action("section:knowledge");
      return (
        saved === 1 && render().includes("Saved from a side chat · src/recipe-import.ts · line 6")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the counter counts open side chats and delete clears one",
    setup: () => action("workspace"),
    run: () => {
      action("sideChatNew");
      action("sideChatNew");
      const two = render();
      const id = st.sideChats[0].id;
      action("sideDelete:" + id);
      const one = render();
      return (
        st.sideChats.length === 1 &&
        two.includes('class="side-chat-badge">2<') &&
        two.includes("2 side chats open") &&
        one.includes('class="side-chat-badge">1<') &&
        !one.includes(`data-action="sideDelete:${id}"`)
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the composer entry point asks without sending to the main session",
    setup: () => action("workspace"),
    run: () => {
      const tab = activeTab();
      tab.draft = "What does the review gate actually check?";
      action("sideChat");
      return (
        st.sideChats.length === 1 &&
        st.sideChats[0].title === "What does the review gate actually check?" &&
        tab.messages.length === 0 &&
        render().includes('class="side-drawer"') &&
        render().includes("About SEICHO") &&
        render().includes("A real answer would appear here")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a side chat picks its own model, and may differ from the main session",
    setup: () => action("workspace"),
    run: () => {
      action("sideChatNew");
      const out = render();
      const from = out.indexOf('<select id="side-chat-model"');
      const select = out.slice(from, out.indexOf("</select>", from));
      const options = [...select.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map((m) => m[1]);
      return (
        from !== -1 &&
        options.length >= 4 &&
        select.includes("selected") &&
        options.includes(activeTab().model)
      );
    },
    expect: (ok) => ok === true,
  },
  // --- slice S7: steering shows an honest delivery state, and asking for changes on
  // finished work is a different thing entirely.
  {
    name: "a steering instruction lands in a queue with a delivery state, not a toast",
    setup: startSampleRun,
    run: () => {
      steerTheSelection();
      return render();
    },
    expect: (out) =>
      st.steerQueue.length === 1 &&
      st.steerQueue[0].state === "queued" &&
      st.steerQueue[0].target.file === "src/recipe-import.ts" &&
      out.includes("Steering instructions") &&
      out.includes("next safe point"),
  },
  {
    name: "the steer queue is visible in the execution inspector and above the composer",
    setup: () => {
      startSampleRun();
      steerTheSelection();
    },
    run: () => render(),
    expect: (out) =>
      out.includes('class="steer-queue"') &&
      out.includes('class="steer-strip"') &&
      out.includes('data-action="steerCancel:steer-1"') &&
      out.includes('data-action="steerAdvance"'),
  },
  {
    name: "cancelling before delivery works, and the instruction leaves the strip",
    setup: () => {
      startSampleRun();
      steerTheSelection();
    },
    run: () => {
      action("steerCancel:steer-1");
      return render();
    },
    expect: (out) =>
      st.steerQueue[0].state === "cancelled" &&
      !out.includes('class="steer-strip"') &&
      out.includes("Cancelled before it was sent"),
  },
  {
    name: "the demo step sends at the safe point, and an edit in flight stops short of Applied",
    setup: () => {
      startSampleRun();
      steerTheSelection();
    },
    run: () => {
      action("steerAdvance"); // queued -> sent at the safe point
      const sent = st.steerQueue[0].state;
      action("steerAdvance"); // the agent is mid-edit in this file, so it waits
      const waiting = st.steerQueue[0].state;
      action("finishRun");
      action("steerAdvance"); // no edit is in flight any more
      const applied = st.steerQueue[0].state;
      return sent === "delivered" && waiting === "interrupt_required" && applied === "applied";
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a delivered instruction cannot be taken back",
    setup: () => {
      startSampleRun();
      steerTheSelection();
      action("steerAdvance");
    },
    run: () => {
      action("steerCancel:steer-1");
      return st.steerQueue[0].state === "delivered";
    },
    expect: (ok) => ok === true,
  },
  {
    name: "steering an agent that is not running says so instead of pretending",
    setup: () => {
      action("workspace");
      action("char:6:22:40");
      st.commentDraft = "Keep the original wording in the title.";
      action("feedback:steer");
    },
    run: () => {
      action("saveAnnotation");
      return render();
    },
    expect: (out) =>
      st.steerQueue.length === 1 &&
      st.steerQueue[0].state === "unavailable" &&
      out.includes("Not available") &&
      out.includes('data-action="review:qa"') &&
      st.changeRequests.length === 0,
  },
  {
    name: "a kept draft is not sent, and deleting it is the same cancel path",
    setup: () => {
      startSampleRun();
      action("char:6:22:40");
      st.commentDraft = "Keep the original wording in the title.";
      action("feedback:steer");
    },
    run: () => {
      action("steerDraft");
      const out = render();
      const drafted = st.steerQueue[0].state === "draft";
      action("steerCancel:steer-1");
      return drafted && st.steerQueue[0].state === "cancelled" && out.includes("Draft");
    },
    expect: (ok) => ok === true,
  },
  {
    name: "asking for changes is a review decision, not a steering instruction",
    setup: () => {
      action("workspace");
      action("inspect:qa");
      st.commentDraft = "The normalized terms drift from the glossary.";
    },
    run: () => {
      action("requestChanges");
      return render();
    },
    expect: (out) =>
      st.steerQueue.length === 0 &&
      st.changeRequests.length === 1 &&
      out.includes("Change requests") &&
      out.includes("not sent to any agent") &&
      out.includes("Ask for changes"),
  },
  {
    name: "the Activity view says whether it shows written changes or an edit in flight",
    setup: () => {
      startSampleRun();
      action("workspaceView:activity");
    },
    run: () => {
      const running = render();
      action("finishRun");
      const settled = render();
      return (
        running.includes("mid-edit in src/recipe-import.ts") &&
        settled.includes("these changes are already written")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "show me the file now reveals the file as it stands, with its as-of time",
    setup: () => {
      action("workspace");
      action("workspaceView:activity");
    },
    run: () => {
      action("showFile");
      const out = render();
      action("hideFile");
      return (
        out.includes('class="file-now"') &&
        out.includes("changed lines as of 09:22") &&
        !render().includes('class="file-now"')
      );
    },
    expect: (ok) => ok === true,
  },
  // --- slice S8: a turn rail you can see, click and drive from the keyboard
  {
    name: "the turn rail shows one marker per turn, without hovering",
    setup: () => action("workspace"),
    run: () => {
      const out = render();
      const markers = turnActions(out);
      if (markers.length < 4) throw new Error(`only ${markers.length} turn markers on screen`);
      const turns = markers.map((a) => a.split(":").at(-1));
      if (new Set(turns).size !== turns.length) throw new Error("one turn has two markers");
      if (/<button class="turn-marker[^"]*"[^>]*(hidden|style="[^"]*opacity:0)/.test(out))
        throw new Error("a marker is hidden until you hover");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a turn marker is a clickable row, not a hairline",
    run: () => {
      const marker = /\.turn-marker \{([^}]*)\}/.exec(html);
      const bar = /\.turn-marker-bar \{([^}]*)\}/.exec(html);
      if (!marker || !bar) throw new Error("no turn marker rule in the CSS");
      const row = Number((/height:\s*(\d+)px/.exec(marker[1]) || [])[1]);
      const wide = Number((/width:\s*(\d+)px/.exec(marker[1]) || [])[1]);
      const barWide = Number((/width:\s*(\d+)px/.exec(bar[1]) || [])[1]);
      if (!(row >= 24)) throw new Error(`the marker row is ${row}px tall, under 24px`);
      if (!(wide >= 8 && barWide >= 8))
        throw new Error(`marker ${wide}px wide, bar ${barWide}px wide: under 8px`);
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "one click on the rail moves to that turn and marks it",
    setup: () => action("workspace"),
    run: () => {
      const markers = turnActions(render());
      if (markers.length < 4) throw new Error("no turn markers to click");
      action(markers[3]);
      if (st.turnRailActive !== 4) throw new Error(`turn 4 was not marked (${st.turnRailActive})`);
      return render().includes('class="turn-block current" id="turn-4"');
    },
    expect: (ok) => ok === true,
  },
  {
    name: "from the last turn, every other turn is one click away",
    setup: () => action("workspace"),
    run: () => {
      const markers = turnActions(render());
      for (let i = 0; i < markers.length; i++) {
        st.turnRailActive = markers.length;
        action(markers[i]);
        if (st.turnRailActive !== i + 1)
          throw new Error(`turn ${i + 1} took more than one click from the bottom`);
      }
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "jumping to a turn from the summary opens the conversation at that turn",
    setup: () => action("workspace"),
    run: () => {
      const markers = turnActions(render());
      action(markers[2]);
      const out = render();
      return activeTab()?.view === "full" && out.includes('data-turn="3"');
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the rail is there whichever view of the session you are looking at",
    setup: () => action("workspace"),
    run: () => {
      const summary = render();
      action("workspaceView:full");
      const full = render();
      const marks = (s) => turnActions(s).length;
      if (marks(summary) < 4) throw new Error("no rail in the summary view");
      if (marks(full) !== marks(summary)) throw new Error("the rail changed between views");
      const blocks = (full.match(/class="turn-block/g) || []).length;
      if (blocks !== marks(full)) throw new Error(`${blocks} turn blocks for ${marks(full)} marks`);
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the rail card says what that turn produced, in plain words",
    setup: () => action("workspace"),
    run: () => {
      const out = render();
      const cards = (out.match(/class="turn-preview"/g) || []).length;
      const names = out.match(/aria-label="Turn \d+ of \d+: /g) || [];
      if (cards < 4 || names.length !== cards)
        throw new Error(`${cards} cards, ${names.length} named markers`);
      return [
        "You asked:",
        "Main agent",
        "Helper agent",
        "Files",
        "Checks that ran",
        "Elapsed",
      ].every((phrase) => out.includes(phrase));
    },
    expect: (ok) => ok === true,
  },
  {
    name: "[ and ] move to the previous and next turn",
    setup: () => action("workspace"),
    run: () => {
      st.turnRailActive = 3;
      pressKey("]");
      const forward = st.turnRailActive;
      pressKey("[");
      pressKey("[");
      const back = st.turnRailActive;
      pressKey("[");
      pressKey("[");
      const floor = st.turnRailActive;
      if (forward !== 4 || back !== 2) throw new Error(`] gave ${forward}, [ gave ${back}`);
      if (floor !== 1) throw new Error(`running past the first turn landed on ${floor}`);
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "[ and ] do not steal the key from a field you are typing in",
    setup: () => action("workspace"),
    run: () => {
      st.turnRailActive = 3;
      pressKey("]", {
        target: { id: "composer-1", closest: (s) => (s.includes("textarea") ? {} : null) },
      });
      return st.turnRailActive === 3;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "stopping an agent changes what the tree says, not just the message",
    setup: () => action("inspect:agents"),
    run: () => {
      action("agentStop:root");
      return render();
    },
    expect: (out) =>
      st.agentState.root === "stopping" &&
      out.includes("Stopping") &&
      out.includes("Stop requested") &&
      out.includes("It has stopped now"),
  },
  {
    name: "a stop you asked for can be undone, and the tree goes back to the sample",
    setup: () => action("inspect:agents"),
    run: () => {
      action("agentStop:root");
      action("agentResume:root");
      render();
      return render();
    },
    expect: (out) =>
      st.agentState.root === undefined &&
      !out.includes("Stop requested") &&
      out.includes("Interrupt and redirect"),
  },
  {
    name: "an agent that already finished does not offer a stop button",
    setup: () => action("inspect:agents"),
    run: () => {
      action("agent:implementer");
      return render();
    },
    expect: (out) =>
      out.includes("already finished") && !out.includes('data-action="agentStop:implementer"'),
  },
  {
    name: "interrupting the main agent sends the change that was waiting on an interrupt",
    setup: () => action("inspect:agents"),
    run: () => {
      st.steerQueue = [
        {
          id: "STEER-9",
          text: "Use a shorter name here",
          target: { file: "src/recipe-import.ts" },
          state: "interrupt_required",
          createdAt: "09:20",
        },
      ];
      action("agentInterrupt:root");
      render();
      return render();
    },
    expect: () => st.agentState.root === "paused" && st.steerQueue[0].state === "delivered",
  },

  // --- slice S9: one worked reasoning trace, reachable from both places that ask for it.
  {
    name: "the worked example links its reasoning to the tool calls and the lines it produced",
    setup: () => {
      action("workspace");
      action("workspaceView:full");
    },
    run: () => {
      const out = render();
      const leads = [...out.matchAll(/data-action="(traceStep:\d+:\d+)"/g)].map((m) => m[1]);
      if (leads.length < 2) throw new Error(`only ${leads.length} led-to link(s) on screen`);
      action(leads[0]);
      const marked = render();
      const step = Number(leads[0].split(":")[2]);
      return (
        /1 reasoning → 2 decision → 3 action → 4 result/.test(out) &&
        st.traceStep === step &&
        marked.includes('class="trace-step marked"') &&
        marked.includes("Edit src/recipe-import.ts") &&
        marked.includes("src/recipe-import.ts · lines 6, 7, 9")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "following the trace to the end marks the exact lines it produced in Changes",
    setup: () => {
      action("workspace");
      action("workspaceView:full");
    },
    run: () => {
      action("traceStep:2:4");
      const out = render();
      if (!out.includes("+  const ingredients = normalizeNorwegian(parsed.ingredients);"))
        throw new Error("the produced lines are not shown");
      action("traceDiff:2");
      const diff = render();
      return (
        (diff.match(/class="diff-line-row produced"/g) || []).length === 3 &&
        diff.includes("Back to the reasoning")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "Why this change? on a changed line opens the same trace beside the diff",
    setup: () => action("workspace"),
    run: () => {
      const out = render();
      const asks = [...out.matchAll(/data-action="whyChange:(\d+)"/g)].map((m) => m[1]);
      if (asks.length < 2) throw new Error(`only ${asks.length} changed line(s) offer the control`);
      action("whyChange:" + asks[0]);
      const panel = inspectorMarkup(render());
      return (
        st.inspector === "trace" &&
        panel.includes("WHY THIS CHANGE / src/recipe-import.ts · line " + asks[0]) &&
        panel.includes("The exact lines it produced") &&
        panel.includes("Open the full conversation")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a step with no recorded reasoning says so instead of inventing one",
    setup: () => {
      action("workspace");
      action("workspaceView:full");
    },
    run: () => {
      const conversation = render();
      const turns = (conversation.match(/class="turn-block/g) || []).length;
      const worked = (conversation.match(/class="thinking"/g) || []).length;
      const gaps = (conversation.match(/Reasoning not available for this step/g) || []).length;
      action("whyChange:7");
      const panel = inspectorMarkup(render());
      return (
        turns >= 4 &&
        worked === 1 &&
        gaps === turns - worked &&
        panel.includes(
          "Turn 1 · Main agent made this change, but its reasoning was not recorded.",
        ) &&
        panel.includes("Reasoning not available for this step") &&
        !panel.includes("trace-step")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a thinking block collapses and reopens with the trace intact",
    setup: () => {
      action("workspace");
      action("workspaceView:full");
    },
    run: () => {
      const open = render();
      action("thinking:2");
      const closed = render();
      action("thinking:2");
      const again = render();
      const steps = (out) => (out.match(/class="trace-step /g) || []).length;
      return (
        st.thinkingOpen[2] === true &&
        !closed.includes('class="trace-steps"') &&
        closed.includes("Show reasoning") &&
        steps(closed) === 0 &&
        steps(again) === steps(open) &&
        steps(open) === 4
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the trace is reachable from the conversation and from the diff",
    setup: () => action("workspace"),
    run: () => {
      const diff = render();
      action("workspaceView:full");
      const conversation = render();
      return (
        /data-action="whyChange:\d+"/.test(diff) &&
        /data-action="thinking:\d+"/.test(conversation) &&
        /data-action="traceStep:\d+:\d+"/.test(conversation)
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the round trip from a changed line to the reasoning and back lands on the conversation",
    setup: () => action("workspace"),
    run: () => {
      action("whyChange:6");
      const beside = inspectorMarkup(render());
      action("traceDiff:2");
      const changes = render();
      action("traceConversation:2");
      const conversation = render();
      return (
        beside.includes("The exact lines it produced") &&
        (changes.match(/class="diff-line-row produced"/g) || []).length === 3 &&
        changes.includes("Back to the reasoning") &&
        st.workspaceView === "full" &&
        conversation.includes('id="trace-2-1"') &&
        // The jump request is one-shot: it must not fire again on the next render.
        st.traceScrollTo === ""
      );
    },
    expect: (ok) => ok === true,
  },

  // --- slice S10: the parts of the plan are clickable, and each one is a page of its own.
  {
    name: "every column of the plan parts diagram opens that part",
    setup: () => {
      action("project:seicho");
      action("section:plan");
      action("lens:workstreams");
    },
    run: () => {
      const out = render();
      const found = uniq([...out.matchAll(/data-action="slice:([a-z]+)"/g)].map((m) => m[1]));
      const ids = st.slices.map((s) => s.id);
      const missing = ids.filter((id) => !found.includes(id));
      if (missing.length) throw new Error(`not clickable: ${missing.join(", ")}`);
      if (found.length !== ids.length)
        throw new Error(`${found.length} slice controls for ${ids.length} parts`);
      // Each column is a real control for the keyboard, not just a picture.
      const focusable = (
        out.match(/<g class="node" role="button" tabindex="0" data-action="slice:/g) || []
      ).length;
      if (focusable !== ids.length)
        throw new Error(`${focusable} of ${ids.length} columns can be reached by keyboard`);
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "opening a part shows its scope, open planning items, tasks, notes and its run",
    setup: () => {
      action("project:seicho");
      action("section:plan");
      action("lens:workstreams");
      action("slice:foundation");
    },
    run: () => {
      const plain = render().replace(/<[^>]+>/g, " ");
      const s = st.slices.find((x) => x.id === "foundation");
      const need = [
        s.name,
        s.title,
        s.scope[0],
        s.remaining[0],
        s.notes[0],
        "Prototype v2",
        "Planning checklist",
        "Linked tasks",
        "TASK-20",
        "TASK-24",
        "RUN-S21",
        "Run already made for this part",
      ];
      const absent = need.filter((text) => !plain.includes(text));
      if (absent.length) throw new Error(`not on the page: ${absent.join(" | ")}`);
      if (!plain.includes("sample run")) throw new Error("the run is not labelled as a sample");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "back from a part returns to the plan with the lens you were on",
    setup: () => {
      action("project:seicho");
      action("section:plan");
      action("lens:workstreams");
      action("slice:foundation");
    },
    run: () => {
      if (st.section !== "slice" || st.planLens !== "workstreams")
        throw new Error("opening the part changed the lens");
      action("sliceBack");
      const out = render();
      if (st.section !== "plan" || st.planLens !== "workstreams")
        throw new Error(`back landed on ${st.section}/${st.planLens}`);
      // The plan page comes back with its diagram, not with the part still showing.
      return out.includes("PARTS OF THE PLAN") && !out.includes("Run already made for this part");
    },
    expect: (ok) => ok === true,
  },
  {
    name: "moving from one part to another still leads back to the plan",
    setup: () => {
      action("project:seicho");
      action("section:plan");
      action("lens:dependencies");
      action("lens:workstreams");
      action("slice:foundation");
    },
    run: () => {
      action("slice:quality");
      render();
      if (st.selectedSlice !== "quality") throw new Error("the second part did not open");
      action("sliceBack");
      return st.section === "plan" && st.planLens === "workstreams";
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the plan parts are in the list under the diagram, which is the phone path",
    setup: () => {
      action("project:seicho");
      action("section:plan");
      action("lens:workstreams");
    },
    run: () => {
      const out = render();
      const from = out.indexOf('<div class="mobile-diagram-list">');
      if (from < 0) throw new Error("no list under the diagram");
      const listMarkup = out.slice(from, out.indexOf("</div>", from));
      const absent = st.slices.filter((s) => listMarkup.indexOf(`data-action="slice:${s.id}"`) < 0);
      if (absent.length)
        throw new Error(`the list is missing ${absent.map((s) => s.id).join(", ")}`);
      // The diagram is the wide-screen path (CSS hides it on a phone) and the list is the
      // narrow one. Neither may be hidden with an inline style, or it stops being reachable.
      return (
        out.includes('class="diagram-svg"') && !out.includes('class="mobile-diagram-list" style=')
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a part of the plan keeps its content reachable and survives a rebuild",
    setup: () => {
      action("project:seicho");
      action("section:plan");
      action("lens:workstreams");
      action("slice:experience");
    },
    run: () => {
      const first = render();
      render();
      const again = render();
      if (first !== again) throw new Error("the page changed between two rebuilds");
      if (first.includes("display:none")) throw new Error("content on the page is hidden");
      // A part with no run says so instead of showing an invented one.
      return first.includes("No run has been made for this part yet.");
    },
    expect: (ok) => ok === true,
  },
];

for (const scenario of scenarios) {
  if (scenario.requires && !KNOWN_COMMANDS.has(scenario.requires)) {
    pending.push(`${scenario.name} (needs action "${scenario.requires}")`);
    continue;
  }
  const before = snapshot();
  let ok;
  let runResult;
  try {
    scenario.setup?.();
    render();
    runResult = scenario.run();
    ok = scenario.expect(runResult);
  } catch (error) {
    ok = `threw: ${error.message}`;
  }
  restore(before);
  render();
  if (ok === true) {
    checks++;
    continue;
  }
  if (scenario.knownFailing) {
    pending.push(`${scenario.name} (expected to fail until slice ${scenario.knownFailing})`);
    continue;
  }
  fail(`scenario: ${scenario.name}`, ok === false ? "expectation returned false" : String(ok));
}

// ---------------------------------------------------------------- 6. language guard

const JARGON = [
  "provenance",
  "verification receipt",
  "deterministic check",
  "orchestrator",
  "specialist",
  "artifact",
  "canonical",
  "projection",
  "reconcile",
  "fixture-r",
  "vertical slice",
];

const visibleText = pages
  .map((p) => p.out.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " "))
  .join(" ")
  .toLowerCase();

const jargonHits = JARGON.filter((word) => visibleText.includes(word));
if (jargonHits.length) {
  const line = `jargon still on screen: ${jargonHits.join(", ")}`;
  if (STRICT_LANGUAGE) fail(line);
  else
    console.log("\x1b[33mWARN\x1b[0m", line, "(fatal with --strict-language, fixed in slice S13)");
}

// ---------------------------------------------------------------- 7. size guard

const cssBytes = (html.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1].length;
check("css stays under 120 KB", cssBytes < 120_000, `${cssBytes} bytes`);

// ---------------------------------------------------------------- report

console.log(
  `\n${checks - failures}/${checks} checks passed · ${pages.length} pages rendered · ${seenActions.size} distinct controls`,
);
if (toastOnly.size) {
  console.log(
    `\n\x1b[31m${toastOnly.size} control(s) whose only effect is a toast — click, message, nothing on screen:\x1b[0m`,
  );
  for (const [key, label] of toastOnly) console.log(`  - ${key}  (e.g. on ${label})`);
}
if (noChange.size) {
  console.log(
    `\n${noChange.size} control(s) that changed nothing at all from the page they were found on (informational: toggles and already-selected items legitimately no-op):`,
  );
  console.log("  " + [...noChange.keys()].join(", "));
}
if (pending.length) {
  console.log(`\n${pending.length} scenario(s) pending until the command exists:`);
  for (const name of pending) console.log("  -", name);
}
if (failures) console.log(`\n${failures} failure(s)`);
else console.log("\x1b[32mOK\x1b[0m");

// ---------------------------------------------------------------- helpers

function uniq(list) {
  return [...new Set(list)];
}

function restore(json) {
  const fresh = JSON.parse(json);
  for (const key of Object.keys(st)) delete st[key];
  Object.assign(st, fresh);
}

function layoutRoot() {
  return api.state.layouts[api.state.currentLayoutKey] || null;
}

function leaves(node = layoutRoot(), out = []) {
  if (!node) return out;
  if (node.kind === "leaf") out.push(node);
  else {
    leaves(node.a, out);
    leaves(node.b, out);
  }
  return out;
}

function firstLeaf() {
  return leaves()[0] || null;
}

// --- slice S3 helpers: the execution hierarchy is one row on the page, one tree in the dock

function dockStart(out) {
  const at = out.indexOf('<aside id="right-sidebar"');
  return at === -1 ? out.length : at;
}

function treeCount(out) {
  return (out.match(/class="diagram-svg exec-tree"/g) || []).length;
}

function execChips(out) {
  const chip = /<button class="exec-node[^"]*" data-action="agent:([^"]+)"([\s\S]*?)<\/button>/g;
  return [...out.matchAll(chip)].map((m) => ({
    id: m[1],
    html: m[0],
    name: ((/<strong>([^<]*)<\/strong>/.exec(m[2]) || [])[1] || "").trim(),
  }));
}

// Only the two execution surfaces: the Runs-page frame around the compact row, and the
// execution dock. Other pages still carry S13 jargon and are checked by the language guard.
function executionWords(out) {
  const from = out.indexOf("RUN-S21");
  const frameEnd = out.indexOf('<div class="two-col">');
  const frame = from === -1 || frameEnd < from ? "" : out.slice(from, frameEnd);
  const dockFrom = out.indexOf("<h2>Execution structure</h2>");
  const dockEnd = out.indexOf("</aside>");
  const dock = dockFrom === -1 || dockEnd < dockFrom ? "" : out.slice(dockFrom, dockEnd);
  return `${frame} ${dock}`.replace(/<[^>]+>/g, " ");
}

function leafCount() {
  return leaves().length;
}
