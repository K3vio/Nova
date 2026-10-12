import { describe, expect, it } from "vitest";
import { addStep, createGoal, listGoalsWithSteps, updateGoal } from "@/lib/goals";
import { buildSnapshot } from "./snapshot";

describe("buildSnapshot", () => {
  it("describes the date, active goals with step IDs, and finished goals", async () => {
    const degree = await createGoal({ title: "Finish degree", horizon: "long" });
    const essay = await createGoal({
      title: "History essay",
      horizon: "short",
      parentId: degree.id,
      dueDate: "2026-10-17",
      description: "2,000 words\non the Cold War",
    });
    const step = await addStep(essay.id, { title: "Draft", weight: 2 });
    const old = await createGoal({ title: "Old goal", horizon: "short" });
    await updateGoal(old.id, { status: "archived" });

    const snapshot = buildSnapshot(await listGoalsWithSteps(), "2026-10-12");

    expect(snapshot).toContain("Today is Monday, October 12, 2026 (2026-10-12).");
    expect(snapshot).toContain(
      `- "History essay" id=${essay.id} · short-term · 0% done · due 2026-10-17 (in 5 days) · part of "Finish degree"`,
    );
    expect(snapshot).toContain("  Details: 2,000 words on the Cold War");
    expect(snapshot).toContain(`  - step "Draft" step_id=${step.id} · 0% · weight 2`);
    expect(snapshot).toContain("No steps; progress is set manually.");
    expect(snapshot).toContain(`- "Old goal" id=${old.id} · archived`);
  });

  it("says when there are no goals", () => {
    expect(buildSnapshot([], "2026-10-12")).toContain("The user has no active goals yet.");
  });
});
