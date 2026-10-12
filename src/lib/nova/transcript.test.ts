import { describe, expect, it } from "vitest";
import { toChatItems } from "./transcript";

describe("toChatItems", () => {
  it("hides system and tool-result messages and groups Nova's turn", () => {
    const items = toChatItems([
      { id: "1", role: "user", content: [{ type: "text", text: "I finished my outline" }] },
      { id: "2", role: "system", content: "Today is…" },
      {
        id: "3",
        role: "assistant",
        content: [
          { type: "thinking", thinking: "", signature: "s" },
          { type: "tool_use", id: "t1", name: "update_step", input: {} },
        ],
      },
      {
        id: "4",
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: JSON.stringify({ summary: "Completed “Outline”", goal: { id: "g1" } }),
          },
        ],
      },
      { id: "5", role: "assistant", content: [{ type: "text", text: "Nice work!" }] },
    ]);

    expect(items).toEqual([
      { id: "1", role: "user", text: "I finished my outline" },
      {
        id: "3",
        role: "nova",
        parts: [
          { kind: "tool", id: "t1", summary: "Completed “Outline”", goalId: "g1", isError: false },
          { kind: "text", text: "Nice work!" },
        ],
      },
    ]);
  });

  it("shows failed tool calls as errors", () => {
    const items = toChatItems([
      { id: "1", role: "assistant", content: [{ type: "tool_use", id: "t1", name: "x", input: {} }] },
      {
        id: "2",
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: "That step doesn't exist.", is_error: true }],
      },
    ]);
    expect(items[0]).toMatchObject({
      role: "nova",
      parts: [{ kind: "tool", summary: "That step doesn't exist.", isError: true }],
    });
  });
});
