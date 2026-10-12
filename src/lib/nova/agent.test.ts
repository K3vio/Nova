import type {
  BetaContentBlock,
  BetaMessageParam,
} from "@anthropic-ai/sdk/resources/beta/messages";
import { describe, expect, it } from "vitest";
import { getConversation, listConversations } from "@/lib/conversations";
import { createGoal, getGoal, listGoals } from "@/lib/goals";
import { echoableContent, type NovaEvent, runNovaTurn } from "./agent";
import { fakeClient, reply, text, toolUse } from "./fake-client";

const NOW = new Date(2026, 9, 12, 17, 0);

async function turn(
  script: Parameters<typeof fakeClient>[0],
  message: string,
  conversationId: string | null = null,
) {
  const { client, requests } = fakeClient(script);
  const events: NovaEvent[] = [];
  await runNovaTurn({ conversationId, message, emit: (e) => events.push(e), client, now: NOW });
  const conversation = events.find((e) => e.type === "conversation");
  return {
    events,
    requests,
    conversationId: conversationId ?? (conversation?.type === "conversation" ? conversation.id : null),
  };
}

async function storedMessages(conversationId: string) {
  const found = await getConversation(conversationId);
  return found!.messages.map((m) => ({ role: m.role, content: m.content }));
}

describe("runNovaTurn", () => {
  it("streams a reply and saves the turn with a snapshot of the goals", async () => {
    await createGoal({ title: "Finish degree", horizon: "long" });
    const { events, requests, conversationId } = await turn([reply([text("Hi! Ready when you are.")])], "Hello");

    expect(events).toEqual([
      { type: "text", text: "Hi! Ready when you are." },
      { type: "conversation", id: conversationId, title: "Hello" },
      { type: "done", changed: false },
    ]);

    const stored = await storedMessages(conversationId!);
    expect(stored.map((m) => m.role)).toEqual(["user", "system", "assistant"]);
    expect(stored[1].content).toContain("Today is Monday, October 12, 2026");
    expect(stored[1].content).toContain('"Finish degree"');

    const request = requests[0] as { messages: BetaMessageParam[]; tools: { strict: boolean }[] };
    expect(request).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
    expect(request.tools.every((t) => t.strict)).toBe(true);
    // The system snapshot goes last; the cache breakpoint sits on the user message before it.
    expect(request.messages.map((m) => m.role)).toEqual(["user", "system"]);
    expect(request.messages[0].content).toEqual([
      { type: "text", text: "Hello", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("runs Nova's tools, saves each step and keeps going until Nova replies", async () => {
    const { events, requests, conversationId } = await turn(
      [
        reply(
          [toolUse("t1", "create_goal", { title: "Essay", horizon: "short", steps: ["Research", "Draft"] })],
          "tool_use",
        ),
        reply([text("Added your essay with two steps.")]),
      ],
      "I have an essay to write",
    );

    const [goal] = await listGoals();
    expect(goal).toMatchObject({ title: "Essay", stepCount: 2 });
    expect((await getGoal(goal.id))!.history[0].source).toBe("nova");

    expect(events).toContainEqual({ type: "tool_start", id: "t1", name: "create_goal" });
    expect(events).toContainEqual({
      type: "tool_result",
      id: "t1",
      summary: "Created “Essay” with 2 steps",
      goalId: goal.id,
      isError: false,
    });
    expect(events.at(-1)).toEqual({ type: "done", changed: true });

    const stored = await storedMessages(conversationId!);
    expect(stored.map((m) => m.role)).toEqual(["user", "system", "assistant", "user", "assistant"]);
    const toolResult = (stored[3].content as { type: string; tool_use_id: string }[])[0];
    expect(toolResult).toMatchObject({ type: "tool_result", tool_use_id: "t1" });

    // The second request carries the tool result, with the cache breakpoint moved onto it.
    const second = requests[1] as { messages: BetaMessageParam[] };
    expect(second.messages).toHaveLength(4);
    expect(second.messages[3].content).toEqual([
      expect.objectContaining({ type: "tool_result", cache_control: { type: "ephemeral" } }),
    ]);
  });

  it("only re-sends the snapshot when the goals or date changed", async () => {
    const first = await turn([reply([text("Hi")])], "Hello");
    const id = first.conversationId!;

    await turn([reply([text("Still here")])], "You there?", id);
    expect((await storedMessages(id)).map((m) => m.role)).toEqual([
      "user",
      "system",
      "assistant",
      "user",
      "assistant",
    ]);

    await createGoal({ title: "New thing", horizon: "short" });
    await turn([reply([text("Nice")])], "I added a goal", id);
    const stored = await storedMessages(id);
    expect(stored.map((m) => m.role).slice(-3)).toEqual(["user", "system", "assistant"]);
    expect(stored.at(-2)!.content).toContain('"New thing"');
  });

  it("sends tool errors back to Nova instead of failing the turn", async () => {
    const { events, requests } = await turn(
      [
        reply([toolUse("t1", "update_step", { step_id: "nope", progress: 100 })], "tool_use"),
        reply([text("I couldn't find that step. Which one did you mean?")]),
      ],
      "Done with research",
    );
    expect(events).toContainEqual({
      type: "tool_result",
      id: "t1",
      summary: "That step doesn't exist.",
      isError: true,
    });
    const toolTurn = (requests[1] as { messages: BetaMessageParam[] }).messages[3];
    expect(toolTurn.content).toEqual([
      expect.objectContaining({ is_error: true, content: "That step doesn't exist." }),
    ]);
    expect(events.at(-1)).toEqual({ type: "done", changed: false });
  });

  it("removes a failed first message so no empty conversation is left behind", async () => {
    const { events } = await turn([new Error("network down")], "Hello");
    expect(events).toEqual([
      { type: "error", message: "Something went wrong. Try again." },
      { type: "done", changed: false },
    ]);
    expect(await listConversations()).toEqual([]);
  });

  it("removes a failed turn from an existing conversation", async () => {
    const id = (await turn([reply([text("Hi")])], "Hello")).conversationId!;
    await turn([new Error("network down")], "Another message", id);
    expect((await storedMessages(id)).map((m) => m.role)).toEqual(["user", "system", "assistant"]);
  });

  it("keeps completed tool steps if a later call fails", async () => {
    const id = (await turn([reply([text("Hi")])], "Hello")).conversationId!;
    const { events } = await turn(
      [
        reply([toolUse("t1", "create_goal", { title: "Gym", horizon: "long" })], "tool_use"),
        new Error("network down"),
      ],
      "Track going to the gym",
      id,
    );
    expect((await listGoals()).map((g) => g.title)).toEqual(["Gym"]);
    // Goals were unchanged at the start of the turn, so no new snapshot.
    expect((await storedMessages(id)).map((m) => m.role)).toEqual([
      "user",
      "system",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(events.at(-1)).toEqual({ type: "done", changed: true });
  });

  it("reports a refusal without saving it", async () => {
    const { events } = await turn([reply([], "refusal")], "Something Nova won't do");
    expect(events[0]).toEqual({ type: "error", message: "Nova can't help with that request." });
    expect(await listConversations()).toEqual([]);
  });

  it("does not run tools from a reply that was cut off", async () => {
    const { events } = await turn(
      [reply([toolUse("t1", "create_goal", { title: "Half", horizon: "short" })], "max_tokens")],
      "Plan everything",
    );
    expect(await listGoals()).toEqual([]);
    expect(events[events.length - 2]).toMatchObject({ type: "error" });
  });
});

describe("echoableContent", () => {
  it("keeps only text from before a fallback switch", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "Partial ", citations: null },
      { type: "tool_use", id: "t0", name: "get_goal", input: {} },
      { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" } },
      { type: "thinking", thinking: "", signature: "sig2" },
      { type: "text", text: "answer", citations: null },
    ] as unknown as BetaContentBlock[];
    expect(echoableContent(content).map((b) => b.type)).toEqual(["text", "thinking", "text"]);
  });

  it("leaves normal replies untouched", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "hi", citations: null },
    ] as unknown as BetaContentBlock[];
    expect(echoableContent(content)).toEqual(content);
  });
});
