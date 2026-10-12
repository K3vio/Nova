import type { Goal, Step } from "@/db/schema";

/**
 * A goal's overall progress (0-100): the weighted average of its steps, or the
 * manually set value when it has no steps. Rounds down so a goal never shows
 * 100% until every step is actually done.
 */
export function computeGoalProgress(
  goal: Pick<Goal, "manualProgress">,
  goalSteps: Pick<Step, "weight" | "progress">[],
): number {
  if (goalSteps.length === 0) return goal.manualProgress;
  const totalWeight = goalSteps.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = goalSteps.reduce((sum, s) => sum + s.weight * s.progress, 0);
  return Math.floor(weighted / totalWeight);
}
