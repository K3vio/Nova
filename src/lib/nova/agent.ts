import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages";
import {
  appendMessages,
  createConversation,
  deleteConversation,
  getConversation,
  removeMessagesFrom,
} from "@/lib/conversations";
import { todayISO } from "@/lib/dates";
import { listGoalsWithSteps } from "@/lib/goals";
import { getAnthropicClient, hasApiCredentials, NOVA_MODEL } from "./client";
import { buildSnapshot } from "./snapshot";
import { NOVA_SYSTEM_PROMPT } from "./system-prompt";
import { NOVA_TOOLS, runTool } from "./tools";

/** Streamed to the browser as newline-delimited JSON. */
export type NovaEvent =
  // Sent at the end of the first turn of a new conversation.
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_result"; id: string; summary: string; goalId?: string; isError: boolean }
  | { type: "error"; message: string }
  | { type: "done"; changed: boolean };

/** Upper bound on model calls in one turn, so a confused loop can't run up costs. */
const MAX_MODEL_CALLS = 10;

export const NOT_CONNECTED_MESSAGE =
  "Nova isn't connected to Claude yet. Add ANTHROPIC_API_KEY=… to .env.local and restart the app.";

class RefusalError extends Error {}
class TruncatedError extends Error {}

export async function runNovaTurn({
  conversationId,
  message,
  emit,
  signal,
  client,
  now = new Date(),
}: {
  conversationId: string | null;
  message: string;
  emit: (event: NovaEvent) => void;
  signal?: AbortSignal;
  client?: Anthropic;
  now?: Date;
}): Promise<void> {
  if (!client && !hasApiCredentials()) {
    emit({ type: "error", message: NOT_CONNECTED_MESSAGE });
    emit({ type: "done", changed: false });
    return;
  }
  const anthropic = client ?? getAnthropicClient();

  let id: string;
  let history: BetaMessageParam[];
  let newConversation: { id: string; title: string } | null = null;
  if (conversationId) {
    const found = await getConversation(conversationId);
    if (!found) {
      emit({ type: "error", message: "That conversation no longer exists." });
      emit({ type: "done", changed: false });
      return;
    }
    id = conversationId;
    history = found.messages.map((m) => ({ role: m.role, content: m.content }));
  } else {
    newConversation = await createConversation(message);
    id = newConversation.id;
    history = [];
  }

  // Tell Nova the date and the goals whenever they changed since it last saw them.
  const snapshot = buildSnapshot(await listGoalsWithSteps(), todayISO(now));
  const lastSnapshot = history.findLast((m) => m.role === "system")?.content;
  const turn: BetaMessageParam[] = [{ role: "user", content: [{ type: "text", text: message }] }];
  if (snapshot !== lastSnapshot) turn.push({ role: "system", content: snapshot });

  const turnStart = await appendMessages(id, turn);
  const messages = [...history, ...turn];
  let saved = false;
  let changed = false;

  try {
    for (let call = 0; call < MAX_MODEL_CALLS; call++) {
      const response = await streamResponse(anthropic, messages, emit, signal);
      if (response.stop_reason === "refusal") throw new RefusalError();

      const content = echoableContent(response.content);
      const toolUses = content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");

      if (toolUses.length === 0) {
        if (content.length > 0) {
          await appendMessages(id, [{ role: "assistant", content }]);
          saved = true;
        }
        break;
      }
      // A tool input cut off by the token limit can still look valid; don't run it.
      if (response.stop_reason === "max_tokens") throw new TruncatedError();

      const results: BetaToolResultBlockParam[] = [];
      for (const block of toolUses) {
        const outcome = await runTool(block);
        results.push(outcome.result);
        changed ||= outcome.changed;
        emit({ type: "tool_result", id: block.id, ...outcome.display });
      }

      // Save the tool call and its results together so history never has one without the other.
      const step: BetaMessageParam[] = [
        { role: "assistant", content },
        { role: "user", content: results },
      ];
      await appendMessages(id, step);
      saved = true;
      messages.push(...step);

      if (call === MAX_MODEL_CALLS - 1) {
        emit({ type: "error", message: "Nova stopped after making a lot of changes in one go." });
      }
    }
  } catch (error) {
    // A turn that failed before Nova saved anything is removed so it can be retried cleanly.
    if (!saved) {
      if (newConversation) await deleteConversation(id);
      else await removeMessagesFrom(id, turnStart);
    }
    emit({ type: "error", message: describeError(error) });
  }
  if (newConversation && saved) {
    emit({ type: "conversation", id: newConversation.id, title: newConversation.title });
  }
  emit({ type: "done", changed });
}

async function streamResponse(
  client: Anthropic,
  messages: BetaMessageParam[],
  emit: (event: NovaEvent) => void,
  signal?: AbortSignal,
): Promise<BetaMessage> {
  const stream = client.beta.messages.stream(
    {
      model: NOVA_MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
      // If a safety classifier wrongly declines a request, retry it on another model.
      fallbacks: "default",
      // If the system prompt or tools change in a later version of Nova, older
      // conversations still work; they just lose Claude's earlier reasoning.
      thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: NOVA_SYSTEM_PROMPT }],
      tools: NOVA_TOOLS,
      messages: withCacheBreakpoint(messages),
    },
    { signal },
  );

  for await (const event of stream) {
    if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
      emit({ type: "tool_start", id: event.content_block.id, name: event.content_block.name });
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      emit({ type: "text", text: event.delta.text });
    }
  }
  return stream.finalMessage();
}

/**
 * Caches everything up to the newest user message, so each request only pays
 * full price for what's new. The marker is added per request, never stored.
 */
export function withCacheBreakpoint(messages: BetaMessageParam[]): BetaMessageParam[] {
  const index = messages.findLastIndex((m) => m.role === "user");
  if (index === -1) return messages;
  const target = messages[index];
  const blocks: BetaContentBlockParam[] =
    typeof target.content === "string" ? [{ type: "text", text: target.content }] : target.content;
  if (blocks.length === 0) return messages;
  const last = blocks[blocks.length - 1];
  const marked = {
    ...target,
    content: [...blocks.slice(0, -1), { ...last, cache_control: { type: "ephemeral" } }],
  } as BetaMessageParam;
  return [...messages.slice(0, index), marked, ...messages.slice(index + 1)];
}

/**
 * The response content to store and send back on later turns. If a fallback
 * model took over partway through, only the declined model's text is kept
 * from before the switch, as the API requires.
 */
export function echoableContent(content: BetaContentBlock[]): BetaContentBlockParam[] {
  const boundary = content.findLastIndex((b) => b.type === "fallback");
  return content.filter(
    (block, i) => block.type !== "fallback" && (i > boundary || block.type === "text"),
  ) as BetaContentBlockParam[];
}

function describeError(error: unknown): string {
  if (error instanceof RefusalError) return "Nova can't help with that request.";
  if (error instanceof TruncatedError) return "Nova's reply was cut off. Try asking for less at once.";
  if (error instanceof Anthropic.APIUserAbortError) return "Stopped.";
  if (error instanceof Anthropic.AuthenticationError) {
    return "Your Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local, then restart the app.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "Your Anthropic API key doesn't have access to Claude Opus 5.5.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Nova is being rate limited. Wait a minute and try again.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Anthropic. Check your internet connection and try again.";
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Claude API error", error);
    if (error.status === 529 || (error.status ?? 0) >= 500) {
      return "Claude is having trouble right now. Try again in a moment.";
    }
    return `Claude returned an error: ${error.message}`;
  }
  console.error("Nova turn failed", error);
  return "Something went wrong. Try again.";
}
