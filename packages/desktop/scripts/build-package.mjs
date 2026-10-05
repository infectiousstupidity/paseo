#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolveNpmInvocation } from "./build-package-runtime.mjs";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npmInvocation = resolveNpmInvocation();

function runNpm(args) {
  run(npmInvocation.command, [...npmInvocation.argsPrefix, ...args]);
}

runNpm(["--prefix", "../..", "run", "build:server:clean"]);
runNpm(["run", "build:main"]);
run(process.execPath, ["scripts/write-local-build-info.mjs"]);

const builderArgs = ["exec", "--", "electron-builder", "--config", "electron-builder.yml"];
if (process.env.PASEO_LOCAL_BUILD_COMMIT?.trim()) {
  builderArgs.push("-c.win.signAndEditExecutable=false");
}
builderArgs.push(...process.argv.slice(2));

runNpm(builderArgs);
