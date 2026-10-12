import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  addStep,
  createGoal,
  deleteGoal,
  deleteStep,
  getGoal,
  GoalError,
  listGoals,
  moveStep,
  updateGoal,
  updateStep,
} from "./goals";

async function detail(id: string) {
  const goal = await getGoal(id);
  if (!goal) throw new Error("goal missing");
  return goal;
}

describe("goals", () => {
  it("creates a goal with its bullet-point steps and a starting history entry", async () => {
    const goal = await createGoal({
      title: "Write history essay",
      horizon: "short",
      dueDate: "2026-11-01",
      steps: ["Research", "Outline", "Draft"],
    });

    const d = await detail(goal.id);
    expect(d.steps.map((s) => s.title)).toEqual(["Research", "Outline", "Draft"]);
    expect(d.progress).toBe(0);
    expect(d.history).toHaveLength(1);
    expect(d.history[0]).toMatchObject({ goalProgress: 0, note: "Goal created" });
  });

  it("updates progress from steps and logs each change", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["A", "B"] });
    const [a, b] = (await detail(goal.id)).steps;

    await updateStep(a.id, { progress: 100 });
    await updateStep(b.id, { progress: 50 }, { source: "nova", note: "Wrote half the draft" });

    const d = await detail(goal.id);
    expect(d.progress).toBe(75);
    expect(d.history.map((h) => [h.goalProgress, h.note, h.source])).toEqual([
      [75, "Wrote half the draft", "nova"],
      [50, 'Completed "A"', "user"],
      [0, "Goal created", "user"],
    ]);
  });

  it("does not log history when progress is unchanged", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["A"] });
    const [a] = (await detail(goal.id)).steps;
    await updateStep(a.id, { title: "Renamed" });
    expect((await detail(goal.id)).history).toHaveLength(1);
  });

  it("logs a drop in progress when a new step is added", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["A"] });
    const [a] = (await detail(goal.id)).steps;
    await updateStep(a.id, { progress: 100 });
    await addStep(goal.id, { title: "B", weight: 3 });

    const d = await detail(goal.id);
    expect(d.progress).toBe(25);
    expect(d.history[0]).toMatchObject({ goalProgress: 25, note: 'Added step "B"' });
  });

  it("uses manual progress for goals without steps", async () => {
    const goal = await createGoal({ title: "Read more", horizon: "long" });
    await updateGoal(goal.id, { manualProgress: 30 });
    expect((await detail(goal.id)).progress).toBe(30);
  });

  it("reorders and deletes steps", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["A", "B", "C"] });
    const [, b] = (await detail(goal.id)).steps;

    await moveStep(b.id, "up");
    expect((await detail(goal.id)).steps.map((s) => s.title)).toEqual(["B", "A", "C"]);

    await deleteStep(b.id);
    expect((await detail(goal.id)).steps.map((s) => s.title)).toEqual(["A", "C"]);
  });

  it("links short-term goals to a long-term goal", async () => {
    const degree = await createGoal({ title: "Finish degree", horizon: "long" });
    const essay = await createGoal({ title: "Essay", horizon: "short", parentId: degree.id });

    const d = await detail(degree.id);
    expect(d.children.map((c) => c.id)).toEqual([essay.id]);
    expect((await detail(essay.id)).parent).toEqual({ id: degree.id, title: "Finish degree" });

    await expect(createGoal({ title: "x", horizon: "short", parentId: essay.id })).rejects.toThrow(
      GoalError,
    );
    await expect(updateGoal(degree.id, { horizon: "short" })).rejects.toThrow(GoalError);

    // Deleting the parent unlinks the child instead of deleting it.
    await deleteGoal(degree.id);
    expect((await detail(essay.id)).parent).toBeNull();
  });

  it("deletes a goal along with its steps and history", async () => {
    const goal = await createGoal({ title: "Essay", horizon: "short", steps: ["A"] });
    await deleteGoal(goal.id);
    expect(await getGoal(goal.id)).toBeNull();
    expect(await listGoals()).toEqual([]);
  });

  it("rejects invalid input", async () => {
    await expect(createGoal({ title: "  ", horizon: "short" })).rejects.toThrow(ZodError);
    await expect(createGoal({ title: "x", horizon: "short", dueDate: "next week" })).rejects.toThrow(
      ZodError,
    );
    const goal = await createGoal({ title: "x", horizon: "short", steps: ["A"] });
    const [a] = (await detail(goal.id)).steps;
    await expect(updateStep(a.id, { progress: 150 })).rejects.toThrow(ZodError);
  });

  it("sorts goals by due date with undated goals last", async () => {
    await createGoal({ title: "No date", horizon: "short" });
    await createGoal({ title: "Later", horizon: "short", dueDate: "2026-12-01" });
    await createGoal({ title: "Sooner", horizon: "short", dueDate: "2026-11-01" });
    expect((await listGoals()).map((g) => g.title)).toEqual(["Sooner", "Later", "No date"]);
  });
});
