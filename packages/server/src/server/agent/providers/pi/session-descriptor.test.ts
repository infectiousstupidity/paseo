import { mkdtemp, mkdir, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, vi } from "vitest";

import { listPiImportableSessions, readPiImportSessionConfig } from "./session-descriptor.js";

const openedSessionFiles = vi.hoisted(() => new Map<string, number>());

vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...fs,
    open: async (...args: Parameters<typeof fs.open>) => {
      const file = args[0];
      if (typeof file === "string" && file.endsWith(".jsonl")) {
        openedSessionFiles.set(file, (openedSessionFiles.get(file) ?? 0) + 1);
      }
      return fs.open(...args);
    },
  };
});

async function writeSession(root: string, lines: unknown[]): Promise<string> {
  const sessionsDir = path.join(root, "sessions", "project");
  await mkdir(sessionsDir, { recursive: true });
  const filePath = path.join(sessionsDir, "2026-06-09T00-00-00-000Z_session.jsonl");
  await writeFile(filePath, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
  return filePath;
}

test("Pi scoped listing skips transcript tails for unrelated sessions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-prefilter-"));
  const sessionsDir = path.join(root, "sessions");
  const requestedCwd = path.join(root, "requested");
  const otherCwd = path.join(root, "other");
  const requestedFile = path.join(sessionsDir, "requested.jsonl");
  const unrelatedFile = path.join(sessionsDir, "unrelated.jsonl");
  await mkdir(sessionsDir, { recursive: true });

  const requestedLines = [
    { type: "session", id: "requested", timestamp: "2026-06-01T00:00:00.000Z", cwd: requestedCwd },
    { type: "session_info", name: "Requested session" },
    {
      type: "message",
      timestamp: "2026-06-01T00:00:01.000Z",
      message: { role: "user", content: "First prompt" },
    },
  ];
  await writeFile(
    requestedFile,
    `${requestedLines.map((line) => JSON.stringify(line)).join("\n")}\n`,
  );
  const unrelatedHeader = {
    type: "session",
    id: "unrelated",
    timestamp: "2026-06-02T00:00:00.000Z",
    cwd: otherCwd,
  };
  await writeFile(unrelatedFile, `${JSON.stringify(unrelatedHeader)}\n${" ".repeat(300_000)}\n`);

  openedSessionFiles.clear();
  const sessions = await listPiImportableSessions({
    sessionDir: sessionsDir,
    cwd: requestedCwd,
    limit: 1,
  });

  expect(sessions).toMatchObject([
    {
      providerHandleId: requestedFile,
      cwd: requestedCwd,
      title: "Requested session",
      firstPromptPreview: "First prompt",
      lastPromptPreview: "First prompt",
      lastActivityAt: new Date("2026-06-01T00:00:01.000Z"),
    },
  ]);
  expect(openedSessionFiles.get(unrelatedFile)).toBe(1);
  expect(openedSessionFiles.get(requestedFile)).toBe(2);
});

test("Pi scoped listing accepts a symlink-equivalent session cwd", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-path-alias-"));
  const realCwd = path.join(root, "real-cwd");
  const aliasCwd = path.join(root, "alias-cwd");
  const sessionsDir = path.join(root, "sessions");
  const sessionFile = path.join(sessionsDir, "alias.jsonl");
  await mkdir(realCwd, { recursive: true });
  await symlink(realCwd, aliasCwd, process.platform === "win32" ? "junction" : "dir");
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(
    sessionFile,
    `${JSON.stringify({
      type: "session",
      id: "alias",
      timestamp: "2026-06-01T00:00:00.000Z",
      cwd: aliasCwd,
    })}\n`,
  );

  const sessions = await listPiImportableSessions({
    sessionDir: sessionsDir,
    cwd: realCwd,
    limit: 1,
  });
  expect(sessions).toMatchObject([{ providerHandleId: sessionFile, cwd: aliasCwd }]);
});

test("Pi cwd filtering continues past the global candidate overscan", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-cwd-limit-"));
  const sessionsDir = path.join(root, "sessions");
  const requestedCwd = path.join(root, "requested");
  const otherCwd = path.join(root, "other");
  const requestedFile = path.join(sessionsDir, "requested", "requested.jsonl");
  await mkdir(path.dirname(requestedFile), { recursive: true });
  await writeFile(
    requestedFile,
    `${JSON.stringify({
      type: "session",
      version: 3,
      id: "requested-session",
      timestamp: "2026-06-01T00:00:00.000Z",
      cwd: requestedCwd,
    })}\n`,
    "utf8",
  );
  await utimes(requestedFile, new Date("2026-06-01"), new Date("2026-06-01"));

  await Promise.all(
    Array.from({ length: 400 }, async (_, index) => {
      const file = path.join(sessionsDir, "other", `${index}.jsonl`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(
        file,
        `${JSON.stringify({
          type: "session",
          version: 3,
          id: `other-${index}`,
          timestamp: "2026-06-02T00:00:00.000Z",
          cwd: otherCwd,
        })}\n`,
        "utf8",
      );
      await utimes(file, new Date("2026-06-02"), new Date("2026-06-02"));
    }),
  );

  await expect(
    listPiImportableSessions({ sessionDir: sessionsDir, cwd: requestedCwd, limit: 1 }),
  ).resolves.toEqual([
    expect.objectContaining({ providerHandleId: requestedFile, cwd: requestedCwd }),
  ]);
});

test("Pi import config preserves the latest recorded model and thinking level", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-model-"));
  const cwd = path.join(root, "repo");
  const sessionFile = await writeSession(root, [
    {
      type: "session",
      version: 3,
      id: "session-1",
      timestamp: "2026-06-09T00:00:00.000Z",
      cwd,
    },
    {
      type: "model_change",
      id: "model-1",
      timestamp: "2026-06-09T00:00:01.000Z",
      provider: "openai-codex",
      modelId: "gpt-5.1",
    },
    {
      type: "thinking_level_change",
      id: "thinking-1",
      timestamp: "2026-06-09T00:00:01.500Z",
      thinkingLevel: "low",
    },
    {
      type: "message",
      id: "user-1",
      timestamp: "2026-06-09T00:00:02.000Z",
      message: {
        role: "user",
        content: [{ type: "text", text: "hello" }],
      },
    },
    {
      type: "model_change",
      id: "model-2",
      timestamp: "2026-06-09T00:00:03.000Z",
      provider: "openrouter",
      modelId: "anthropic/claude-sonnet-4.5",
    },
    {
      type: "thinking_level_change",
      id: "thinking-2",
      timestamp: "2026-06-09T00:00:04.000Z",
      thinkingLevel: "high",
    },
  ]);

  const [descriptor] = await listPiImportableSessions({ sessionDir: path.join(root, "sessions") });
  const importConfig = await readPiImportSessionConfig(sessionFile);

  expect(descriptor).toMatchObject({
    providerHandleId: sessionFile,
    cwd,
    firstPromptPreview: "hello",
  });
  expect(importConfig).toEqual({
    model: "openrouter/anthropic/claude-sonnet-4.5",
    thinkingOptionId: "high",
  });
});

test("Pi import config can infer model from assistant messages", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-message-model-"));
  const cwd = path.join(root, "repo");
  const sessionFile = await writeSession(root, [
    {
      type: "session",
      version: 3,
      id: "session-2",
      timestamp: "2026-06-09T00:00:00.000Z",
      cwd,
    },
    {
      type: "message",
      id: "user-1",
      timestamp: "2026-06-09T00:00:01.000Z",
      message: {
        role: "user",
        content: [{ type: "text", text: "hello" }],
      },
    },
    {
      type: "message",
      id: "assistant-1",
      timestamp: "2026-06-09T00:00:02.000Z",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        provider: "google",
        model: "gemini-2.5-pro",
      },
    },
  ]);

  const importConfig = await readPiImportSessionConfig(sessionFile);

  expect(importConfig).toEqual({
    model: "google/gemini-2.5-pro",
  });
});

test("Pi import config preserves thinking before a later model in large sessions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-large-thinking-"));
  const cwd = path.join(root, "repo");
  const fillerMessages = Array.from({ length: 2_100 }, (_, index) => ({
    type: "message",
    id: `filler-${index}`,
    timestamp: `2026-06-09T00:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
    message: {
      role: "assistant",
      content: [{ type: "text", text: `filler ${index}` }],
    },
  }));
  const sessionFile = await writeSession(root, [
    {
      type: "session",
      version: 3,
      id: "session-3",
      timestamp: "2026-06-09T00:00:00.000Z",
      cwd,
    },
    {
      type: "message",
      id: "user-1",
      timestamp: "2026-06-09T00:00:01.000Z",
      message: { role: "user", content: "hello" },
    },
    ...fillerMessages,
    {
      type: "thinking_level_change",
      id: "thinking-1",
      timestamp: "2026-06-09T01:00:00.000Z",
      thinkingLevel: "low",
    },
    {
      type: "model_change",
      id: "model-1",
      timestamp: "2026-06-09T01:00:01.000Z",
      provider: "openrouter",
      modelId: "google/gemini-2.5-pro",
    },
    {
      type: "session_info",
      id: "info-1",
      timestamp: "2026-06-09T01:00:02.000Z",
      name: "large session",
    },
  ]);

  const importConfig = await readPiImportSessionConfig(sessionFile);

  expect(importConfig).toEqual({
    model: "openrouter/google/gemini-2.5-pro",
    thinkingOptionId: "low",
  });
});
