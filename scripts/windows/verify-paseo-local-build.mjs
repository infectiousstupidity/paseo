#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");

const [, , asarPathArg, expectedCommitArg] = process.argv;
if (!asarPathArg) {
  console.error("Usage: node verify-paseo-local-build.mjs <app.asar> [expected-commit]");
  process.exit(2);
}

const asarPath = path.resolve(asarPathArg);
let info;
try {
  const bytes = asar.extractFile(asarPath, "dist/local-build-info.json");
  info = JSON.parse(bytes.toString("utf8"));
} catch (error) {
  console.error(`Paseo Local marker missing from ${asarPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const flavor = typeof info?.paseoBuildFlavor === "string" ? info.paseoBuildFlavor : null;
const commit = typeof info?.paseoBuildCommit === "string" ? info.paseoBuildCommit : null;

if (flavor !== "local") {
  console.error(`Unexpected build flavor: ${flavor ?? "<missing>"}`);
  process.exit(1);
}
if (expectedCommitArg && commit !== expectedCommitArg) {
  console.error(`Build commit mismatch: expected ${expectedCommitArg}, found ${commit ?? "<missing>"}`);
  process.exit(1);
}

console.log(`Paseo Local verified: commit=${commit ?? "<unknown>"}`);
