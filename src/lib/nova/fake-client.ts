import type Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaMessage,
  BetaStopReason,
} from "@anthropic-ai/sdk/resources/beta/messages";

// A scripted stand-in for the Claude client, for tests. Each call to
// beta.messages.stream returns the next scripted response (or throws it).

export function reply(content: BetaContentBlock[], stopReason: BetaStopReason = "end_turn"): BetaMessage {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as unknown as BetaMessage;
}

export function text(value: string): BetaContentBlock {
  return { type: "text", text: value, citations: null } as BetaContentBlock;
}

export function toolUse(id: string, name: string, input: unknown): BetaContentBlock {
  return { type: "tool_use", id, name, input } as BetaContentBlock;
}

export function fakeClient(script: (BetaMessage | Error)[]) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          requests.push(structuredClone(params));
          const next = script.shift();
          if (!next) throw new Error("No scripted response left");
          return {
            async *[Symbol.asyncIterator]() {
              if (next instanceof Error) throw next;
              for (const [index, block] of next.content.entries()) {
                if (block.type === "text") {
                  yield { type: "content_block_start", index, content_block: { ...block, text: "" } };
                  yield { type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } };
                } else {
                  yield { type: "content_block_start", index, content_block: block };
                }
                yield { type: "content_block_stop", index };
              }
            },
            async finalMessage() {
              if (next instanceof Error) throw next;
              return next;
            },
          };
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, requests };
}
