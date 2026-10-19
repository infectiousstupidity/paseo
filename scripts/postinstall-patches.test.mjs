import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const script = path.resolve("scripts", "postinstall-patches.mjs");
const patchPackage = path.resolve("node_modules", "patch-package");
const packageName = "react-native-draggable-flatlist";

function createCheckout({ tool = true, cwd = ".", name = packageName } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "postinstall patches "));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "checkout" }));
  const packageDir = path.join(root, cwd, "node_modules", name);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name, version: "4.0.3" }));
  writeFileSync(path.join(packageDir, "index.js"), "export const value = 1;\n");
  if (cwd !== ".") {
    writeFileSync(path.join(root, cwd, "package.json"), JSON.stringify({ name: "workspace" }));
  }
  if (tool) {
    mkdirSync(path.join(root, "node_modules"), { recursive: true });
    symlinkSync(patchPackage, path.join(root, "node_modules", "patch-package"), "junction");
  }
  mkdirSync(path.join(root, "patches"));
  return { root, packageDir };
}

function writePatch(root, from, to, name = packageName) {
  const file = `node_modules/${name}/index.js`;
  const patchFile = `${name.replaceAll("/", "+")}+4.0.3.patch`;
  writeFileSync(
    path.join(root, "patches", patchFile),
    [
      `diff --git a/${file} b/${file}`,
      `--- a/${file}`,
      `+++ b/${file}`,
      "@@ -1 +1 @@",
      `-export const value = ${from};`,
      `+export const value = ${to};`,
      "",
    ].join("\n"),
  );
}

function install(root) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: "" },
  });
}

test("a patch that changed since it was applied removes the package for a clean reinstall", () => {
  const { root, packageDir } = createCheckout();
  try {
    writePatch(root, 1, 2);
    assert.equal(install(root).status, 0);
    assert.equal(
      readFileSync(path.join(packageDir, "index.js"), "utf8"),
      "export const value = 2;\n",
    );

    writePatch(root, 1, 3);
    const result = install(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Run npm install again/);
    assert.equal(existsSync(packageDir), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an already applied patch leaves the package in place", () => {
  const { root, packageDir } = createCheckout();
  try {
    writePatch(root, 1, 2);
    assert.equal(install(root).status, 0);
    assert.equal(install(root).status, 0);
    assert.equal(
      readFileSync(path.join(packageDir, "index.js"), "utf8"),
      "export const value = 2;\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a missing patch-package fails the install and leaves the package in place", () => {
  const { root, packageDir } = createCheckout({ tool: false });
  try {
    writePatch(root, 1, 2);
    const result = install(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /patch-package unavailable:.*Cannot find module/);
    assert.deepEqual(readdirSync(path.join(root, ".tmp")), []);
    assert.equal(existsSync(packageDir), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const { cwd, name } of [
  { cwd: ".", name: packageName },
  { cwd: "packages/app", name: "react-native-enriched-markdown" },
  { cwd: "packages/server", name: "@opencode-ai/sdk" },
]) {
  test(`patches in ${cwd} apply with an empty PATH and a checkout path containing spaces`, () => {
    const { root, packageDir } = createCheckout({ cwd, name });
    try {
      writePatch(root, 1, 2, name);
      const result = install(root);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(
        readFileSync(path.join(packageDir, "index.js"), "utf8"),
        "export const value = 2;\n",
      );
      assert.deepEqual(readdirSync(path.join(root, ".tmp")), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
