import { describe, expect, it } from "vitest";
import type { UserMessageItem, StreamItem } from "@/types/stream";
import { getPromptHistory, navigatePromptHistory, type PromptHistoryCursor } from "./prompt-history";

const user = (id: string, text: string, clientMessageId?: string): UserMessageItem => ({
  kind: "user_message",
  id,
  text,
  timestamp: new Date("2026-01-01"),
  ...(clientMessageId ? { clientMessageId } : {}),
});

function navigate(
  direction: "ArrowUp" | "ArrowDown",
  text: string,
  cursor: PromptHistoryCursor | null,
  selection = { start: text.length, end: text.length },
) {
  return navigatePromptHistory({
    direction,
    history: ["Say Hi", "Check the tests", "Summarize\nchanges"],
    text,
    cursor,
    selection,
  });
}

describe("prompt history", () => {
  it("reads only user prompts from this session and avoids optimistic/canonical duplicates", () => {
    const assistant = { kind: "assistant_message", id: "reply" } as StreamItem;
    expect(
      getPromptHistory(
        [user("one", "Say Hi", "client-1"), assistant, user("blank", "   ")],
        [user("canonical-1", "Say Hi", "client-1"), user("two", "Check the tests")],
      ),
    ).toEqual(["Say Hi", "Check the tests"]);
  });

  it("recalls older prompts without submitting and restores an unsent draft on Down", () => {
    const latest = navigate("ArrowUp", "unsent work", null, { start: 0, end: 0 });
    expect(latest?.text).toBe("Summarize\nchanges");
    const older = navigate("ArrowUp", latest!.text, latest!.cursor);
    expect(older?.text).toBe("Check the tests");
    expect(navigate("ArrowUp", older!.text, older!.cursor)?.text).toBe("Say Hi");
    const next = navigate("ArrowDown", older!.text, older!.cursor);
    expect(next?.text).toBe("Summarize\nchanges");
    expect(navigate("ArrowDown", next!.text, next!.cursor)).toEqual({
      text: "unsent work",
      cursor: null,
    });
  });

  it("does not take arrow keys from multiline editing or selections", () => {
    expect(navigate("ArrowUp", "first\nsecond", null)).toBeNull();
    expect(navigate("ArrowUp", "selected", null, { start: 0, end: 3 })).toBeNull();
    expect(navigate("ArrowDown", "", null)).toBeNull();
    const latest = navigate("ArrowUp", "", null);
    expect(navigate("ArrowUp", latest!.text, latest!.cursor, { start: 4, end: 4 })).toBeNull();
    expect(navigate("ArrowUp", latest!.text + " edited", latest!.cursor)).toBeNull();
  });

  it("stays at the oldest prompt and does nothing when history is empty", () => {
    const oldest: PromptHistoryCursor = { index: 0, draft: "", shown: "Say Hi" };
    expect(navigate("ArrowUp", "Say Hi", oldest)).toEqual({
      text: "Say Hi",
      cursor: oldest,
    });
    expect(
      navigatePromptHistory({
        direction: "ArrowUp",
        history: [],
        text: "",
        selection: { start: 0, end: 0 },
        cursor: null,
      }),
    ).toBeNull();
  });
});
