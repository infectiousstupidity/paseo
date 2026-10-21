import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const policy = JSON.parse(
  readFileSync(path.join(root, "scripts/upstream-sync-policy.json"), "utf8"),
);

test("removed upstream paths stay untracked in this fork", () => {
  assert.equal(policy.version, 1);
  assert.equal(new Set(policy.exclude).size, policy.exclude.length);

  // Ignored build caches can remain locally after their source directory was removed.
  const tracked = execFileSync("git", ["ls-files", "--", ...policy.exclude], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(tracked.trim(), "", tracked);
});

test("fork-owned instructions, mockups and task documents remain protected", () => {
  for (const protectedPath of ["CLAUDE.md", "docs/mockups/", "docs/tasks/"]) {
    assert.ok(policy.preserve.includes(protectedPath));
    assert.ok(existsSync(path.join(root, protectedPath)), protectedPath);
  }
});
