import treeKill from "tree-kill";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";

export interface TreeKillTarget {
  pid?: number;
  exitCode?: number | null;
  signalCode?: NodeJS.Signals | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  once?(event: "exit", listener: () => void): unknown;
}

export interface TerminateWithTreeKillOptions {
  gracefulSignal?: NodeJS.Signals;
  forceSignal?: NodeJS.Signals;
  gracefulTimeoutMs: number;
  forceTimeoutMs?: number;
  onForceSignal?: () => void;
  /**
   * Process-tree identity captured while the root was still alive (see `captureProcessTree`). The
   * SDK may kill the root before close verification runs, and session-owned descendants — MCP
   * servers, Monitor/background tasks — can outlive their parent. When provided, closure is only
   * reported successful once every tracked pid is gone; a tracked process that survives reports
   * "kill-timeout".
   */
  trackedProcesses?: readonly ProcessTreeSnapshot[];
}

export interface ProcessTreeSnapshot {
  pid: number;
  childPids: number[];
}

export type TerminateWithTreeKillResult =
  | "already-exited"
  | "terminated"
  | "killed"
  | "kill-timeout";

// Injection seam: production wires terminateWithTreeKill; tests wire a fake that
// records which children were terminated as observable state.
export type ProcessTerminator = (
  child: TreeKillTarget,
  options: TerminateWithTreeKillOptions,
) => Promise<TerminateWithTreeKillResult>;

export async function terminateWithTreeKill(
  child: TreeKillTarget,
  options: TerminateWithTreeKillOptions,
): Promise<TerminateWithTreeKillResult> {
  if (isProcessExited(child)) {
    return await verifyTrackedProcesses(null, options);
  }

  const exitPromise = waitForProcessExit(child);
  await signalProcessTree(child, options.gracefulSignal ?? "SIGTERM");
  if (await waitForExitOrTimeout(exitPromise, options.gracefulTimeoutMs)) {
    return await verifyTrackedProcesses("terminated", options);
  }

  options.onForceSignal?.();
  await signalProcessTree(child, options.forceSignal ?? "SIGKILL");
  if (options.forceTimeoutMs === undefined) {
    return await verifyTrackedProcesses("killed", options);
  }
  if (!(await waitForExitOrTimeout(exitPromise, options.forceTimeoutMs))) {
    return "kill-timeout";
  }
  return await verifyTrackedProcesses("killed", options);
}

/**
 * Capture the process tree (children one level deep — what the SDK reparents when it kills the
 * root) while the root is alive, so closure verification can still see it afterwards.
 */
export async function captureProcessTree(pid: number): Promise<ProcessTreeSnapshot | null> {
  if (!Number.isInteger(pid) || pid <= 0 || isProcessDead(pid)) {
    return null;
  }
  const childPids = await listProcessChildren(pid);
  return { pid, childPids };
}

function isProcessDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

async function listProcessChildren(pid: number): Promise<number[]> {
  if (process.platform !== "linux") {
    return new Promise<number[]>((resolve) => {
      const proc = spawn("pgrep", ["-P", String(pid)], { stdio: ["ignore", "pipe", "ignore"] });
      let stdout = "";
      proc.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.on("error", () => resolve([]));
      proc.on("close", () =>
        resolve(
          stdout
            .split("\n")
            .map((line) => parseInt(line.trim(), 10))
            .filter(Number.isInteger),
        ),
      );
    });
  }

  const entries = await readdir("/proc").catch(() => [] as string[]);
  const children: number[] = [];
  for (const entry of entries) {
    const childPid = Number(entry);
    if (!Number.isInteger(childPid) || childPid <= 0) {
      continue;
    }
    try {
      const stat = await readFile(`/proc/${entry}/stat`, "utf8"); // comm is parenthesised and may contain spaces; ppid follows the closing parenthesis.
      const tail = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (tail[1] === String(pid)) {
        children.push(childPid);
      }
    } catch {
      // Process vanished mid-scan.
    }
  }
  return children;
}

/**
 * A kill that cannot be verified is not a success. With no tracked descendants this preserves the
 * historic results exactly; with them, every tracked pid must be gone before success stands, and
 * tracked processes get the same TERM-then-escalation grace as the tree.
 */
async function verifyTrackedProcesses(
  result: TerminateWithTreeKillResult | null,
  options: TerminateWithTreeKillOptions,
): Promise<TerminateWithTreeKillResult> {
  const tracked = (options.trackedProcesses ?? []).filter(
    (snapshot) =>
      Number.isInteger(snapshot.pid) && snapshot.pid > 0 && !isProcessDead(snapshot.pid),
  );
  if (tracked.length === 0) {
    return result ?? "already-exited";
  }

  const gracefulSignal = options.gracefulSignal ?? "SIGTERM";
  const forceSignal = options.forceSignal ?? "SIGKILL";
  for (const snapshot of tracked) {
    try {
      process.kill(snapshot.pid, gracefulSignal);
    } catch {
      // Already gone between check and signal.
    }
  }
  let graceMs = options.gracefulTimeoutMs;
  while (graceMs > 0) {
    if (tracked.every((snapshot) => isProcessDead(snapshot.pid))) {
      return result ?? "already-exited";
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(100, graceMs)));
    graceMs -= 100;
  }
  for (const snapshot of tracked) {
    try {
      process.kill(snapshot.pid, forceSignal);
    } catch {
      // Already gone.
    }
  }
  let forceGraceMs = options.forceTimeoutMs ?? 2000;
  while (forceGraceMs > 0) {
    if (tracked.every((snapshot) => isProcessDead(snapshot.pid))) {
      return result ?? "already-exited";
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(100, forceGraceMs)));
    forceGraceMs -= 100;
  }
  return "kill-timeout";
}

export function signalProcessTree(child: TreeKillTarget, signal: NodeJS.Signals): Promise<void> {
  if (isProcessExited(child)) {
    return Promise.resolve();
  }

  const pid = child.pid;
  if (typeof pid !== "number" || pid <= 0) {
    signalDirectChild(child, signal);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    treeKill(pid, signal, (error) => {
      if (error) {
        signalDirectChild(child, signal);
      }
      resolve();
    });
  });
}

function signalDirectChild(child: TreeKillTarget, signal: NodeJS.Signals): void {
  try {
    child.kill(signal);
  } catch {
    // Ignore cleanup races.
  }
}

function isProcessExited(child: TreeKillTarget): boolean {
  return (
    (child.exitCode !== null && child.exitCode !== undefined) ||
    (child.signalCode !== null && child.signalCode !== undefined)
  );
}

function waitForProcessExit(child: TreeKillTarget): Promise<void> {
  if (isProcessExited(child)) {
    return Promise.resolve();
  }
  if (!child.once) {
    return new Promise(() => undefined);
  }

  return new Promise((resolve) => {
    child.once?.("exit", resolve);
  });
}

async function waitForExitOrTimeout(
  exitPromise: Promise<void>,
  timeoutMs: number,
): Promise<boolean> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      exitPromise.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
