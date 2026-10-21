#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isMainModule } from "./is-main-module.mjs";

const HELP_TEXT = `Usage: node scripts/compat-triage.mjs [options]

Audit COMPAT(<name>) markers, the repo's convention for dated compatibility shims:

  // COMPAT(<name>): added 2026-06-11, remove after 2026-12-11.

A marker is dated when its comment block carries a removal verb
(remove, drop, retire, delete, deprecate) and a YYYY-MM-DD date. The last date
in the block is the removal date, so "added <date>, remove after <date>" reads
correctly. A marker with no date is accepted by the convention only when the
block names a condition ("remove once daemon floor >= v0.3.0"); the report
separates those from markers with no trigger at all.

  --check              CI mode: summary only, exit 1 when over the budgets.
  --max-undated=N      Allowed undated markers (report mode: no limit).
  --max-overdue=N      Allowed markers past their removal date (report mode: no limit).
  --due-within=days    Upcoming removals to list in report mode (default 45).
  --archaeology        Date undated markers with git log -S and propose a removal
                       date 183 days after the commit that introduced them.
  -h, --help           Show this help.

Report mode is for a human; --check is the ratchet that keeps new shims dated.`;

const CODE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const MARKER = /COMPAT\(([A-Za-z0-9_.:-]+)\)/;
const DATE = /\d{4}-\d{2}-\d{2}/g;
const REMOVAL_VERB =
  /\b(remove|removed|removes|remove gate|drop|dropped|retire|deleted?|deprecat\w*)\b/i;
// The convention allows an undated shim when it names a version condition, so
// the report separates those from markers with no removal trigger at all.
const CONDITION = /floor >= v?\d|once (?:daemon|client|app|all) floor|remove once|when the floor/i;
const SKIPPED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".expo",
  ".next",
  "android",
  "ios",
]);
const SUGGESTED_TTL_DAYS = 183;

const NO_LIMIT = Number.MAX_SAFE_INTEGER;
const FLAG_TO_OPTION = new Map([
  ["--max-undated", "maxUndated"],
  ["--max-overdue", "maxOverdue"],
  ["--due-within", "dueWithinDays"],
]);

function parseArgs(argv) {
  const options = {
    check: false,
    maxUndated: NO_LIMIT,
    maxOverdue: NO_LIMIT,
    dueWithinDays: 45,
    archaeology: false,
  };

  for (const arg of argv) {
    if (arg === "--check") options.check = true;
    else if (arg === "--archaeology") options.archaeology = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    } else if (arg.startsWith("--")) {
      const [flag, rawValue] = arg.split("=");
      const key = FLAG_TO_OPTION.get(flag);
      if (!key) throw new Error(`Unknown argument: ${arg}\n\n${HELP_TEXT}`);
      if (!/^-?\d+$/.test(rawValue ?? "")) throw new Error(`${flag} needs an integer`);
      options[key] = Number(rawValue);
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${HELP_TEXT}`);
    }
  }

  for (const key of ["maxUndated", "maxOverdue", "dueWithinDays"]) {
    if (!Number.isInteger(options[key]) || options[key] < 0) {
      throw new Error(
        `${[...FLAG_TO_OPTION].find(([, value]) => value === key)?.[0]} needs a non-negative integer`,
      );
    }
  }
  return options;
}

function isComment(line) {
  return /^\s*(?:\/\/|\*|\/\*)/.test(line);
}

function listSourceFiles(root) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  return tracked
    .split("\0")
    .filter(Boolean)
    .filter((file) => CODE_PATTERN.test(file))
    .filter((file) => !file.split("/").some((segment) => SKIPPED_SEGMENTS.has(segment)));
}

function collectMarkers(root, files) {
  const markers = [];

  for (const file of files) {
    let lines;
    try {
      lines = readFileSync(path.join(root, file), "utf8").split("\n");
    } catch {
      continue;
    }

    for (let i = 0; i < lines.length; i += 1) {
      const match = MARKER.exec(lines[i]);
      if (!match) continue;

      let start = i;
      while (start > 0 && isComment(lines[start - 1])) start -= 1;
      let end = i;
      while (end + 1 < lines.length && isComment(lines[end + 1])) end += 1;
      const block = lines.slice(start, end + 1).join(" ");
      const dates = block.match(DATE) ?? [];
      const removeAfter =
        REMOVAL_VERB.test(block) && dates.length > 0 ? dates[dates.length - 1] : null;

      markers.push({
        name: match[1],
        file,
        line: i + 1,
        removeAfter,
        condition: CONDITION.test(block),
      });
    }
  }

  return markers;
}

function groupByName(markers) {
  const groups = new Map();

  for (const marker of markers) {
    const group = groups.get(marker.name) ?? {
      name: marker.name,
      sites: [],
      removeAfter: null,
      condition: false,
    };
    group.sites.push(marker);
    group.condition ||= marker.condition;
    if (marker.removeAfter && (!group.removeAfter || marker.removeAfter > group.removeAfter)) {
      group.removeAfter = marker.removeAfter;
    }
    groups.set(marker.name, group);
  }

  return [...groups.values()];
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Oldest commit whose diff introduced the marker name, used only to propose a
// removal date for shims that never recorded one.
function introducedOn(root, group) {
  const dates = [];

  for (const site of group.sites) {
    try {
      const out = execFileSync(
        "git",
        ["log", "--format=%as", "--reverse", "-S", `COMPAT(${group.name})`, "--", site.file],
        { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
      );
      const first = out.trim().split("\n")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(first)) dates.push(first);
    } catch {
      // Shallow clones and missing history simply leave the marker undated.
    }
  }

  return dates.length > 0 ? dates.sort()[0] : null;
}

function formatGroup(group) {
  const files = [...new Set(group.sites.map((site) => `${site.file}:${site.line}`))];
  return [
    `  ${group.name}  ${group.sites.length} site(s)`,
    ...files.map((site) => `    ${site}`),
  ].join("\n");
}

// CI output stays scannable: one line per shim, with the first site to open.
function formatBrief(group) {
  const first = group.sites[0];
  const rest = group.sites.length > 1 ? ` +${group.sites.length - 1} more` : "";
  return `  ${group.name}  ${first.file}:${first.line}${rest}`;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const root = path.resolve(import.meta.dirname, "..");
  const today = new Date().toISOString().slice(0, 10);
  const markers = collectMarkers(root, listSourceFiles(root));
  const groups = groupByName(markers);
  const undated = groups
    .filter((group) => !group.removeAfter)
    .sort((a, b) => b.sites.length - a.sites.length);
  const gated = undated.filter((group) => group.condition);
  const triggerless = undated.filter((group) => !group.condition);
  const dated = groups.filter((group) => group.removeAfter);
  const overdue = dated
    .filter((group) => group.removeAfter < today)
    .sort((a, b) => a.removeAfter.localeCompare(b.removeAfter));
  const dueSoon = dated
    .filter(
      (group) =>
        group.removeAfter >= today && group.removeAfter <= addDays(today, options.dueWithinDays),
    )
    .sort((a, b) => a.removeAfter.localeCompare(b.removeAfter));
  const undatedSites = undated.reduce((total, group) => total + group.sites.length, 0);
  const overdueSites = overdue.reduce((total, group) => total + group.sites.length, 0);

  console.log(
    `COMPAT markers: ${markers.length} sites, ${groups.length} shims, ` +
      `${undated.length} undated (${undatedSites} sites), ${overdue.length} overdue (${overdueSites} sites)`,
  );

  if (options.check) {
    if (undated.length > options.maxUndated) {
      console.error(
        `\n${undated.length} undated shims exceed the budget of ${options.maxUndated}. ` +
          `Every COMPAT(<name>) needs "remove after YYYY-MM-DD":\n` +
          triggerless.map(formatBrief).join("\n"),
      );
      process.exitCode = 1;
    }
    if (overdue.length > options.maxOverdue) {
      console.error(
        `\n${overdue.length} shims are past their removal date, above the budget of ${options.maxOverdue}. ` +
          `Delete the shim, or extend the date with a reason:\n` +
          overdue
            .map((group) => `${formatBrief(group)}  (remove after ${group.removeAfter})`)
            .join("\n"),
      );
      process.exitCode = 1;
    }
    if (!process.exitCode)
      console.log(
        `Within budgets (max-undated=${options.maxUndated}, max-overdue=${options.maxOverdue}).`,
      );
    return;
  }

  if (overdue.length) {
    console.log(
      `\nOverdue — the removal date has passed:\n${overdue.map((g) => `${formatGroup(g)}\n    remove after ${g.removeAfter}`).join("\n")}`,
    );
  }
  if (dueSoon.length) {
    console.log(
      `\nDue within ${options.dueWithinDays} days:\n${dueSoon.map((g) => `  ${g.removeAfter}  ${g.name}  (${g.sites.length} site(s))`).join("\n")}`,
    );
  }

  if (undated.length) {
    console.log(
      `\nUndated — ${gated.length} condition-gated, ${triggerless.length} with no trigger ` +
        `(${undatedSites} sites):`,
    );
    if (triggerless.length)
      console.log(`  No date and no condition:\n${triggerless.map(formatGroup).join("\n")}`);
    if (gated.length)
      console.log(`  Condition-gated, so no date is needed:\n${gated.map(formatGroup).join("\n")}`);

    if (options.archaeology) {
      const proposals = triggerless
        .map((group) => [group.name, introducedOn(root, group)])
        .filter(([, added]) => added)
        .map(
          ([name, added]) =>
            `  ${name}: added ${added}, propose remove after ${addDays(added, SUGGESTED_TTL_DAYS)}`,
        );
      console.log(
        `\nProposed removal dates for triggerless shims (introducing commit + ${SUGGESTED_TTL_DAYS} days):`,
      );
      console.log(proposals.join("\n"));
      const undatable = triggerless.length - proposals.length;
      if (undatable > 0)
        console.log(`  ${undatable} shim(s) with no findable introducing commit (shallow clone?)`);
    } else {
      console.log("\nRun with --archaeology to date these from git history.");
    }
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main();
}
