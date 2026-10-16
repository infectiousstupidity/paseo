import type { StreamItem } from "@/types/stream";

/** Submitted prompts from the currently loaded session timeline, oldest first. */
export function getPromptHistory(tail: readonly StreamItem[], head: readonly StreamItem[]): string[] {
  const prompts: string[] = [];
  const seen = new Set<string>();
  for (const item of [...tail, ...head]) {
    if (item.kind !== "user_message" || !item.text.trim()) continue;
    // The optimistic row and its canonical replacement may coexist while reconciling.
    const id = item.clientMessageId ?? item.messageId ?? item.id;
    if (seen.has(id)) continue;
    seen.add(id);
    prompts.push(item.text);
  }
  return prompts;
}

export interface PromptHistoryCursor {
  index: number;
  draft: string;
  shown: string;
}

export function navigatePromptHistory(input: {
  direction: "ArrowUp" | "ArrowDown";
  history: readonly string[];
  text: string;
  selection: { start: number; end: number };
  cursor: PromptHistoryCursor | null;
}): { text: string; cursor: PromptHistoryCursor | null } | null {
  const { direction, history, text, selection, cursor } = input;
  if (history.length === 0) return null;

  // When browsing, keep cycling at the end of the recalled prompt. Once the user
  // edits or moves the caret, let the editor handle arrows normally again.
  const continuing =
    cursor !== null &&
    cursor.shown === text &&
    selection.start === text.length &&
    selection.end === text.length;

  // Start only with Up at the very beginning of the input, so multiline editing
  // and Down in an ordinary draft continue to work as before.
  if (!continuing && (direction !== "ArrowUp" || selection.start !== 0 || selection.end !== 0)) {
    return null;
  }

  const index = continuing
    ? direction === "ArrowUp"
      ? Math.max(0, cursor.index - 1)
      : cursor.index + 1
    : history.length - 1;

  if (index === history.length) {
    return { text: cursor!.draft, cursor: null };
  }

  const nextText = history[index];
  return {
    text: nextText,
    cursor: { index, draft: continuing ? cursor.draft : text, shown: nextText },
  };
}
