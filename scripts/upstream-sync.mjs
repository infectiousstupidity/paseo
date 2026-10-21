#!/usr/bin/env node
// Merge upstream without repeatedly resolving intentionally removed fork paths.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(readFileSync(path.join(root, "scripts/upstream-sync-policy.json"), "utf8"));
const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => !["--dry-run", "--verify", "--no-commit"].includes(arg))) {
  throw new Error("Usage: node scripts/upstream-sync.mjs [--dry-run] [--verify] [--no-commit]");
}

function git(command, options = {}) {
  const result = spawnSync("git", command, { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error("git " + command.join(" ") + " failed:\n" + (result.stderr || result.stdout));
  }
  return result;
}

function existsInHead(candidate) {
  return git(["ls-tree", "-r", "--name-only", "HEAD", "--", candidate]).stdout.trim().length > 0;
}

function ensurePaths(paths) {
  for (const candidate of paths) {
    if (!candidate || path.isAbsolute(candidate) || candidate.includes("..") ||
        candidate.includes("\\") || candidate.startsWith(".git/")) {
      throw new Error("Unsafe upstream path policy: " + candidate);
    }
  }
}

ensurePaths(policy.exclude);
ensurePaths(policy.preserve);
for (const removed of policy.exclude) {
  if (policy.preserve.some((kept) => removed.startsWith(kept) || kept.startsWith(removed))) {
    throw new Error("Overlapping upstream exclusions and protected paths: " + removed);
  }
}

if (git(["branch", "--show-current"]).stdout.trim() !== "main") {
  throw new Error("Run from a clean checkout of main.");
}
if (git(["status", "--porcelain"]).stdout.trim()) {
  throw new Error("Working tree must be clean; refusing to change another worker's files.");
}
const remote = git(["remote", "get-url", "upstream"], { allowFailure: true });
if (remote.status !== 0) {
  git(["remote", "add", "upstream", "https://github.com/getpaseo/paseo.git"]);
} else if (!/github\.com[:/]getpaseo\/paseo(?:\.git)?\s*$/i.test(remote.stdout)) {
  throw new Error("Refusing unexpected upstream URL: " + remote.stdout.trim());
}

git(["fetch", "upstream", "main"]);
if (git(["merge-base", "--is-ancestor", "upstream/main", "HEAD"], { allowFailure: true }).status === 0) {
  console.log("Already up to date with upstream/main.");
  process.exit(0);
}
if (args.has("--dry-run")) {
  console.log("Incoming commits: " + git(["rev-list", "--count", "HEAD..upstream/main"]).stdout.trim());
  process.exit(0);
}

const merge = git(["merge", "--no-commit", "--no-ff", "upstream/main"], { allowFailure: true });
if (merge.status !== 0 && git(["rev-parse", "-q", "--verify", "MERGE_HEAD"], { allowFailure: true }).status !== 0) {
  throw new Error("Upstream merge failed before it could start: " + merge.stderr);
}
for (const candidate of policy.exclude) {
  git(["rm", "-r", "-f", "--ignore-unmatch", "--", candidate]);
}
for (const candidate of policy.preserve) {
  git(["rm", "-r", "-f", "--ignore-unmatch", "--", candidate]);
  if (existsInHead(candidate)) {
    git(["restore", "--source=HEAD", "--staged", "--worktree", "--", candidate]);
  }
}
const conflicts = git(["diff", "--name-only", "--diff-filter=U"]).stdout.trim();
if (conflicts) {
  console.error("Unresolved upstream conflicts outside the policy:\n" + conflicts);
  console.error("Merge remains open for manual resolution. Do not reset unrelated work.");
  process.exit(1);
}
git(["diff", "--cached", "--check"]);
if (args.has("--verify")) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const check = spawnSync(npm, ["run", "typecheck"], { cwd: root, stdio: "inherit" });
  if (check.error) throw check.error;
  if (check.status !== 0) throw new Error("Typecheck failed; merge remains open.");
}
if (args.has("--no-commit")) {
  console.log("Policy applied. Changes staged; merge is not committed.");
  process.exit(0);
}
git(["commit", "-m", "Merge upstream/main with fork path policy"]);
console.log("Upstream merged with fork exclusions preserved. Run CI before pushing.");
