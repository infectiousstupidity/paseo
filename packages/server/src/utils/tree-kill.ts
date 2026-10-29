import treeKill from "tree-kill";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";

export interface TreeKillTarget {
  pid?: number;
  exitCode?: number | null;
  signalCode?: NodeJS.Signals | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  once?(event: "exit", listener: () => void): void;
}

export interface ProcessIdentity {
  pid: number;
  /** Kernel start time, not just a reusable PID. */
  startedAt: string;
}

export interface ProcessTreeSnapshot extends ProcessIdentity {
  descendants: ProcessIdentity[];
}

export interface TerminateWithTreeKillOptions {
  gracefulSignal?: NodeJS.Signals;
  forceSignal?: NodeJS.Signals;
  gracefulTimeoutMs: number;
  forceTimeoutMs?: number;
  onForceSignal?: () => void;
  /** Capture before an SDK can kill/reparent the root; retain across failed cleanup attempts. */
  trackedProcesses?: readonly ProcessTreeSnapshot[];
}

export type TerminateWithTreeKillResult =
  | "already-exited"
  | "terminated"
  | "killed"
  | "kill-timeout";
export type ProcessTerminator = (
  child: TreeKillTarget,
  options: TerminateWithTreeKillOptions,
) => Promise<TerminateWithTreeKillResult>;

interface ProcessInfo extends ProcessIdentity {
  parentPid: number;
  zombie: boolean;
}

const execFileAsync = promisify(execFile);

async function linuxProcessInfo(pid: number): Promise<ProcessInfo | null> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return { pid, parentPid: Number(fields[1]), startedAt: fields[19]!, zombie: fields[0] === "Z" };
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ESRCH"
    )
      return null;
    throw error;
  }
}

async function processTable(): Promise<ProcessInfo[]> {
  if (process.platform === "linux") {
    const pids = (await readdir("/proc"))
      .map(Number)
      .filter((pid) => Number.isInteger(pid) && pid > 0);
    const entries = await Promise.all(pids.map(linuxProcessInfo));
    return entries.filter((entry): entry is ProcessInfo => entry !== null);
  }
  if (process.platform === "win32") return [];
  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,ppid=,stat=,lstart="]);
  return stdout
    .trim()
    .split("\n")
    .flatMap((line) => {
      const [pid, parentPid, state, ...start] = line.trim().split(/\s+/);
      if (!pid || !parentPid || !state || start.length === 0) return [];
      return [
        {
          pid: Number(pid),
          parentPid: Number(parentPid),
          startedAt: start.join(" "),
          zombie: state.startsWith("Z"),
        },
      ];
    });
}

/** Capture every generation of session-owned descendants, including separate process groups. */
export async function captureProcessTree(pid: number): Promise<ProcessTreeSnapshot | null> {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const table = await processTable();
  const root = table.find((entry) => entry.pid === pid && !entry.zombie);
  if (!root) return null;
  const owned = new Set([pid]);
  const descendants: ProcessIdentity[] = [];
  for (let size = -1; size !== owned.size; ) {
    size = owned.size;
    for (const entry of table) {
      if (!owned.has(entry.pid) && owned.has(entry.parentPid)) {
        owned.add(entry.pid);
        if (!entry.zombie) descendants.push({ pid: entry.pid, startedAt: entry.startedAt });
      }
    }
  }
  return { pid, startedAt: root.startedAt, descendants };
}

async function survivingProcesses(tracked: readonly ProcessIdentity[]): Promise<ProcessIdentity[]> {
  const table = process.platform === "linux" ? null : await processTable();
  const surviving: ProcessIdentity[] = [];
  for (const identity of tracked) {
    const current = table
      ? table.find((entry) => entry.pid === identity.pid)
      : await linuxProcessInfo(identity.pid);
    if (current && !current.zombie && current.startedAt === identity.startedAt)
      surviving.push(identity);
  }
  return surviving;
}

async function signalTracked(
  tracked: readonly ProcessIdentity[],
  signal: NodeJS.Signals,
): Promise<void> {
  for (const identity of await survivingProcesses(tracked)) {
    try {
      process.kill(identity.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
}

async function waitForTrackedExit(
  tracked: readonly ProcessIdentity[],
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while ((await survivingProcesses(tracked)).length > 0) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))),
    );
  }
  return true;
}

export async function terminateWithTreeKill(
  child: TreeKillTarget,
  options: TerminateWithTreeKillOptions,
): Promise<TerminateWithTreeKillResult> {
  const captured =
    child.pid && !isProcessExited(child) ? await captureProcessTree(child.pid) : null;
  const snapshots = [...(options.trackedProcesses ?? []), ...(captured ? [captured] : [])];
  const tracked: ProcessIdentity[] = [];
  for (const snapshot of snapshots) tracked.push(snapshot, ...snapshot.descendants);
  let result: TerminateWithTreeKillResult = "already-exited";
  if (!isProcessExited(child)) {
    const exitPromise = waitForProcessExit(child);
    await signalProcessTree(child, options.gracefulSignal ?? "SIGTERM");
    if (await waitForExitOrTimeout(exitPromise, options.gracefulTimeoutMs)) result = "terminated";
    else {
      options.onForceSignal?.();
      await signalProcessTree(child, options.forceSignal ?? "SIGKILL");
      if (
        options.forceTimeoutMs !== undefined &&
        !(await waitForExitOrTimeout(exitPromise, options.forceTimeoutMs))
      )
        return "kill-timeout";
      result = "killed";
    }
  }
  // The root exiting does not prove its descendants exited. Their identity survives reparenting.
  await signalTracked(tracked, options.gracefulSignal ?? "SIGTERM");
  if (await waitForTrackedExit(tracked, options.gracefulTimeoutMs)) return result;
  await signalTracked(tracked, options.forceSignal ?? "SIGKILL");
  return (await waitForTrackedExit(tracked, options.forceTimeoutMs ?? 2000))
    ? result
    : "kill-timeout";
}

export function signalProcessTree(child: TreeKillTarget, signal: NodeJS.Signals): Promise<void> {
  if (isProcessExited(child)) return Promise.resolve();
  const pid = child.pid;
  if (typeof pid !== "number" || pid <= 0) {
    signalDirectChild(child, signal);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    treeKill(pid, signal, (error) => {
      if (error) signalDirectChild(child, signal);
      resolve();
    });
  });
}

function signalDirectChild(child: TreeKillTarget, signal: NodeJS.Signals): void {
  try {
    child.kill(signal);
  } catch {
    /* Cleanup race. */
  }
}

function isProcessExited(child: TreeKillTarget): boolean {
  return (
    (child.exitCode !== null && child.exitCode !== undefined) ||
    (child.signalCode !== null && child.signalCode !== undefined)
  );
}

function waitForProcessExit(child: TreeKillTarget): Promise<void> {
  if (isProcessExited(child)) return Promise.resolve();
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
    if (timer) clearTimeout(timer);
  }
}
