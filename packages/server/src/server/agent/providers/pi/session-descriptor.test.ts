import { mkdtemp, mkdir, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, vi } from "vitest";

import { listPiImportableSessions, readPiImportSessionConfig } from "./session-descriptor.js";

const openedSessionFiles = vi.hoisted(() => new Map<string, number>());
const observedScan = vi.hoisted(() => ({
  fileStats: new Map<string, number>(),
  activeStats: 0,
  peakStats: 0,
  activeDirectories: 0,
  peakDirectories: 0,
}));

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
    stat: async (...args: Parameters<typeof fs.stat>) => {
      const file = args[0];
      if (typeof file === "string" && file.endsWith(".jsonl")) {
        observedScan.fileStats.set(file, (observedScan.fileStats.get(file) ?? 0) + 1);
      }
      observedScan.activeStats += 1;
      observedScan.peakStats = Math.max(observedScan.peakStats, observedScan.activeStats);
      try {
        return await fs.stat(...args);
      } finally {
        observedScan.activeStats -= 1;
      }
    },
    readdir: async (...args: Parameters<typeof fs.readdir>) => {
      observedScan.activeDirectories += 1;
      observedScan.peakDirectories = Math.max(
        observedScan.peakDirectories,
        observedScan.activeDirectories,
      );
      try {
        return await fs.readdir(...args);
      } finally {
        observedScan.activeDirectories -= 1;
      }
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
  observedScan.fileStats.clear();
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
  expect(observedScan.fileStats.get(unrelatedFile)).toBe(1);
  expect(observedScan.fileStats.get(requestedFile)).toBe(1);
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

  observedScan.peakStats = 0;
  await expect(
    listPiImportableSessions({ sessionDir: sessionsDir, cwd: requestedCwd, limit: 1 }),
  ).resolves.toEqual([
    expect.objectContaining({ providerHandleId: requestedFile, cwd: requestedCwd }),
  ]);
  expect(observedScan.peakStats).toBeLessThanOrEqual(32);
});

test("Pi scans nested and mismatched project folders in custom session roots", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-layout-"));
  const sessionsDir = path.join(root, "custom-sessions");
  const requestedCwd = path.join(root, "requested");
  const otherCwd = path.join(root, "other");
  const requestedFiles = [
    path.join(sessionsDir, "--requested--", "requested.jsonl"),
    path.join(sessionsDir, "--other--", "nested", "relocated.jsonl"),
  ];
  const otherFile = path.join(sessionsDir, "--other--", "unrelated.jsonl");
  const files = [...requestedFiles, otherFile];
  const cwds = [requestedCwd, requestedCwd, otherCwd];
  for (const [index, file] of files.entries()) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `${JSON.stringify({
        type: "session",
        id: `session-${index}`,
        cwd: cwds[index],
      })}\n`,
    );
    const time = new Date(2026, 5, index + 1);
    await utimes(file, time, time);
  }

  const scoped = await listPiImportableSessions({
    sessionDir: sessionsDir,
    cwd: requestedCwd,
    limit: 2,
  });
  expect(scoped.map((session) => session.providerHandleId)).toEqual([
    requestedFiles[1],
    requestedFiles[0],
  ]);
  expect(scoped[0]?.lastActivityAt).toEqual(new Date(2026, 5, 2));

  const hostWide = await listPiImportableSessions({ sessionDir: sessionsDir, limit: 3 });
  expect(hostWide.map((session) => session.providerHandleId)).toEqual([
    otherFile,
    requestedFiles[1],
    requestedFiles[0],
  ]);

  const configured = await listPiImportableSessions({
    cwd: requestedCwd,
    homeDir: root,
    env: { PI_CODING_AGENT_SESSION_DIR: sessionsDir },
    limit: 2,
  });
  expect(configured.map((session) => session.providerHandleId)).toEqual([
    requestedFiles[1],
    requestedFiles[0],
  ]);
});

test("Pi directory discovery keeps concurrent readdir operations bounded", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-directories-"));
  const sessionsDir = path.join(root, "sessions");
  const cwd = path.join(root, "repo");
  for (let index = 0; index < 40; index += 1) {
    const directory = path.join(sessionsDir, `project-${index}`);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, `session-${index}.jsonl`),
      `${JSON.stringify({
        type: "session",
        id: `session-${index}`,
        timestamp: "2026-06-01T00:00:00.000Z",
        cwd,
      })}\n`,
    );
  }

  observedScan.peakDirectories = 0;
  observedScan.peakStats = 0;
  const sessions = await listPiImportableSessions({ sessionDir: sessionsDir, limit: 1 });
  expect(sessions).toHaveLength(1);
  expect(observedScan.peakDirectories).toBeLessThanOrEqual(16);
  expect(observedScan.peakStats).toBeLessThanOrEqual(32);
});

test("Pi search matches title, prompt previews and cwd names during scanning", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-search-fields-"));
  const sessionDir = path.join(root, "sessions");
  await mkdir(sessionDir);
  const records = [
    { id: "title", cwd: path.join(root, "plain"), title: "Needle title", prompt: "other" },
    { id: "first", cwd: path.join(root, "plain"), title: null, prompt: "Needle first prompt" },
    { id: "last", cwd: path.join(root, "plain"), title: null, prompt: "other", last: "Needle final" },
    { id: "cwd", cwd: path.join(root, "needle-project"), title: null, prompt: "other" },
    { id: "unrelated", cwd: path.join(root, "plain"), title: "Unrelated", prompt: "other" },
  ];
  for (const [index, record] of records.entries()) {
    const messages = [
      { type: "session", id: record.id, cwd: record.cwd, timestamp: "2026-06-01T00:00:00Z" },
      ...(record.title ? [{ type: "session_info", name: record.title }] : []),
      {
        type: "message",
        timestamp: "2026-06-01T00:00:01Z",
        message: { role: "user", content: record.prompt },
      },
      ...(record.last
        ? [{ type: "message", timestamp: "2026-06-01T00:00:02Z", message: { role: "user", content: record.last } }]
        : []),
    ];
    const file = path.join(sessionDir, `${record.id}.jsonl`);
    await writeFile(file, `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`);
    await utimes(file, new Date(2026, 5, index + 1), new Date(2026, 5, index + 1));
  }

  const matches = await listPiImportableSessions({
    sessionDir,
    query: "NEEDLE",
    limit: 10,
    scanLimit: 2,
  });
  expect(matches.map((session) => path.basename(session.providerHandleId)).sort()).toEqual([
    "cwd.jsonl", "first.jsonl", "last.jsonl", "title.jsonl",
  ]);
});

test("Pi search finds an older match beyond 500 newer unrelated sessions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "paseo-pi-session-search-older-"));
  const sessionDir = path.join(root, "sessions");
  await mkdir(sessionDir);
  const matchingFile = path.join(sessionDir, "older-match.jsonl");
  await writeFile(
    matchingFile,
    `${JSON.stringify({ type: "session", id: "older", cwd: root, timestamp: "2026-01-01T00:00:00Z" })}\n${JSON.stringify({ type: "session_info", name: "Important needle" })}\n`,
  );
  await utimes(matchingFile, new Date("2026-01-01"), new Date("2026-01-01"));
  await Promise.all(
    Array.from({ length: 510 }, async (_, index) => {
      const file = path.join(sessionDir, `recent-${index}.jsonl`);
      await writeFile(
        file,
        `${JSON.stringify({ type: "session", id: `recent-${index}`, cwd: root, timestamp: "2026-06-01T00:00:00Z" })}\n`,
      );
      await utimes(file, new Date("2026-06-01"), new Date("2026-06-01"));
    }),
  );

  const sessions = await listPiImportableSessions({
    sessionDir,
    query: "needle",
    limit: 1,
    scanLimit: 500,
  });
  expect(sessions.map((session) => session.providerHandleId)).toEqual([matchingFile]);
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
