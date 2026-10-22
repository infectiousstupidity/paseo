#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptDir, "..");
const outputPath = path.join(desktopDir, "dist", "local-build-info.json");
const commit = process.env.PASEO_LOCAL_BUILD_COMMIT?.trim();

if (!commit) {
  await rm(outputPath, { force: true });
  process.stdout.write("[local-build] official build; local marker removed\n");
  process.exit(0);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      paseoBuildFlavor: "local",
      paseoBuildCommit: commit,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
process.stdout.write(`[local-build] stamped ${commit}\n`);
