#!/usr/bin/env node
// Install the standalone plugin demo's dependencies only when its lockfile changes.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = path.join(root, "plugin-examples/markdown-panel");
const lock = path.join(example, "package-lock.json");
const pkg = path.join(example, "package.json");
const marker = path.join(example, "node_modules/.paseo-typecheck-deps");

const fingerprint = createHash("sha256")
  .update(readFileSync(lock))
  .update(readFileSync(pkg))
  .digest("hex");
if (existsSync(marker) && readFileSync(marker, "utf8") === fingerprint) {
  process.exit(0);
}

console.log("Installing plugin example dependencies (first run or lockfile changed)...");
const result = spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
  cwd: example,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync(marker, fingerprint);
