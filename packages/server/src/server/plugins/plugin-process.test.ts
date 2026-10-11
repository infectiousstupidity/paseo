import { fork } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, it } from "vitest";

it("keeps React out of the plugin host's runtime dependency graph", async () => {
  await expect(
    build({
      entryPoints: [
        fileURLToPath(new URL("./plugin-process.ts", import.meta.url)),
        "@getpaseo/plugin",
        "@getpaseo/plugin/server",
        "@getpaseo/plugin/server/provider",
        "@getpaseo/plugin/server/acp",
      ],
      outdir: "unused",
      conditions: ["source"],
      bundle: true,
      platform: "node",
      format: "esm",
      // Node evaluates re-exports even when the host only imports one helper.
      treeShaking: false,
      write: false,
      logLevel: "silent",
      plugins: [
        {
          name: "no-react",
          setup(context) {
            context.onResolve(
              { filter: /^(react|react-dom|react-native|use-sync-external-store)(\/|$)/ },
              ({ path, importer }) => ({
                errors: [{ text: `React dependency ${path} imported by ${importer}` }],
              }),
            );
          },
        },
      ],
    }),
  ).resolves.toMatchObject({ errors: [] });
});

it("exits cleanly when a plugin result races parent IPC disconnect", async () => {
  const directory = await mkdtemp(join(tmpdir(), "paseo-plugin-ipc-close-"));
  const entered = join(directory, "entered");
  const release = join(directory, "release");
  const child = fork(fileURLToPath(new URL("./plugin-process.ts", import.meta.url)), [], {
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let stderr = "";
  child.stderr!.on("data", (data) => {
    stderr += String(data);
  });
  const exited = once(child, "exit");
  let exitTimeout: NodeJS.Timeout | undefined;
  try {
    child.send({
      type: "initialize",
      pluginId: "ipc-close",
      pluginDirectory: directory,
      appVersion: "0.11.2",
      bundle: `(require) => {
        const fs = require("node:fs");
        fs.writeFileSync(${JSON.stringify(entered)}, "ready");
        while (!fs.existsSync(${JSON.stringify(release)})) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        }
        throw new Error("Expected initialization failure");
      }`,
    });
    await expect.poll(() => existsSync(entered), { timeout: 10_000 }).toBe(true);
    const disconnected = once(child, "disconnect");
    child.disconnect();
    await disconnected;
    await writeFile(release, "continue");
    const exitDeadline = new Promise<never>((_, reject) => {
      exitTimeout = setTimeout(() => reject(new Error("Plugin child did not exit")), 10_000);
    });
    expect(await Promise.race([exited, exitDeadline])).toEqual([0, null]);
    expect(stderr).not.toContain("ERR_IPC_CHANNEL_CLOSED");
  } finally {
    if (exitTimeout) clearTimeout(exitTimeout);
    child.kill("SIGKILL");
    await exited;
    await rm(directory, { recursive: true, force: true });
  }
});

it("exposes CLI probes through the plugin host's server SDK", async () => {
  const { evaluateBundle } = await import("./bundle-evaluator.js");
  const setup = evaluateBundle(`(require) => ({ default: async () => {
    const { execCommand } = require("@getpaseo/plugin/server");
    const { stdout } = await execCommand(${JSON.stringify(process.execPath)}, ["-e", "process.stdout.write('plugin CLI ready')"]);
    if (stdout !== "plugin CLI ready") throw new Error("CLI output was lost");
  } })`);
  // This contribution uses no server context APIs; it exercises the host's real SDK binding.
  await expect(setup(undefined as never)).resolves.toBeUndefined();
});
