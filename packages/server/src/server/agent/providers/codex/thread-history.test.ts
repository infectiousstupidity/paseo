import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { describe, expect, test } from "vitest";

import { createTestLogger } from "../../../../test-utils/test-logger.js";
import { CodexAppServerAgentClient } from "../codex-app-server-agent.js";
import { CodexAppServerResponseTooLargeError } from "./app-server-transport.js";
import { CodexThreadHistoryTooLargeError, readCodexThreadHistory } from "./thread-history.js";
import {
  createFakeCodexAppServer,
  fakeCodexThreadHistory,
  type FakeCodexAppServer,
  type FakeCodexHistoryThread,
} from "./test-utils/fake-app-server.js";

function user(id: string, text: string) {
  return { type: "userMessage", id, content: [{ type: "text", text }] };
}
function assistant(id: string, text: string) {
  return { type: "agentMessage", id, text };
}

async function open(thread: FakeCodexHistoryThread) {
  const appServer = createFakeCodexAppServer(fakeCodexThreadHistory({ "saved-thread": thread }));
  const provider = new CodexAppServerAgentClient(createTestLogger());
  const internals = provider as unknown as {
    goalsEnabledPromise: Promise<boolean> | null;
    autoReviewEnabledPromise: Promise<boolean> | null;
    spawnAppServer: () => Promise<ChildProcessWithoutNullStreams>;
  };
  internals.goalsEnabledPromise = Promise.resolve(false);
  internals.autoReviewEnabledPromise = Promise.resolve(false);
  internals.spawnAppServer = async () => appServer.child;
  const session = await provider.resumeSession({ sessionId: "saved-thread" });
  return { session, appServer };
}

async function timeline(session: Awaited<ReturnType<typeof open>>["session"]) {
  const items: unknown[] = [];
  for await (const event of session.streamHistory()) {
    if (event.type === "timeline") items.push(event.item);
  }
  return items;
}

function readRequests(appServer: FakeCodexAppServer) {
  return appServer.requests().filter((r) =>
    r.method === "thread/read" || r.method === "thread/items/list",
  );
}

describe("Codex paginated history", () => {
  test("reopening a resumed Codex session does not request or retain its transcript", async () => {
    const { session, appServer } = await open({
      historyMode: "paginated",
      turns: [{ id: "turn-1", items: [user("u1", "Hello"), assistant("a1", "Hi")] }],
    });
    try {
      expect(readRequests(appServer)).toEqual([]);
      const resumes = appServer.requests().filter((r) => r.method === "thread/resume");
      expect(resumes).toHaveLength(1);
      expect(resumes[0]?.params).toMatchObject({ threadId: "saved-thread", excludeTurns: true });
      expect(await timeline(session)).toEqual([
        { type: "user_message", text: "Hello", messageId: "u1" },
        { type: "assistant_message", text: "Hi", messageId: "a1" },
      ]);
      expect(readRequests(appServer).map((r) => r.method)).toEqual([
        "thread/read", "thread/items/list",
      ]);
    } finally {
      await session.close();
    }
    appServer.assertNoErrors();
  });

  test("reads over 100 items in ascending paginated pages with native turn IDs", async () => {
    const answers = Array.from({ length: 151 }, (_, i) => assistant(`a${i}`, `Answer ${i}`));
    const { session, appServer } = await open({
      historyMode: "paginated",
      turns: [
        { id: "turn-1", items: [user("u1", "First"), ...answers.slice(0, 120)] },
        { id: "turn-2", items: [user("u2", "Second"), ...answers.slice(120)] },
      ],
    });
    try {
      const messages = await timeline(session);
      expect(messages).toHaveLength(153);
      expect(messages[0]).toMatchObject({ messageId: "u1" });
      expect(messages[121]).toMatchObject({ messageId: "u2" });
      expect(messages[152]).toMatchObject({ messageId: "a150" });
      const pages = readRequests(appServer).filter((r) => r.method === "thread/items/list");
      expect(pages).toHaveLength(2);
      expect(pages[0]?.params).toMatchObject({
        threadId: "saved-thread", limit: 100, sortDirection: "asc",
      });
      expect(pages[1]?.params).toMatchObject({ cursor: "cursor-100" });
    } finally {
      await session.close();
    }
    appServer.assertNoErrors();
  });

  test("legacy threads still use thread/read and never request pages", async () => {
    const { session, appServer } = await open({
      turns: [{ id: "old-turn", items: [user("u1", "Old"), assistant("a1", "Reply")] }],
    });
    try {
      expect(await timeline(session)).toHaveLength(2);
      expect(readRequests(appServer).map((r) => r.method)).toEqual([
        "thread/read", "thread/read",
      ]);
      const last = readRequests(appServer).at(-1);
      expect(last?.params).toMatchObject({ includeTurns: true });
    } finally {
      await session.close();
    }
    appServer.assertNoErrors();
  });

  test("a too-large page fails as a recoverable history error", async () => {
    const client = {
      async request(method: string, params?: unknown) {
        if (method === "thread/read") return { thread: { historyMode: "paginated" } };
        if (method === "thread/items/list")
          throw new CodexAppServerResponseTooLargeError(method, 128 * 1024 * 1024);
        throw new Error("unexpected request");
      },
    };
    const read = async () => {
      for await (const _row of readCodexThreadHistory(client, "saved-thread")) {
        // Collect until the oversized page is reached.
      }
    };
    await expect(read()).rejects.toBeInstanceOf(CodexThreadHistoryTooLargeError);
    await expect(read()).rejects.toThrow("rest of this Codex thread");
  });

  test("rejects a repeating pagination cursor", async () => {
    const client = {
      async request(method: string) {
        if (method === "thread/read") return { thread: { historyMode: "paginated" } };
        return { data: [], nextCursor: "repeated" };
      },
    };
    const read = async () => {
      for await (const _row of readCodexThreadHistory(client, "saved-thread")) {
        // Detect a cursor that never advances.
      }
    };
    await expect(read()).rejects.toThrow("repeated history cursor");
  });
});
