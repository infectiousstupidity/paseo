#!/usr/bin/env node
// Typecheck all workspaces without one npm process per workspace.
// Package scripts remain the contract: reject unknown hooks rather than skip work.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsgo = path.join(root, "node_modules/@typescript/native-preview/bin/tsgo.js");
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const concurrency = Number(process.env.PASEO_TYPECHECK_JOBS ?? 4);

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
  throw new Error("PASEO_TYPECHECK_JOBS must be an integer from 1 to 16");
}
if (!existsSync(tsgo)) {
  throw new Error("Missing tsgo; run npm ci at the repository root first");
}

const workspaces = manifest.workspaces.map((workspace) => {
  const cwd = path.join(root, workspace);
  const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
  const typecheck = pkg.scripts?.typecheck;
  if (!typecheck) return null;

  const [compiler, ...rest] = typecheck.split(" && ");
  const argv = compiler.trim().split(/\s+/);
  if (argv.shift() !== "tsgo" || !argv.includes("--noEmit")) {
    throw new Error("Unsupported typecheck script in " + workspace + ": " + typecheck);
  }
  if (rest.length) {
    throw new Error("Unrecognized typecheck follow-up in " + workspace + ": " + typecheck);
  }
  if (
    pkg.scripts.pretypecheck &&
    (workspace !== "packages/protocol" ||
      pkg.scripts.pretypecheck !== "npm run generate:validators" ||
      pkg.scripts["generate:validators"] !== "node scripts/generate-validation-aot.mjs")
  ) {
    throw new Error("Unrecognized pretypecheck hook in " + workspace);
  }
  return { workspace, cwd, args: argv };
}).filter(Boolean);

function run(label, command, args, cwd) {
  return new Promise((resolve) => {
    const started = performance.now();
    const child = spawn(command, args, { cwd, stdio: ["inherit", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", (error) => {
      stderr += error.message + "\n";
    });
    child.on("close", (code) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      console.log((code === 0 ? "PASS " : "FAIL ") + label + " (" + seconds + "s)");
      resolve(code === 0);
    });
  });
}

async function main() {
  // The protocol hook generates validators consumed by other workspaces.
  if (workspaces.some(({ workspace }) => workspace === "packages/protocol")) {
    const generated = await run(
      "protocol validators",
      process.execPath,
      ["scripts/generate-validation-aot.mjs"],
      path.join(root, "packages/protocol"),
    );
    if (!generated) {
      process.exitCode = 1;
      return;
    }
  }

  let next = 0;
  const failed = [];
  async function worker() {
    while (next < workspaces.length) {
      const task = workspaces[next++];
      const ok = await run(task.workspace, process.execPath, [tsgo, ...task.args], task.cwd);
      if (!ok) {
        failed.push(task.workspace);
        continue;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, workspaces.length) }, worker));
  if (failed.length) {
    console.error("Typecheck failed: " + failed.join(", "));
    process.exitCode = 1;
  }
}

await main();
