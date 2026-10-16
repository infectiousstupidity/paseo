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

// --- slice S11a: a sequence is one run made of work that already exists. The page only
// exists once there is a sequence, so each page below makes one first. The dead-end probe
// then replays the sequence's own controls in the state they appear in.
page("project:seicho/sequences", () => {
  resetSampleTasks();
  action("project:seicho");
  action("section:plan");
  const id = sequenceFromBoard();
  action(`sequenceStart:${id}`);
  // Step 1 is TASK-20, which was finished before the sequence existed.
  action(`sequenceRun:${id}`);
  action("clearToast");
  return render();
});
page("project:seicho/sequences:running", () => {
  resetSampleTasks();
  action("project:seicho");
  action("section:plan");
  const id = sequenceFromBoard();
  action(`sequenceStart:${id}`);
  action(`sequenceRun:${id}`);
  // Step 2 is TASK-24: the sample run is in flight, so the step is not settled yet.
  action(`sequenceRun:${id}`);
  action("clearToast");
  return render();
});
page("project:seicho/sequences:blocked", () => {
  resetSampleTasks();
  action("project:seicho");
  action("section:plan");
  const id = sequenceFromBoard();
  action(`sequenceStart:${id}`);
  action(`sequenceRun:${id}`);
  action(`sequenceRun:${id}`);
  action("finishRun");
  // Step 3 is TASK-21, which is in review. The default policy stops the sequence there.
  action(`sequenceRun:${id}`);
  action("clearToast");
  return render();
});
page("project:seicho/sequences:ask", () => {
  resetSampleTasks();
  action("project:seicho");
  action("section:plan");
  const id = sequenceFromBoard();
  action(`sequencePolicy:${id}:ask`);
  action(`sequenceStart:${id}`);
  action(`sequenceRun:${id}`);
  action(`sequenceRun:${id}`);
  action("finishRun");
  action(`sequenceRun:${id}`);
  action("clearToast");
  return render();
});

// S11b-1: every schedule state is reached with the same commands its controls use.
page("schedules:paused", () => {
  action("schedules");
  action("scheduleToggle:schedule-1");
  return render();
});
page("schedules:form", () => {
  action("scheduleToggle:schedule-1");
  action("scheduleNew");
  return render();
});
page("schedules:form:cadence", () => {
  action("scheduleField:mode:cadence");
  return render();
});
page("schedules:form:weekdays", () => {
  action("scheduleField:mode:weekdays");
  return render();
});
page("schedules:form:error", () => {
  action("scheduleSave");
  return render();
});
page("schedules:form:sequence", () => {
  action("modal:close");
  action("sequenceFromQueue");
  const seq = st.sequences[st.sequences.length - 1];
  action("schedules");
  action("scheduleNew");
  action("scheduleField:name:Gå gjennom oppgavene");
  action(`scheduleTarget:sequence:${seq.id}`);
  action("scheduleField:mode:weekdays");
  action("scheduleDay:fredag");
  return render();
});
page("schedules:sequence", () => {
  action("scheduleSave");
  return render();
});
page("workspace:schedule-paused", () => {
  action("scheduleToggle:schedule-1");
  action("workspace:seicho");
  action("inspect:shioriHome");
  return render();
});

// S11b-2: waiting, recorded and paused completions, plus every work-to-schedule entry.
page("schedules:onFinish:waiting", () => {
  resetFinishSample();
  action("schedules");
  action("clearToast");
  return render();
});
page("schedules:link:run", () => {
  action("project:seicho");
  action("section:runs");
  action("scheduleAdd:run:RUN-S21");
  action("clearToast");
  return render();
});
page("schedules:link:sequence", () => {
  action("modal:close");
  action("sequenceNew");
  action(`scheduleAdd:sequence:${st.selectedSequence}`);
  action("clearToast");
  return render();
});
page("schedules:link:task", () => {
  action("modal:close");
  action("task:TASK-24");
  action("scheduleAdd:task:TASK-24");
  action("clearToast");
  return render();
});
page("schedules:form:onFinish", () => {
  action("scheduleCreate");
  action("scheduleField:mode:onFinish");
  action("clearToast");
  return render();
});
page("schedules:onFinish:recorded", () => {
  action("modal:close");
  resetFinishSample();
  startSampleRun();
  action("finishRun");
  action("schedules");
  action("clearToast");
  return render();
});
page("workspace:schedule-recorded", () => {
  action("workspace:seicho");
  action("inspect:shioriHome");
  action("clearToast");
  return render();
});
page("schedules:onFinish:paused-completion", () => {
  resetFinishSample();
  action("scheduleToggle:schedule-3");
  startSampleRun();
  action("finishRun");
  action("schedules");
  action("clearToast");
  return render();
});
page("workspace:schedule-paused-completion", () => {
  action("workspace:seicho");
  action("inspect:shioriHome");
  action("clearToast");
  return render();
});
page("schedules:onFinish:resumed", () => {
  action("scheduleToggle:schedule-3");
  action("schedules");
  action("clearToast");
  return render();
});

// --- S12: create workspace records through the same small form the UI uses.
const beforeWorkspacePages = snapshot();
action("workspace:seicho");
const workspaceA = st.currentLayoutKey;
const workspaceB = createWorkspace("Ordlisten", "anon2", "ordliste");
page("project:seicho/two-workspaces", () => (action("project:seicho"), render()));
page("workspace:second-layout", () => {
  action("workspaceSwitch:" + workspaceB);
  action("paneSplit:right:" + firstLeaf().id);
  action("paneAdd:" + firstLeaf().id + ":browser");
  resizeSplit(layoutRoot(), "ArrowRight");
  return render();
});
page("workspace:first-restored", () => (action("workspaceSwitch:" + workspaceA), render()));
page("modal:new-workspace", () => (action("workspaceNew:seicho"), render()));
page("modal:new-workspace-ready", () => {
  workspaceField("name", "Utprøving");
  workspaceField("host", "anon3");
  workspaceField("branch", "utproving");
  return render();
});
restore(beforeWorkspacePages);
render();

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
check(
  "toast-only control count stays at the 20-control checkpoint",
  toastOnly.size === 20,
  `found ${toastOnly.size} toast-only controls`,
);

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

// --- slice S11a helpers: a sequence is a list of pointers at records that already exist,
// so the checks read the steps and the records behind them instead of the wording.
// The task records live outside st, so a state snapshot cannot put them back. Sequence
// pages and scenarios name the sample statuses they assume; this is the fixture's own start.
function resetSampleTasks() {
  const fixture = {
    "TASK-20": "done",
    "TASK-24": "ready",
    "TASK-21": "needs_review",
    "TASK-22": "blocked",
    "TASK-25": "planned",
  };
  for (const [id, value] of Object.entries(fixture)) api.task(id).status = value;
  st.currentRunningTask = null;
  api.recalc();
}
function sequenceFromBoard() {
  action("sequenceFromQueue");
  return st.sequences[st.sequences.length - 1].id;
}
function seqOf(id) {
  const seq = st.sequences.find((s) => s.id === id);
  if (!seq) throw new Error(`no sequence ${id}`);
  return seq;
}
const runningSteps = (seq) => seq.steps.filter((s) => s.status === "running");

// The workspace strip, alone. A check against the whole page could pass on the sequence
// page's own text, which is not what "the sidebar says it" means.
function stripMarkup(out) {
  const from = out.indexOf('class="seq-strip"');
  if (from < 0) throw new Error("no sequence strip on screen");
  return out.slice(from, out.indexOf("</button>", from) + 9);
}

function scheduleRow(out, id) {
  const row = out.match(
    new RegExp(
      `<article class="schedule-row" data-schedule-id="${id}"[^>]*>([\\s\\S]*?)</article>`,
    ),
  );
  if (!row) throw new Error(`no schedule row ${id}`);
  return row[1];
}
function scheduleList(row, className) {
  const list = row.match(new RegExp(`<ul class="${className}">([\\s\\S]*?)</ul>`));
  if (!list) throw new Error(`no ${className} list`);
  return [...list[1].matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1]);
}
function scheduleStripMarkup(out) {
  const strip = out.match(/<div class="schedule-strip seq-strip"[^>]*>([\s\S]*?)<\/div>/);
  if (!strip) throw new Error("no isolated schedule sidebar strip");
  return strip[1];
}

function resetFinishSample() {
  resetSampleTasks();
  const parent = st.taskRuns.find((r) => r.id === "RUN-TASK-24");
  parent.completed = false;
  const s = st.schedules.find((record) => record.id === "schedule-3");
  s.enabled = true;
  s.lastRuns = [];
  delete s.finishNote;
}

// S12 helpers drive the input/change listeners, including the native select switcher.
function workspaceField(field, value) {
  const type = field === "host" ? "change" : "input";
  for (const listener of listeners.filter((l) => l.type === type))
    listener.fn({ target: { id: "workspace-" + field, value, dataset: {} } });
}
function switchWorkspace(id) {
  for (const listener of listeners.filter((l) => l.type === "change"))
    listener.fn({ target: { id: "workspace-switcher", value: id, dataset: {} } });
}
function createWorkspace(name, host = "ANON-PC", branch = "main") {
  action("workspaceNew:seicho");
  workspaceField("name", name);
  workspaceField("host", host);
  workspaceField("branch", branch);
  action("workspaceSave");
  return st.currentLayoutKey;
}
function workspaceForTest(id) {
  return st.projects.flatMap((p) => p.workspaces).find((w) => w.id === id);
}
function workspaceBytes(id = st.currentLayoutKey) {
  const root = st.layouts[id];
  const tabs = leaves(root).flatMap((p) => p.tabs.map((tab) => st.tabsById[tab]));
  return JSON.stringify({ root, tabs });
}
function resizeSplit(root, key) {
  const handle = {
    dataset: { splitId: root.id },
    parentElement: { children: [{ style: {} }, {}, { style: {} }], querySelector: () => null },
  };
  pressKey(key, {
    target: {
      closest: (selector) => (selector === "[data-split-id]" ? handle : null),
      matches: () => false,
    },
  });
}

const scenarios = [
  {
    name: "S12 projectData workspaces have stable ids and layouts use workspace ids",
    setup: () => action("workspace:seicho"),
    run: () => {
      const project = st.projects.find((p) => p.id === "seicho");
      return (
        project.workspaces[0].id === "seicho-main" &&
        st.currentLayoutKey === project.workspaces[0].id &&
        st.layouts[project.workspaces[0].id].kind === "split" &&
        st.projects.every((p) => p.workspaces.length >= 1)
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 creating SEICHO workspace B preserves A byte for byte and adds the chosen record",
    setup: () => action("workspace:seicho"),
    run: () => {
      const a = st.currentLayoutKey,
        before = workspaceBytes(a);
      const b = createWorkspace("Ordlisten", "anon2", "ordliste");
      const records = st.projects.find((p) => p.id === "seicho").workspaces;
      const record = records.find((w) => w.id === b);
      return (
        records.length === 2 &&
        record.name === "Ordlisten" &&
        record.host === "anon2" &&
        record.branch === "ordliste" &&
        st.layouts[b].kind === "leaf" &&
        workspaceBytes(a) === before
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 split, tab selection, tab close and pane close in B preserve A exactly",
    setup: () => action("workspace:seicho"),
    run: () => {
      const a = st.currentLayoutKey,
        before = workspaceBytes(a);
      const b = createWorkspace("Ordlisten");
      const original = firstLeaf().id;
      action("paneSplit:right:" + original);
      const splitBuilt = leaves().length === 2;
      action("paneAdd:" + original + ":files");
      const files = activeTab().id;
      action("paneAdd:" + original + ":browser");
      const browser = activeTab().id;
      action(`paneSelect:${original}:${files}`);
      const selected = activeTab().id === files;
      action(`paneClose:${original}:${browser}`);
      const closedTab = firstLeaf().tabs.length === 2;
      const second = leaves()[1];
      action("paneRemove:" + second.id);
      const confirms = st.modal === "closeAgentPane";
      action("modalConfirm");
      return (
        splitBuilt &&
        selected &&
        closedTab &&
        confirms &&
        leaves().length === 1 &&
        st.currentLayoutKey === b &&
        workspaceBytes(a) === before
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 A to B to A restores panes, tabs, ratios and running sample state; B is untouched",
    setup: () => action("workspace:seicho"),
    run: () => {
      const a = st.currentLayoutKey;
      startSampleRun();
      const running = JSON.stringify({
        execution: st.execution,
        task: st.currentRunningTask,
        tasks: st.taskList,
      });
      resizeSplit(layoutRoot(), "ArrowRight");
      action("newTerminal:attached");
      activeTab().terminal.lines.push("Eksempel på pågående arbeid");
      const aBytes = workspaceBytes(a),
        history = JSON.stringify(st.sessionHistory);
      const b = createWorkspace("Ordlisten");
      action("paneSplit:down:" + firstLeaf().id);
      resizeSplit(layoutRoot(), "ArrowUp");
      action("paneAdd:" + firstLeaf().id + ":browser");
      const bBytes = workspaceBytes(b);
      switchWorkspace(a);
      const aRestored =
        workspaceBytes(a) === aBytes &&
        layoutRoot().ratio === 0.55 &&
        activeTab().terminal.lines[0] === "Eksempel på pågående arbeid";
      switchWorkspace(b);
      return (
        aRestored &&
        workspaceBytes(b) === bBytes &&
        JSON.stringify(st.sessionHistory) === history &&
        st.ratios[a + ":"] === 0.55 &&
        st.ratios[b + ":"] === 0.45 &&
        layoutRoot().ratio === 0.45 &&
        st.execution === "running" &&
        JSON.stringify({
          execution: st.execution,
          task: st.currentRunningTask,
          tasks: st.taskList,
        }) === running
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 workspace switcher renders the selected layout, not the other workspace",
    setup: () => action("workspace:seicho"),
    run: () => {
      const a = st.currentLayoutKey,
        aPane = firstLeaf().id;
      const b = createWorkspace("Ordlisten");
      action("paneSplit:right:" + firstLeaf().id);
      const bPane = leaves()[1].id;
      switchWorkspace(a);
      const aHTML = render();
      switchWorkspace(b);
      const bHTML = render();
      return (
        aHTML.includes(`data-workspace="${a}"`) &&
        aHTML.includes(`data-paneldrop="${aPane}"`) &&
        bHTML.includes(`data-workspace="${b}"`) &&
        bHTML.includes(`data-paneldrop="${bPane}"`) &&
        bHTML.includes(`value="${b}" selected`) &&
        aHTML.includes('id="workspace-switcher"')
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 modal validates required fields and host before adding a record",
    setup: () => action("modal:workspace"),
    run: () => {
      const count = st.projects.find((p) => p.id === "seicho").workspaces.length;
      action("workspaceSave");
      const required = render().includes('role="alert"') && st.modal === "workspace";
      workspaceField("name", "Ordlisten");
      workspaceField("branch", "ordliste");
      workspaceField("host", "annen maskin");
      action("workspaceSave");
      const invalidHost =
        st.workspaceError === "Fyll ut navn, maskin og navn på gren eller arbeidskopi." &&
        st.projects.find((p) => p.id === "seicho").workspaces.length === count;
      workspaceField("host", "anon3");
      action("workspaceSave");
      return (
        required &&
        invalidHost &&
        st.route === "workspace" &&
        st.projects.find((p) => p.id === "seicho").workspaces.length === count + 1 &&
        workspaceForTest(st.currentLayoutKey).host === "anon3"
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 duplicate names show an error, and a different name succeeds",
    setup: () => action("workspaceNew:seicho"),
    run: () => {
      workspaceField("name", " MAIN ");
      workspaceField("branch", "main");
      action("workspaceSave");
      const explained =
        st.workspaceError === "Velg et navn som ikke er brukt i prosjektet." &&
        render().includes('role="alert"');
      workspaceField("name", "Ordlisten");
      action("workspaceSave");
      return explained && workspaceForTest(st.currentLayoutKey).name === "Ordlisten";
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 modal fields survive full rendering and are escaped in the result",
    setup: () => action("workspaceNew:seicho"),
    run: () => {
      workspaceField("name", '<Ny & "to">');
      workspaceField("host", "anon2");
      workspaceField("branch", "gren & kopi");
      const form = render();
      action("workspaceSave");
      return (
        form.includes('value="&lt;Ny &amp; &quot;to&quot;&gt;"') &&
        form.includes('value="anon2" selected') &&
        workspaceForTest(st.currentLayoutKey).name === '<Ny & "to">' &&
        render().includes("gren &amp; kopi")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 all three entry points open the form and sidebar lists both records",
    setup: () => action("workspace:seicho"),
    run: () => {
      const a = st.currentLayoutKey,
        b = createWorkspace("Ordlisten");
      action("project:seicho");
      const projectHTML = render();
      const buttons = [...projectHTML.matchAll(/data-action="workspaceNew:seicho"/g)].length;
      action("workspaceNew:seicho");
      const form = render().includes('aria-label="Nytt arbeidsområde"');
      action("modal:close");
      switchWorkspace(a);
      const workHTML = render();
      return (
        buttons === 2 &&
        form &&
        [...workHTML.matchAll(/data-action="workspaceNew:seicho"/g)].length === 2 &&
        workHTML.includes(`data-action="workspaceSwitch:${a}"`) &&
        workHTML.includes(`data-action="workspaceSwitch:${b}"`)
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 project expander lists multiple workspaces outside the focus card too",
    setup: () => action("workspace:seicho"),
    run: () => {
      const a = st.currentLayoutKey,
        b = createWorkspace("Ordlisten");
      action("focus:shiori");
      const out = render();
      return (
        out.includes(`data-action="workspaceSwitch:${a}"`) &&
        out.includes(`data-action="workspaceSwitch:${b}"`) &&
        out.includes('data-action="workspaceNew:seicho"')
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "S12 reopening session history returns to its own workspace",
    setup: () => action("workspace:seicho"),
    run: () => {
      const a = st.currentLayoutKey;
      const b = createWorkspace("Ordlisten", "anon2", "ordliste");
      action("newTerminal:attached");
      const terminal = activeTab();
      const bBytes = workspaceBytes(b);
      switchWorkspace(a);
      action("openSession:" + terminal.id);
      return (
        st.currentLayoutKey === b &&
        activeTab().id === terminal.id &&
        terminal.workspace === b &&
        terminal.project === "seicho" &&
        terminal.host === "anon2" &&
        terminal.terminal.host === "anon2" &&
        workspaceBytes(b) === bBytes
      );
    },
    expect: (ok) => ok === true,
  },

  {
    name: "onFinish names its parent from the run record and lists its target separately",
    setup: resetFinishSample,
    run: () => {
      const parent = st.taskRuns.find((r) => r.id === "RUN-TASK-24");
      action("schedules");
      const before = scheduleRow(render(), "schedule-3");
      parent.name = "Nytt navn på kjøringen";
      const after = scheduleRow(render(), "schedule-3");
      return (
        before.includes(`Når Kjøring · ${parent.id} · Arbeid med ordlisten er ferdig`) &&
        after.includes(`Når Kjøring · ${parent.id} · ${parent.name} er ferdig`) &&
        after.includes(`Oppgave · ${api.task("TASK-21").name}`) &&
        after.includes("Venter på at kjøringen blir ferdig.")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "finishing a parent appends exactly one sample outcome only to its matching schedule, visible in row and sidebar",
    setup: resetFinishSample,
    run: () => {
      const s = st.schedules.find((record) => record.id === "schedule-3");
      const histories = st.schedules.map((record) => JSON.stringify(record.lastRuns));
      // Make another task run through its own surface so the parent selector can use it.
      api.task("TASK-21").status = "ready";
      action("task:TASK-21");
      action("authorizeRun");
      action("finishRun");
      action("scheduleNew");
      action("scheduleField:name:En annen kjøring");
      action("scheduleTarget:task:TASK-24");
      action("scheduleField:mode:onFinish");
      action("scheduleField:parentRef:RUN-TASK-21");
      action("scheduleSave");
      const other = st.schedules[st.schedules.length - 1];
      const otherHistory = JSON.stringify(other.lastRuns);
      startSampleRun();
      action("finishRun");
      action("schedules");
      const row = scheduleRow(render(), s.id);
      const otherRow = scheduleRow(render(), other.id);
      const result = s.lastRuns[0];
      const unchanged = st.schedules
        .slice(0, histories.length)
        .every(
          (record, i) => record.id === s.id || JSON.stringify(record.lastRuns) === histories[i],
        );
      action("workspace:seicho");
      action("inspect:shioriHome");
      const sidebar = scheduleStripMarkup(render());
      action("finishRun");
      return (
        s.lastRuns.length === 1 &&
        unchanged &&
        other.trigger.parentRef === "RUN-TASK-21" &&
        JSON.stringify(other.lastRuns) === otherHistory &&
        otherRow.includes("Kjøringen var allerede ferdig da tidsplanen ble lagt til.") &&
        result.at === "man 19. okt. 09:22" &&
        result.outcome.includes("ingenting kjørte") &&
        scheduleList(row, "schedule-history")[0] === `${result.at} · ${result.outcome}` &&
        row.includes("Ferdig registrert én gang") &&
        sidebar.includes("Ferdig registrert én gang") &&
        st.toast.includes("allerede ferdig. Resultatet legges ikke til på nytt.")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "paused onFinish acknowledges completion without recording it and resume retains the explicit skipped result",
    setup: resetFinishSample,
    run: () => {
      const s = st.schedules.find((record) => record.id === "schedule-3");
      const before = JSON.stringify(s.lastRuns);
      action(`scheduleToggle:${s.id}`);
      startSampleRun();
      action("finishRun");
      action("schedules");
      const paused = scheduleRow(render(), s.id);
      action("workspace:seicho");
      action("inspect:shioriHome");
      const sidebar = scheduleStripMarkup(render());
      action(`scheduleToggle:${s.id}`);
      action("schedules");
      const resumed = scheduleRow(render(), s.id);
      return (
        st.taskRuns.find((r) => r.id === s.trigger.parentRef).completed === true &&
        api.task("TASK-24").status === "done" &&
        JSON.stringify(s.lastRuns) === before &&
        paused.includes('aria-checked="false"') &&
        paused.includes("Resultatet ble ikke lagt til.") &&
        sidebar.includes("Resultatet ble ikke lagt til.") &&
        s.enabled === true &&
        resumed.includes('aria-checked="true"') &&
        resumed.includes("Det legges heller ikke til når du fortsetter.")
      );
    },
    expect: (ok) => ok === true,
  },
  ...["existing", "new"].map((destination) => ({
    name: `run surface adds a live run pointer to a ${destination} schedule and follows a later record edit`,
    setup: resetFinishSample,
    run: () => {
      startSampleRun();
      action("task:TASK-24");
      const out = render();
      const parent = st.taskRuns.find((r) => r.id === "RUN-TASK-24");
      if (!inspectorMarkup(out).includes(`data-action="scheduleAdd:run:${parent.id}"`))
        throw new Error("task run surface has no schedule entry");
      action(`scheduleAdd:run:${parent.id}`);
      const chooser = render();
      if (
        !chooser.includes('data-action="scheduleCreate"') ||
        !chooser.includes('data-action="scheduleAttach:schedule-2"')
      )
        throw new Error("chooser must offer both existing and new schedules");
      let s;
      if (destination === "existing") {
        action("scheduleAttach:schedule-2");
        s = st.schedules.find((record) => record.id === "schedule-2");
      } else {
        action("scheduleCreate");
        action("scheduleField:name:Fra kjøringen");
        action("scheduleField:mode:onFinish");
        action("scheduleSave");
        s = st.schedules[st.schedules.length - 1];
      }
      parent.name = "Endret kjøring etter at den ble lagt til";
      action("schedules");
      const target = s.targets.find((t) => t.kind === "run" && t.ref === parent.id);
      return (
        JSON.stringify(Object.keys(target).sort()) === JSON.stringify(["kind", "ref"]) &&
        scheduleRow(render(), s.id).includes(`Kjøring · ${parent.id} · ${parent.name}`) &&
        s.targets.filter((t) => t.kind === "run" && t.ref === parent.id).length === 1
      );
    },
    expect: (ok) => ok === true,
  })),
  ...["sequence", "task", "run"].flatMap((kind) =>
    ["existing", "new"].map((destination) => ({
      name: `${kind} work surface offers a ${destination} schedule with a live reference`,
      setup: resetFinishSample,
      run: () => {
        let record, ref;
        if (kind === "sequence") {
          action("sequenceNew");
          record = seqOf(st.selectedSequence);
          ref = record.id;
        } else if (kind === "task") {
          action("task:TASK-24");
          record = api.task("TASK-24");
          ref = record.id;
        } else {
          action("project:seicho");
          action("section:runs");
          ref = "RUN-S21";
        }
        if (!render().includes(`data-action="scheduleAdd:${kind}:${ref}"`))
          throw new Error("work surface has no schedule entry");
        action(`scheduleAdd:${kind}:${ref}`);
        let s;
        if (destination === "existing") {
          action("scheduleAttach:schedule-2");
          s = st.schedules.find((schedule) => schedule.id === "schedule-2");
        } else {
          action("scheduleCreate");
          action("scheduleField:name:Fra arbeidet");
          action("scheduleSave");
          s = st.schedules[st.schedules.length - 1];
        }
        const target = s.targets.find((t) => t.kind === kind && t.ref === ref);
        action("schedules");
        if (record) {
          const oldName = record.name;
          record.name = "Endret etter at tidsplanen ble laget";
          const follows = scheduleRow(render(), s.id).includes(record.name);
          record.name = oldName;
          if (!follows) throw new Error("schedule copied the work instead of referencing it");
        }
        return (
          JSON.stringify(target) === JSON.stringify({ kind, ref }) &&
          scheduleRow(render(), s.id).includes(`data-schedule-target="${kind}:${ref}"`) &&
          s.targets.filter((t) => t.kind === kind && t.ref === ref).length === 1
        );
      },
      expect: (ok) => ok === true,
    })),
  ),
  {
    name: "onFinish form, linking, pause, resume and completion paths all work with a throwing Date",
    setup: resetFinishSample,
    run: () => {
      const realDate = sandbox.Date;
      sandbox.Date = class {
        constructor() {
          throw new Error("onFinish consulted the clock");
        }
        static now() {
          throw new Error("onFinish consulted the clock");
        }
      };
      try {
        startSampleRun();
        action("scheduleAdd:run:RUN-TASK-24");
        action("scheduleAttach:schedule-2");
        action("sequenceNew");
        action(`scheduleAdd:sequence:${st.selectedSequence}`);
        action("scheduleCreate");
        action("scheduleField:name:Etter kjøringen uten klokke");
        action("scheduleField:mode:onFinish");
        action("scheduleField:parentRef:RUN-TASK-24");
        const form = render();
        action("scheduleSave");
        const s = st.schedules[st.schedules.length - 1];
        action(`scheduleToggle:${s.id}`);
        action(`scheduleToggle:${s.id}`);
        action("scheduleToggle:schedule-3");
        action("finishRun");
        action("scheduleToggle:schedule-3");
        action("finishRun");
        action("schedules");
        const row = scheduleRow(render(), s.id);
        action("workspace:seicho");
        action("inspect:shioriHome");
        const paused = st.schedules.find((schedule) => schedule.id === "schedule-3");
        return (
          form.includes('id="schedule-parent"') &&
          s.trigger.mode === "onFinish" &&
          s.lastRuns.length === 1 &&
          paused.lastRuns.length === 0 &&
          paused.finishNote.includes("mens tidsplanen var på pause") &&
          row.includes("Ferdig registrert én gang") &&
          scheduleStripMarkup(render()).includes("Ferdig registrert én gang")
        );
      } finally {
        sandbox.Date = realDate;
      }
    },
    expect: (ok) => ok === true,
  },
  {
    name: "sequence task completion uses the same onFinish record as the task surface",
    setup: resetFinishSample,
    run: () => {
      const id = sequenceFromBoard();
      action(`sequenceStart:${id}`);
      action(`sequenceRun:${id}`); // TASK-20 was already done.
      action(`sequenceRun:${id}`); // TASK-24 starts the sample run.
      action("finishRun");
      const s = st.schedules.find((record) => record.id === "schedule-3");
      action("schedules");
      return (
        seqOf(id).steps.find((step) => step.ref === "TASK-24").status === "done" &&
        s.lastRuns.length === 1 &&
        scheduleRow(render(), s.id).includes("Ferdig registrert én gang")
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "schedule controls work without a clock and preserve execution, tasks and sequence state",
    setup: () => action("schedules"),
    run: () => {
      const workState = () =>
        JSON.stringify({
          execution: st.execution,
          runName: st.runName,
          currentRunningTask: st.currentRunningTask,
          tasks: st.taskList,
          sequences: st.sequences,
          agents: st.agentState,
        });
      const before = workState();
      const realDate = sandbox.Date;
      sandbox.Date = class {
        constructor() {
          throw new Error("schedule consulted the clock");
        }
        static now() {
          throw new Error("schedule consulted the clock");
        }
      };
      try {
        action("scheduleToggle:schedule-1");
        action("scheduleToggle:schedule-1");
        action("scheduleNew");
        action("scheduleField:name:Uten klokke");
        action("scheduleTarget:run:RUN-S21");
        action("scheduleSave");
        render();
        return (
          workState() === before && st.schedules[st.schedules.length - 1].name === "Uten klokke"
        );
      } finally {
        sandbox.Date = realDate;
      }
    },
    expect: (ok) => ok === true,
  },
  {
    name: "weekday schedule holds two run pointers and a solo task, with three sample times and outcomes",
    setup: () => action("schedules"),
    run: () => {
      const s = st.schedules.find((record) => record.id === "schedule-1");
      const row = scheduleRow(render(), s.id);
      const targets = [...row.matchAll(/data-schedule-target="([^"]+)"/g)].map((m) => m[1]);
      const expected = s.targets.map((t) => `${t.kind}:${t.ref}`);
      // The row names each target by the record behind it, not by a bare id.
      const taskName = st.taskList.find((t) => t.id === "TASK-24")?.name;
      return (
        s.trigger.mode === "weekdays" &&
        s.trigger.days.length === 3 &&
        s.targets.filter((t) => t.kind === "run").length === 2 &&
        s.targets.filter((t) => t.kind === "task").length === 1 &&
        JSON.stringify(targets) === JSON.stringify(expected) &&
        row.includes(`Oppgave · ${taskName}`) &&
        JSON.stringify(scheduleList(row, "schedule-next")) === JSON.stringify(s.nextFires) &&
        JSON.stringify(scheduleList(row, "schedule-history")) ===
          JSON.stringify(s.lastRuns.map((r) => `${r.at} · ${r.outcome}`))
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "pause and resume change the flag and the isolated workspace sidebar, preserving sample records",
    setup: () => action("schedules"),
    run: () => {
      const s = st.schedules[0];
      const before = JSON.stringify({ ...s, enabled: true });
      action(`scheduleToggle:${s.id}`);
      const pausedRow = scheduleRow(render(), s.id);
      action("workspace:seicho");
      action("inspect:shioriHome");
      const pausedStrip = scheduleStripMarkup(render());
      if (
        s.enabled !== false ||
        !pausedRow.includes('aria-checked="false"') ||
        !pausedStrip.includes(`data-schedule-status="${s.id}">${s.name} · På pause`)
      )
        throw new Error("paused flag, switch and sidebar disagree");
      action(`scheduleToggle:${s.id}`);
      const activeStrip = scheduleStripMarkup(render());
      action("schedules");
      return (
        s.enabled === true &&
        scheduleRow(render(), s.id).includes('aria-checked="true"') &&
        activeStrip.includes(`data-schedule-status="${s.id}">${s.name} · Aktiv`) &&
        JSON.stringify(s) === before
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "New schedule form saves a named mixed-target weekday row, including the chosen time and days",
    setup: () => action("schedules"),
    run: () => {
      const count = st.schedules.length;
      action("scheduleNew");
      if (st.modal !== "schedule" || !render().includes('id="schedule-name"'))
        throw new Error("new schedule did not open its form");
      action("scheduleField:name:  Morgenarbeid  ");
      action("scheduleTarget:run:RUN-S21");
      action("scheduleTarget:run:implementer");
      action("scheduleTarget:task:TASK-24");
      action("scheduleField:mode:weekdays");
      action("scheduleField:at:08:30");
      action("scheduleDay:onsdag");
      action("scheduleDay:fredag");
      action("scheduleDay:mandag");
      action("scheduleSave");
      const s = st.schedules[st.schedules.length - 1];
      const row = scheduleRow(render(), s.id);
      return (
        st.schedules.length === count + 1 &&
        s.name === "Morgenarbeid" &&
        s.enabled === true &&
        JSON.stringify(s.targets) ===
          JSON.stringify([
            { kind: "run", ref: "RUN-S21" },
            { kind: "run", ref: "implementer" },
            { kind: "task", ref: "TASK-24" },
          ]) &&
        JSON.stringify(s.trigger) ===
          JSON.stringify({ mode: "weekdays", at: "08:30", days: ["onsdag", "fredag"] }) &&
        row.includes(s.name) &&
        row.includes("08:30") &&
        scheduleList(row, "schedule-next").length === 3 &&
        scheduleList(row, "schedule-history").length === 3
      );
    },
    expect: (ok) => ok === true,
  },
  ...["time", "cadence"].map((mode) => ({
    name: `New schedule form saves a solo task with a ${mode} trigger`,
    setup: () => action("schedules"),
    run: () => {
      action("scheduleNew");
      action("scheduleField:name:Ordlisten");
      action("scheduleTarget:task:TASK-24");
      action(`scheduleField:mode:${mode}`);
      action(
        mode === "time" ? "scheduleField:at:tir 20. okt. 09:00" : "scheduleField:every:8 timer",
      );
      action("scheduleSave");
      const s = st.schedules[st.schedules.length - 1];
      return (
        s.trigger.mode === mode &&
        s.targets.length === 1 &&
        s.trigger[mode === "time" ? "at" : "every"] ===
          (mode === "time" ? "tir 20. okt. 09:00" : "8 timer") &&
        scheduleRow(render(), s.id).includes(mode === "time" ? "tir 20. okt. 09:00" : "8 timer")
      );
    },
    expect: (ok) => ok === true,
  })),
  {
    name: "invalid schedule form shows an error, retains typed input through renders, and accepts a correction",
    setup: () => action("schedules"),
    run: () => {
      action("scheduleNew");
      action("scheduleField:name:Behold dette navnet");
      action("scheduleSave");
      const out = render();
      if (
        st.modal !== "schedule" ||
        !st.scheduleError ||
        !out.includes('role="alert"') ||
        !out.includes('value="Behold dette navnet"')
      )
        throw new Error("form lost its input or validation error");
      action("scheduleTarget:task:TASK-24");
      render();
      if (st.scheduleDraft.name !== "Behold dette navnet")
        throw new Error("target selection lost the name");
      action("scheduleSave");
      const s = st.schedules[st.schedules.length - 1];
      return s.name === "Behold dette navnet" && scheduleRow(render(), s.id).includes(s.name);
    },
    expect: (ok) => ok === true,
  },
  {
    name: "scheduled sequence steps are live references, following reordered and added steps on its record",
    setup: () => action("schedules"),
    run: () => {
      action("sequenceFromQueue");
      const seq = st.sequences[st.sequences.length - 1];
      action("schedules");
      action("scheduleNew");
      action("scheduleField:name:Oppgavene i rekkefølge");
      action(`scheduleTarget:sequence:${seq.id}`);
      action("scheduleSave");
      const s = st.schedules[st.schedules.length - 1];
      const order = () =>
        [...scheduleRow(render(), s.id).matchAll(/data-step-ref="([^"]+)"/g)].map((m) => m[1]);
      if (JSON.stringify(order()) !== JSON.stringify(seq.steps.map((step) => step.ref)))
        throw new Error("initial sequence order differs");
      action(`seqMove:${seq.id}:0:down`);
      seq.steps.push({ kind: "task", ref: "TASK-24", gate: "auto", status: "pending" });
      seq.steps[0].ref = "TASK-25";
      seq.name = "Endret rekkefølge";
      action("schedules");
      return (
        JSON.stringify(order()) === JSON.stringify(seq.steps.map((step) => step.ref)) &&
        scheduleRow(render(), s.id).includes(seq.name) &&
        JSON.stringify(s.targets) === JSON.stringify([{ kind: "sequence", ref: seq.id }])
      );
    },
    expect: (ok) => ok === true,
  },
  {
    name: "schedule rows and their sidebar explain in Norwegian that times and results are examples and nothing runs",
    setup: () => action("schedules"),
    run: () => {
      for (const s of st.schedules) {
        const row = scheduleRow(render(), s.id);
        if (
          !row.includes("Dette er et eksempel. Ingenting kjøres.") ||
          !row.includes("Neste tre tidspunkter (eksempler)") ||
          !row.includes("Siste tre resultater (eksempler)")
        )
          throw new Error("row implies real execution");
      }
      action("workspace:seicho");
      action("inspect:shioriHome");
      return scheduleStripMarkup(render()).includes("Bare eksempler. Ingenting kjøres.");
    },
    expect: (ok) => ok === true,
  },

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
  // --- slice S11a: one run made of runs and tasks that already exist. Every check below
  // follows a step to the record it points at, because a copy would be the bug.
  {
    name: "the plan board puts its tasks in a sequence in the order the board shows them",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:plan");
    },
    run: () => {
      const id = sequenceFromBoard();
      const seq = seqOf(id);
      const wanted = st.taskOrder;
      const got = seq.steps.map((s) => s.ref);
      if (got.join(",") !== wanted.join(","))
        throw new Error(`steps are ${got.join(", ")}, the board shows ${wanted.join(", ")}`);
      // Each step points at a task record; none of them is a copy of one.
      if (seq.steps.some((s) => s.kind !== "task" || !api.task(s.ref)))
        throw new Error("a step does not point at a task record");
      if (seq.status !== "not_started") throw new Error("making the sequence started it");
      if (st.currentRunningTask) throw new Error("making the sequence started a run");
      const out = render();
      const absent = wanted.filter((ref) => !out.includes(ref));
      if (absent.length) throw new Error(`steps missing from the page: ${absent.join(", ")}`);
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "sequence steps move with the same up and down controls the task queue uses",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:plan");
    },
    run: () => {
      const id = sequenceFromBoard();
      const order = () =>
        seqOf(id)
          .steps.map((s) => s.ref)
          .join(",");
      const before = order();
      const out = render();
      const moves = [...out.matchAll(/data-action="seqMove:/g)].length;
      if (moves !== 2 * seqOf(id).steps.length)
        throw new Error(`${moves} move controls for ${seqOf(id).steps.length} steps`);
      action(`seqMove:${id}:1:down`);
      if (order() === before) throw new Error("the order did not change");
      action(`seqMove:${id}:2:up`);
      if (order() !== before) throw new Error("moving it back did not restore the order");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a sequence takes one step at a time and never starts the next one by itself",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:plan");
    },
    run: () => {
      const id = sequenceFromBoard();
      const seq = seqOf(id);
      action(`sequenceStart:${id}`);
      if (runningSteps(seq).length) throw new Error("starting the sequence started a step");
      // Step 1 is TASK-20, finished before the sequence existed: taking it runs nothing.
      action(`sequenceRun:${id}`);
      if (seq.steps[0].status !== "done")
        throw new Error("the finished task did not settle step 1");
      if (st.currentRunningTask) throw new Error("taking a finished step started a run");
      action(`sequenceRun:${id}`);
      if (runningSteps(seq).length !== 1) throw new Error("more than one step is running");
      if (api.task("TASK-24").status !== "running")
        throw new Error("step 2 did not start its task");
      // The sample run finishes through the same control the task page uses, and the
      // sequence only points at the next step.
      action("finishRun");
      if (seq.steps[1].status !== "done") throw new Error("the finished run did not settle step 2");
      if (runningSteps(seq).length) throw new Error("the sequence started the next step itself");
      if (api.task("TASK-21").status === "running") throw new Error("the next step started itself");
      const out = render();
      if (!out.includes("Step 3 of 5 is next."))
        throw new Error("the page does not name the next step");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a step that cannot be taken is handled by the policy you chose, and the page says so",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:plan");
    },
    run: () => {
      // Walk to the step that cannot be taken: TASK-21 is in review, and that decision is
      // yours. Each sequence gets there through the same clicks.
      const toBlockedStep = (id) => {
        action(`sequenceStart:${id}`);
        action(`sequenceRun:${id}`);
        action(`sequenceRun:${id}`);
        if (runningSteps(seqOf(id)).length) action("finishRun");
        action(`sequenceRun:${id}`);
      };
      const stop = sequenceFromBoard();
      toBlockedStep(stop);
      const s1 = seqOf(stop);
      if (s1.status !== "stopped" || s1.steps[2].status !== "blocked")
        throw new Error(`Stop policy left ${s1.status}/${s1.steps[2].status}`);
      if (s1.steps.slice(3).some((s) => s.status !== "pending"))
        throw new Error("steps after a stopped step were started");
      if (!render().includes("is in review"))
        throw new Error("the page does not say why it stopped");
      const go = sequenceFromBoard();
      action(`sequencePolicy:${go}:continue`);
      toBlockedStep(go);
      const s2 = seqOf(go);
      if (s2.steps[2].status !== "skipped")
        throw new Error("Keep going did not pass the step over");
      if (s2.status !== "running") throw new Error(`Keep going left the sequence ${s2.status}`);
      if (!render().includes("You chose to keep going"))
        throw new Error("the passed-over step does not say it was your policy");
      const ask = sequenceFromBoard();
      action(`sequencePolicy:${ask}:ask`);
      toBlockedStep(ask);
      const s3 = seqOf(ask);
      if (s3.steps[2].status !== "ask" || s3.status !== "waiting")
        throw new Error(`Ask me each time left ${s3.status}/${s3.steps[2].status}`);
      const askPage = render();
      if (
        !askPage.includes("Skip this step and keep going") ||
        !askPage.includes("Stop the sequence")
      )
        throw new Error("the choice is not on the page");
      action(`sequenceSkip:${ask}:2`);
      if (s3.steps[2].status !== "skipped") throw new Error("skipping the step did nothing");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a blocked step offers the record that unblocks it, not a retry that repeats the answer",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:plan");
    },
    run: () => {
      const id = sequenceFromBoard();
      action(`sequenceStart:${id}`);
      action(`sequenceRun:${id}`);
      action(`sequenceRun:${id}`);
      action("finishRun");
      action(`sequenceRun:${id}`);
      const out = render();
      if (out.includes("sequenceRetry:")) throw new Error("a retry control is offered");
      if (!out.includes('data-action="review:qa"'))
        throw new Error("the blocked step does not lead to the review that blocks it");
      // The step is not offered as runnable while it cannot be taken.
      if (out.includes(`data-action="sequenceRun:${id}"`))
        throw new Error("a blocked step is offered as runnable");
      // Decide the review on the record itself, and the old block goes away: the step is
      // offered again instead of repeating a reason that no longer holds.
      action("review:qa");
      action("approveQA");
      const seq = seqOf(id);
      if (seq.steps[2].status !== "pending")
        throw new Error(`the step is ${seq.steps[2].status} after the review was decided`);
      if (seq.status !== "running") throw new Error(`the sequence is ${seq.status}`);
      if (!render().includes(`data-action="sequenceRun:${id}"`))
        throw new Error("the step is not offered again once it can be taken");
      action(`sequenceRun:${id}`);
      if (seq.steps[2].status !== "done")
        throw new Error("the approved task did not settle step 3");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "an approval step waits for you, and approving it is what finishes the sequence",
    setup: () => {
      resetSampleTasks();
      action("schedules");
    },
    run: () => {
      action("sequenceNew");
      const seq = st.sequences[st.sequences.length - 1];
      const id = seq.id;
      action(`sequencePolicy:${id}:continue`);
      action(`sequenceStart:${id}`);
      action(`sequenceRun:${id}`);
      if (runningSteps(seq).length) action("finishRun");
      action(`sequenceRun:${id}`);
      action(`sequenceRun:${id}`);
      action(`sequenceRun:${id}`);
      if (seq.steps[3].status !== "approval")
        throw new Error(`the review step is ${seq.steps[3].status}, not waiting for approval`);
      if (seq.status !== "waiting") throw new Error(`the sequence is ${seq.status}`);
      if (!render().includes("waits for your approval"))
        throw new Error("the page does not say the step is waiting for you");
      if (runningSteps(seq).length) throw new Error("a step was left running");
      action(`sequenceApprove:${id}:3`);
      if (seq.steps[3].status !== "done")
        throw new Error("approving did not settle the prompt step");
      if (seq.status !== "finished") throw new Error(`the sequence is ${seq.status}`);
      if (!render().includes("Every step is settled."))
        throw new Error("the page does not say it is done");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the Runs page adds its sample run to a sequence without making a second run",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:runs");
    },
    run: () => {
      if (!render().includes("sequenceAddRun:RUN-S21"))
        throw new Error("the Runs page has no way to put its run in a sequence");
      action("sequenceAddRun:RUN-S21");
      const seq = st.sequences[st.sequences.length - 1];
      const step = seq.steps[seq.steps.length - 1];
      if (step.kind !== "run" || step.ref !== "RUN-S21")
        throw new Error("the new step is not a pointer at RUN-S21");
      const out = render();
      if (!out.includes("Run from the Runs page"))
        throw new Error("the step does not say where it comes from");
      if (!out.includes("it does not start a second run"))
        throw new Error("the page does not say the run is followed, not copied");
      if (st.sequences.filter((s) => s.id === seq.id).length !== 1)
        throw new Error("adding the run made a second sequence");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the schedules page can make a sequence and shows the order it will run in",
    setup: () => {
      resetSampleTasks();
      action("schedules");
    },
    run: () => {
      if (!render().includes("sequenceNew"))
        throw new Error("the schedules page has no way to make a sequence");
      action("sequenceNew");
      const seq = st.sequences[st.sequences.length - 1];
      const chain = render().match(/<div class="seq-preview">([\s\S]*?)<\/div>/);
      if (!chain) throw new Error("the page does not show the order");
      const names = [...chain[1].matchAll(/<span>([^<]*)<\/span>/g)].map((m) => m[1]);
      const wanted = ["TASK-24", "TASK-21", "TASK-22", "review step"];
      if (names.join(" > ") !== wanted.join(" > "))
        throw new Error(`the order reads ${names.join(" > ")}, not ${wanted.join(" > ")}`);
      if (seq.steps.length !== 4) throw new Error(`${seq.steps.length} steps`);
      if (seq.steps[3].gate !== "approval")
        throw new Error("the review step is not an approval step");
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "the workspace sidebar strip says which step the sequence is on, and opens it",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:plan");
    },
    run: () => {
      const id = sequenceFromBoard();
      action("workspace");
      action("inspect:shioriHome");
      if (render().includes('class="seq-strip"'))
        throw new Error("a sequence that was never started is in the sidebar");
      action(`sequenceStart:${id}`);
      action(`sequenceRun:${id}`);
      const strip = stripMarkup(render());
      const m = strip.match(/step (\d+) of (\d+)/);
      if (!m) throw new Error("the strip does not say which step it is on");
      if (m[1] !== "2" || Number(m[2]) !== seqOf(id).steps.length)
        throw new Error(`the strip reads step ${m[1]} of ${m[2]}`);
      if (strip.includes("display:none"))
        throw new Error("the strip is hidden with an inline style");
      action(`sequenceOpen:${id}`);
      if (st.route !== "project" || st.section !== "sequences")
        throw new Error(`the strip landed on ${st.route}/${st.section}`);
      return true;
    },
    expect: (ok) => ok === true,
  },
  {
    name: "a sequence never claims a run of its own",
    setup: () => {
      resetSampleTasks();
      action("project:seicho");
      action("section:plan");
    },
    run: () => {
      const id = sequenceFromBoard();
      action(`sequenceStart:${id}`);
      action(`sequenceRun:${id}`);
      action(`sequenceRun:${id}`);
      const out = render();
      const plain = out.replace(/<[^>]+>/g, " ");
      if (!plain.includes("Nothing runs until you start a step."))
        throw new Error("the page does not say it runs nothing by itself");
      if (!plain.includes("No real execution."))
        throw new Error("starting a step does not say the run is a sample");
      if (!plain.includes("Running (sample)"))
        throw new Error("the running state is not labelled as sample");
      if (!plain.includes("It is a list, not a runner."))
        throw new Error("the page does not say what a sequence is not");
      return true;
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
