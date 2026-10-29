import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { captureProcessTree, terminateWithTreeKill } from "./tree-kill.js";

const pollIntervalMs = 50;

let tempDir: string | null = null;
let ownerProcess: ChildProcess | null = null;
let descendantPid: number | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(
  check: () => Promise<boolean> | boolean,
  timeoutMs: number,
  message: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  async function poll(): Promise<void> {
    if (await check()) return;
    if (Date.now() >= deadline) throw new Error(message);
    await sleep(pollIntervalMs);
    return poll();
  }
  return poll();
}

async function readPidFileNumber(filePath: string): Promise<number | null> {
  try {
    const raw = (await readFile(filePath, "utf-8")).trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function killIfRunning(pid: number | null | undefined): void {
  if (!pid || !isProcessRunning(pid)) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Ignore cleanup races.
  }
}

function spawnOwnerWithDescendant(options: {
  childPidPath: string;
  detachedDescendant: boolean;
  grandchildPidPath?: string;
}): ChildProcess {
  const descendantOptions = options.detachedDescendant
    ? '{ detached: true, stdio: "ignore" }'
    : '{ stdio: "ignore" }';
  const childUnref = options.detachedDescendant ? "child.unref();" : "";

  return spawn(
    process.execPath,
    [
      "-e",
      `
        const { spawn } = require("node:child_process");
        process.on("SIGTERM", () => {});
        const child = spawn(process.execPath, [
          "-e",
          ${JSON.stringify(`
            const fs = require("node:fs");
            process.on("SIGTERM", () => {});
            fs.writeFileSync(${JSON.stringify(options.childPidPath)}, String(process.pid));
            ${options.grandchildPidPath ? `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(`require("node:fs").writeFileSync(${JSON.stringify(options.grandchildPidPath)}, String(process.pid)); process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);`)}], { stdio: "ignore", detached: true }).unref();` : ""}
            setInterval(() => {}, 1000);
          `)}
        ], ${descendantOptions});
        ${childUnref}
        setInterval(() => {}, 1000);
      `,
    ],
    { stdio: "ignore" },
  );
}

async function waitForFixtureReady(childPidPath: string): Promise<void> {
  await waitFor(
    async () => {
      descendantPid = await readPidFileNumber(childPidPath);
      return (
        isProcessRunning(ownerProcess?.pid ?? -1) &&
        descendantPid !== null &&
        isProcessRunning(descendantPid)
      );
    },
    5000,
    "owner descendant did not become running in time",
  );
}

async function expectOwnerAndDescendantStopped(message: string): Promise<void> {
  await waitFor(
    () => !isProcessRunning(ownerProcess?.pid ?? -1) && !isProcessRunning(descendantPid ?? -1),
    5000,
    message,
  );
}

afterEach(async () => {
  killIfRunning(ownerProcess?.pid);
  killIfRunning(descendantPid);
  ownerProcess = null;
  descendantPid = null;

  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("terminateWithTreeKill", () => {
  test.runIf(process.platform !== "win32")(
    "verifies retained children and grandchildren after the SDK kills their root",
    async () => {
      tempDir = await mkdtemp(join(tmpdir(), "paseo-orphan-tree-"));
      const childPidPath = join(tempDir, "child.pid");
      const grandchildPidPath = join(tempDir, "grandchild.pid");
      ownerProcess = spawnOwnerWithDescendant({
        childPidPath,
        grandchildPidPath,
        detachedDescendant: true,
      });
      await waitForFixtureReady(childPidPath);
      let grandchildPid: number | null = null;
      await waitFor(
        async () => {
          grandchildPid = await readPidFileNumber(grandchildPidPath);
          return grandchildPid !== null;
        },
        5000,
        "grandchild did not start",
      );
      try {
        const snapshot = await captureProcessTree(ownerProcess.pid!);
        expect(snapshot?.descendants.map((entry) => entry.pid)).toEqual(
          expect.arrayContaining([descendantPid, grandchildPid]),
        );
        if (!snapshot) throw new Error("missing owned process snapshot");
        const exit = new Promise<void>((resolve) => ownerProcess!.once("exit", () => resolve()));
        ownerProcess.kill("SIGKILL");
        await exit;
        expect(
          await terminateWithTreeKill(ownerProcess, {
            gracefulTimeoutMs: 50,
            forceTimeoutMs: 2000,
            trackedProcesses: [snapshot],
          }),
        ).toBe("already-exited");
        for (const identity of snapshot.descendants) {
          expect((await captureProcessTree(identity.pid))?.startedAt).not.toBe(identity.startedAt);
        }
      } finally {
        killIfRunning(grandchildPid);
      }
    },
  );

  test.runIf(process.platform !== "win32")(
    "never signals an unrelated process whose PID does not match the captured generation",
    async () => {
      const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
        stdio: "ignore",
      });
      await new Promise<void>((resolve) => unrelated.once("spawn", resolve));
      try {
        const snapshot = await captureProcessTree(unrelated.pid!);
        if (!snapshot) throw new Error("missing unrelated process snapshot");
        const target = { exitCode: 0, kill: () => false };
        expect(
          await terminateWithTreeKill(target, {
            gracefulTimeoutMs: 0,
            forceTimeoutMs: 0,
            trackedProcesses: [{ ...snapshot, startedAt: "different-generation", descendants: [] }],
          }),
        ).toBe("already-exited");
        expect(isProcessRunning(unrelated.pid!)).toBe(true);
      } finally {
        const exit = new Promise<void>((resolve) => unrelated.once("exit", () => resolve()));
        unrelated.kill("SIGKILL");
        await exit;
      }
    },
  );

  test.runIf(process.platform === "win32")(
    "kills Windows descendants through taskkill tree cleanup",
    async () => {
      tempDir = await mkdtemp(join(tmpdir(), "paseo-server-tree-kill-"));
      const childPidPath = join(tempDir, "descendant.pid");

      ownerProcess = spawnOwnerWithDescendant({
        childPidPath,
        detachedDescendant: false,
      });
      expect(ownerProcess.pid).toBeTypeOf("number");
      await waitForFixtureReady(childPidPath);

      const result = await terminateWithTreeKill(ownerProcess, {
        gracefulTimeoutMs: 2000,
        forceTimeoutMs: 2000,
      });

      // tree-kill uses taskkill /T /F on Windows, so the first signal is already forceful.
      expect(result).toBe("terminated");
      await expectOwnerAndDescendantStopped(
        "owner or Windows descendant survived terminateWithTreeKill",
      );
    },
  );

  test.runIf(process.platform !== "win32")(
    "force-kills descendants that started their own process group",
    async () => {
      tempDir = await mkdtemp(join(tmpdir(), "paseo-server-tree-kill-"));
      const childPidPath = join(tempDir, "descendant.pid");

      ownerProcess = spawnOwnerWithDescendant({
        childPidPath,
        detachedDescendant: true,
      });
      expect(ownerProcess.pid).toBeTypeOf("number");
      await waitForFixtureReady(childPidPath);

      const result = await terminateWithTreeKill(ownerProcess, {
        gracefulTimeoutMs: 100,
        forceTimeoutMs: 2000,
      });

      expect(result).toBe("killed");
      await expectOwnerAndDescendantStopped(
        "owner or separate-process-group descendant survived terminateWithTreeKill",
      );
    },
  );
});
