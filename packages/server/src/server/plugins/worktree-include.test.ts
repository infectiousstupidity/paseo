import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { copyWorktreeIncludes } from "../../../../../plugins/worktree-include/server/copy.js";

test("copy only selected ignored files; do not overwrite tracked or existing files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-includes-"));
  const source = path.join(root, "source");
  const target = path.join(root, "target");
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: source, stdio: "pipe" });
  try {
    await mkdir(source);
    git("init", "-b", "main");
    await mkdir(path.join(source, "config"));
    await writeFile(path.join(source, ".gitignore"), ".env\nconfig/*.local.json\n");
    await writeFile(
      path.join(source, ".worktreeinclude"),
      ".env\nconfig/*.local.json\nvisible.txt\n",
    );
    await writeFile(path.join(source, "config/tracked.local.json"), "committed");
    git("add", ".gitignore", ".worktreeinclude");
    git("add", "-f", "config/tracked.local.json");
    git("-c", "user.name=Test", "-c", "user.email=test@example.com",
      "-c", "commit.gpgsign=false", "commit", "-m", "initial");
    await writeFile(path.join(source, ".env"), "SOURCE_SECRET");
    await writeFile(path.join(source, "config/app.local.json"), "LOCAL_ONLY");
    await writeFile(path.join(source, "config/tracked.local.json"), "dirty tracked");
    await writeFile(path.join(source, "visible.txt"), "visible");
    git("worktree", "add", "-b", "feature", target, "main");

    // Tracked .local.json comes from Git; the include copy must not replace it.
    await writeFile(path.join(target, ".env"), "already present");
    const result = await copyWorktreeIncludes(target, source);
    expect(result).toEqual({
      kind: "copied",
      copied: ["config/app.local.json"],
      skipped: [".env"],
    });
    expect(await readFile(path.join(target, ".env"), "utf8")).toBe("already present");
    expect(await readFile(path.join(target, "config/app.local.json"), "utf8")).toBe("LOCAL_ONLY");
    expect(await readFile(path.join(target, "config/tracked.local.json"), "utf8")).toBe("committed");
    await expect(readFile(path.join(target, "visible.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    await rm(path.join(source, ".worktreeinclude"));
    expect(await copyWorktreeIncludes(target, source)).toEqual({ kind: "no-include-file" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
