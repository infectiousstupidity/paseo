// Derived from cprecioso/paseo-worktreeinclude (MIT); see ../LICENSE.
// Copyright (c) 2026 Carlos Precioso.
import { execFile } from "node:child_process";
import { constants, existsSync } from "node:fs";
import { copyFile, lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const INCLUDE_FILE = ".worktreeinclude";

export type CopyResult =
  | { kind: "no-include-file" }
  | { kind: "copied"; copied: string[]; skipped: string[] };

async function git(cwd: string, args: string[], input?: string): Promise<string> {
  const child = exec("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 });
  if (input !== undefined) child.child.stdin?.end(input);
  const { stdout } = await child;
  return stdout;
}

async function gitAllowNoMatches(cwd: string, args: string[], input: string): Promise<string> {
  try {
    return await git(cwd, args, input);
  } catch (error) {
    // git check-ignore uses exit code 1 for no matches.
    if ((error as { code?: number }).code === 1) return "";
    throw error;
  }
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

const splitNul = (value: string) => value.split("\0").filter(Boolean);

/**
 * Copy only paths selected by .worktreeinclude that Git also considers ignored.
 * Never replace a destination file, follow a source symlink, or escape the worktree.
 */
export async function copyWorktreeIncludes(worktree: string, source: string): Promise<CopyResult> {
  if (!existsSync(path.join(source, INCLUDE_FILE))) return { kind: "no-include-file" };

  const included = splitNul(
    await git(source, ["ls-files", "--others", "--ignored", `--exclude-from=${INCLUDE_FILE}`, "-z"]),
  );
  if (included.length === 0) return { kind: "copied", copied: [], skipped: [] };

  const ignored = splitNul(
    await gitAllowNoMatches(source, ["check-ignore", "--stdin", "-z"], included.join("\0") + "\0"),
  );
  const sourceRoot = await realpath(source);
  const targetRoot = await realpath(worktree);
  const sourcePath = path.resolve(source);
  const targetPath = path.resolve(worktree);
  const copied: string[] = [];
  const skipped: string[] = [];

  for (const file of ignored) {
    const from = path.resolve(source, file);
    const to = path.resolve(worktree, file);
    if (!inside(sourceRoot, await realpath(from))) {
      throw new Error(`Refusing included source outside checkout: ${file}`);
    }
    if (!inside(targetPath, to) || !inside(sourcePath, from)) {
      throw new Error(`Refusing unsafe included path: ${file}`);
    }
    const info = await lstat(from);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`Included path is not a regular file: ${file}`);
    }
    if (existsSync(to)) {
      skipped.push(file);
      continue;
    }
    await mkdir(path.dirname(to), { recursive: true });
    if (!inside(targetRoot, await realpath(path.dirname(to)))) {
      throw new Error(`Refusing included destination outside worktree: ${file}`);
    }
    try {
      // FICLONE falls back to normal copying; EXCL prevents concurrent overwrites.
      await copyFile(from, to, constants.COPYFILE_FICLONE | constants.COPYFILE_EXCL);
      copied.push(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      skipped.push(file);
    }
  }
  return { kind: "copied", copied, skipped };
}
