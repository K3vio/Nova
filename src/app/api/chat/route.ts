// TODO(phase 5): check the signed-in user before Nova is deployed anywhere
// other than localhost.

import { z } from "zod";
import { type NovaEvent, runNovaTurn } from "@/lib/nova/agent";

const chatRequest = z.object({
  conversationId: z.string().nullable(),
  message: z.string().trim().min(1).max(20_000),
});

/** Runs one turn with Nova and streams its progress as newline-delimited JSON. */
export async function POST(request: Request) {
  const parsed = chatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Send a non-empty message." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: NovaEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser went away; keep going.
        }
      };
      try {
        // Not tied to the request: if the tab closes mid-turn, Nova still
        // finishes what it was asked to do and saves it.
        await runNovaTurn({ ...parsed.data, emit });
      } catch (error) {
        console.error("Chat turn crashed", error);
        emit({ type: "error", message: "Something went wrong. Try again." });
        emit({ type: "done", changed: false });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
