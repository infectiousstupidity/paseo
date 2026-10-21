import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const policy = JSON.parse(
  readFileSync(path.join(root, "scripts/upstream-sync-policy.json"), "utf8"),
);

test("removed upstream paths stay absent from this fork", () => {
  assert.equal(policy.version, 1);
  assert.equal(new Set(policy.exclude).size, policy.exclude.length);

  for (const excluded of policy.exclude) {
    assert.equal(existsSync(path.join(root, excluded)), false, excluded);
  }
});

test("fork-owned mockups and task documents remain protected", () => {
  for (const protectedPath of ["docs/mockups/", "docs/tasks/"]) {
    assert.ok(policy.preserve.includes(protectedPath));
    assert.ok(existsSync(path.join(root, protectedPath)), protectedPath);
  }
});
