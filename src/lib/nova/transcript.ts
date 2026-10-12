import type {
  BetaContentBlockParam,
  BetaMessageParam,
} from "@anthropic-ai/sdk/resources/beta/messages";

// Turns the stored API messages into what the chat shows: the user's messages,
// and Nova's replies as text with a chip for each change it made.

export type ChatPart =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; summary: string; goalId?: string; isError: boolean; pending?: boolean };

export type ChatItem =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "nova"; parts: ChatPart[] };

type StoredMessage = { id: string } & Pick<BetaMessageParam, "role" | "content">;

export function toChatItems(messages: StoredMessage[]): ChatItem[] {
  const results = new Map<string, { content: string; isError: boolean }>();
  for (const message of messages) {
    for (const block of blocksOf(message)) {
      if (block.type === "tool_result") {
        results.set(block.tool_use_id, {
          content: typeof block.content === "string" ? block.content : "",
          isError: Boolean(block.is_error),
        });
      }
    }
  }

  const items: ChatItem[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      const text = blocksOf(message)
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      if (text) items.push({ id: message.id, role: "user", text });
      continue;
    }

    let nova = items.at(-1);
    if (!nova || nova.role !== "nova") {
      nova = { id: message.id, role: "nova", parts: [] };
      items.push(nova);
    }
    for (const block of blocksOf(message)) {
      if (block.type === "text" && block.text.trim()) {
        nova.parts = appendText(nova.parts, block.text, "\n\n");
      } else if (block.type === "tool_use") {
        nova.parts.push({ kind: "tool", id: block.id, ...describeResult(results.get(block.id)) });
      }
    }
  }
  return items.filter((item) => item.role === "user" || item.parts.length > 0);
}

/** Adds text to the last text part, or starts a new one after a tool chip. */
export function appendText(parts: ChatPart[], text: string, separator = ""): ChatPart[] {
  const last = parts.at(-1);
  if (last?.kind === "text") {
    return [...parts.slice(0, -1), { kind: "text", text: last.text + separator + text }];
  }
  return [...parts, { kind: "text", text }];
}

function describeResult(result: { content: string; isError: boolean } | undefined) {
  if (!result) return { summary: "Change interrupted", isError: true };
  if (result.isError) return { summary: result.content, isError: true };
  try {
    const data = JSON.parse(result.content) as { summary?: string; goal?: { id?: string } };
    return { summary: data.summary ?? "Done", goalId: data.goal?.id, isError: false };
  } catch {
    return { summary: "Done", isError: false };
  }
}

function blocksOf(message: Pick<BetaMessageParam, "content">): BetaContentBlockParam[] {
  return typeof message.content === "string"
    ? [{ type: "text", text: message.content }]
    : message.content;
}
