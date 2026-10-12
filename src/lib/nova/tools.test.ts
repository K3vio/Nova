import { describe, expect, it } from "vitest";
import { createGoal, getGoal } from "@/lib/goals";
import { NOVA_TOOLS, runTool } from "./tools";

let nextId = 0;
const call = (name: string, input: unknown) => runTool({ id: `t${nextId++}`, name, input });

async function detail(id: string) {
  return (await getGoal(id))!;
}

describe("Nova tools", () => {
  it("declares strict schemas the API accepts", () => {
    const json = JSON.stringify(NOVA_TOOLS);
    for (const unsupported of ["minimum", "maximum", "minLength", "maxLength", "$schema", "pattern"]) {
      expect(json).not.toContain(`"${unsupported}"`);
    }
    for (const tool of NOVA_TOOLS) {
      expect(tool.strict).toBe(true);
      expect(tool.input_schema).toMatchObject({ type: "object", additionalProperties: false });
    }
    const dueDate = (NOVA_TOOLS.find((t) => t.name === "update_goal")!.input_schema.properties as Record<string, unknown>)
      .due_date;
    expect(dueDate).toMatchObject({ anyOf: [{ type: "string" }, { type: "null" }] });
  });

  it("creates a goal with steps and returns its IDs to Nova", async () => {
    const outcome = await call("create_goal", {
      title: "Run a half marathon",
      horizon: "long",
      due_date: "2027-04-01",
      steps: ["Run 5k", "Run 10k", "Run 21k"],
    });
    expect(outcome.display).toMatchObject({ summary: "Created “Run a half marathon” with 3 steps", isError: false });
    const data = JSON.parse(outcome.result.content as string);
    expect(data.goal.steps).toHaveLength(3);
    expect(data.goal.steps[0]).toMatchObject({ title: "Run 5k", progress: 0 });
    expect(data.goal.steps[0].id).toBeTruthy();
  });

  it("logs step progress with Nova's note", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["Research", "Draft"] });
    const [research] = (await detail(goal.id)).steps;

    const outcome = await call("update_step", {
      step_id: research.id,
      progress: 100,
      note: "Finished reading the five sources",
    });
    expect(outcome.display.summary).toBe("Completed “Research” · Essay now 50%");
    expect((await detail(goal.id)).history[0]).toMatchObject({
      goalProgress: 50,
      note: "Finished reading the five sources",
      source: "nova",
    });
  });

  it("updates due dates and status, and clears a due date with null", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", dueDate: "2026-10-20" });
    expect((await call("update_goal", { goal_id: goal.id, due_date: "2026-10-23" })).display.summary).toBe(
      "Updated “Essay” · due 2026-10-23",
    );
    await call("update_goal", { goal_id: goal.id, due_date: null });
    expect((await detail(goal.id)).goal.dueDate).toBeNull();
    await call("update_goal", { goal_id: goal.id, status: "completed" });
    expect((await detail(goal.id)).goal.status).toBe("completed");
  });

  it("refuses manual progress on a goal whose progress comes from steps", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["A"] });
    const outcome = await call("update_goal", { goal_id: goal.id, progress: 50 });
    expect(outcome.display.isError).toBe(true);
    expect(outcome.result).toMatchObject({ is_error: true });
  });

  it("adds and deletes steps", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["A"] });
    await call("add_steps", { goal_id: goal.id, steps: [{ title: "B", weight: 2 }, { title: "C" }] });
    const steps = (await detail(goal.id)).steps;
    expect(steps.map((s) => [s.title, s.weight])).toEqual([["A", 1], ["B", 2], ["C", 1]]);

    expect((await call("delete_step", { step_id: steps[0].id })).display.summary).toBe(
      "Removed “A” from “Essay”",
    );
    expect((await detail(goal.id)).steps.map((s) => s.title)).toEqual(["B", "C"]);
  });

  it("reads a goal without changing anything", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", description: "2,000 words" });
    const outcome = await call("get_goal", { goal_id: goal.id });
    expect(outcome.changed).toBe(false);
    expect(JSON.parse(outcome.result.content as string).recent_history).toHaveLength(1);
  });

  it("turns validation problems into error results", async () => {
    expect((await call("create_goal", { title: "", horizon: "short" })).display).toMatchObject({
      isError: true,
      summary: "Invalid input for title: Title can't be empty",
    });
    expect((await call("create_goal", { title: "x", horizon: "short", due_date: "soon" })).display.isError).toBe(
      true,
    );
    expect((await call("no_such_tool", {})).display).toMatchObject({ isError: true });
  });
});
