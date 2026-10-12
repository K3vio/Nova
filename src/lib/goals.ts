import { and, asc, desc, eq, gt, lt, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Transaction } from "@/db";
import {
  type Goal,
  type GoalHorizon,
  goalHorizons,
  goalStatuses,
  goals,
  type ProgressEntry,
  type ProgressSource,
  progressEntries,
  type Step,
  steps,
} from "@/db/schema";
import { computeGoalProgress } from "./progress";

// Everything that reads or changes goals goes through this module, so the UI
// and Nova's tools share the same rules and progress history.

/** An error whose message is safe to show to the user. */
export class GoalError extends Error {
  name = "GoalError";
}

const title = z
  .string()
  .trim()
  .min(1, "Title can't be empty")
  .max(200, "Title is too long (200 characters max)");
const longText = z.string().trim().max(5000, "Text is too long (5000 characters max)");
const dueDate = z.iso.date("Due date must be a valid date").nullable();
const percent = z.int().min(0).max(100);
const weight = z.int("Weight must be a whole number").min(1).max(100);

export const createGoalInput = z.object({
  title,
  description: longText.default(""),
  horizon: z.enum(goalHorizons),
  parentId: z.string().nullable().default(null),
  dueDate: dueDate.default(null),
  steps: z.array(title).max(50, "That's too many steps (50 max)").default([]),
});

export const updateGoalInput = z.object({
  title: title.optional(),
  description: longText.optional(),
  horizon: z.enum(goalHorizons).optional(),
  parentId: z.string().nullable().optional(),
  dueDate: dueDate.optional(),
  status: z.enum(goalStatuses).optional(),
  manualProgress: percent.optional(),
});

export const addStepInput = z.object({
  title,
  notes: longText.default(""),
  weight: weight.default(1),
  dueDate: dueDate.default(null),
});

export const updateStepInput = z.object({
  title: title.optional(),
  notes: longText.optional(),
  weight: weight.optional(),
  progress: percent.optional(),
  dueDate: dueDate.optional(),
});

export type CreateGoalInput = z.input<typeof createGoalInput>;
export type UpdateGoalInput = z.input<typeof updateGoalInput>;
export type AddStepInput = z.input<typeof addStepInput>;
export type UpdateStepInput = z.input<typeof updateStepInput>;

/** Who made a change and an optional note for the progress history. */
export type ChangeMeta = { source?: ProgressSource; note?: string };

export type GoalSummary = Goal & {
  progress: number;
  stepCount: number;
  stepsDone: number;
};

export type GoalDetail = {
  goal: Goal;
  progress: number;
  steps: Step[];
  parent: Pick<Goal, "id" | "title"> | null;
  children: GoalSummary[];
  history: ProgressEntry[];
};

function summarize(goal: Goal, goalSteps: Pick<Step, "weight" | "progress">[]): GoalSummary {
  return {
    ...goal,
    progress: computeGoalProgress(goal, goalSteps),
    stepCount: goalSteps.length,
    stepsDone: goalSteps.filter((s) => s.progress === 100).length,
  };
}

// Soonest due date first, undated goals last, then oldest first.
function byDueDate(a: Goal, b: Goal): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export async function listGoals(): Promise<GoalSummary[]> {
  const [allGoals, allSteps] = await Promise.all([
    db.select().from(goals),
    db
      .select({ goalId: steps.goalId, weight: steps.weight, progress: steps.progress })
      .from(steps),
  ]);
  const stepsByGoal = new Map<string, typeof allSteps>();
  for (const step of allSteps) {
    stepsByGoal.set(step.goalId, [...(stepsByGoal.get(step.goalId) ?? []), step]);
  }
  return allGoals
    .sort(byDueDate)
    .map((goal) => summarize(goal, stepsByGoal.get(goal.id) ?? []));
}

export async function getGoal(id: string): Promise<GoalDetail | null> {
  const goal = await db.select().from(goals).where(eq(goals.id, id)).get();
  if (!goal) return null;

  const [goalSteps, parent, children, history] = await Promise.all([
    db.select().from(steps).where(eq(steps.goalId, id)).orderBy(asc(steps.position)),
    goal.parentId
      ? db
          .select({ id: goals.id, title: goals.title })
          .from(goals)
          .where(eq(goals.id, goal.parentId))
          .get()
      : undefined,
    db.select().from(goals).where(eq(goals.parentId, id)),
    db
      .select()
      .from(progressEntries)
      .where(eq(progressEntries.goalId, id))
      .orderBy(desc(progressEntries.createdAt), desc(sql`rowid`))
      .limit(50),
  ]);

  const childSteps = await Promise.all(
    children.map((child) =>
      db
        .select({ weight: steps.weight, progress: steps.progress })
        .from(steps)
        .where(eq(steps.goalId, child.id)),
    ),
  );

  return {
    goal,
    progress: computeGoalProgress(goal, goalSteps),
    steps: goalSteps,
    parent: parent ?? null,
    children: children.sort(byDueDate).map((child, i) => summarize(child, childSteps[i])),
    history,
  };
}

export async function getStep(id: string): Promise<Step | null> {
  return (await db.select().from(steps).where(eq(steps.id, id)).get()) ?? null;
}

/** Every goal with its ordered steps, soonest due first. */
export async function listGoalsWithSteps(): Promise<(GoalSummary & { steps: Step[] })[]> {
  const [allGoals, allSteps] = await Promise.all([
    db.select().from(goals),
    db.select().from(steps).orderBy(asc(steps.position)),
  ]);
  const stepsByGoal = new Map<string, Step[]>();
  for (const step of allSteps) {
    stepsByGoal.set(step.goalId, [...(stepsByGoal.get(step.goalId) ?? []), step]);
  }
  return allGoals.sort(byDueDate).map((goal) => {
    const goalSteps = stepsByGoal.get(goal.id) ?? [];
    return { ...summarize(goal, goalSteps), steps: goalSteps };
  });
}

/** Long-term goals that a short-term goal can be linked to. */
export async function listParentOptions(): Promise<Pick<Goal, "id" | "title">[]> {
  return db
    .select({ id: goals.id, title: goals.title })
    .from(goals)
    .where(and(eq(goals.horizon, "long"), eq(goals.status, "active")))
    .orderBy(asc(goals.title));
}

export async function createGoal(input: CreateGoalInput, meta: ChangeMeta = {}): Promise<Goal> {
  const data = createGoalInput.parse(input);
  return db.transaction(async (tx) => {
    const parentId = data.horizon === "short" ? data.parentId : null;
    if (parentId) await assertValidParent(tx, parentId);

    const [goal] = await tx
      .insert(goals)
      .values({
        title: data.title,
        description: data.description,
        horizon: data.horizon,
        parentId,
        dueDate: data.dueDate,
      })
      .returning();

    if (data.steps.length > 0) {
      await tx
        .insert(steps)
        .values(data.steps.map((stepTitle, i) => ({ goalId: goal.id, title: stepTitle, position: i })));
    }

    await recordProgress(tx, goal.id, { ...meta, note: meta.note ?? "Goal created" });
    return goal;
  });
}

export async function updateGoal(
  id: string,
  input: UpdateGoalInput,
  meta: ChangeMeta = {},
): Promise<Goal> {
  const data = updateGoalInput.parse(input);
  return db.transaction(async (tx) => {
    const current = await getGoalOrThrow(tx, id);
    const horizon: GoalHorizon = data.horizon ?? current.horizon;

    let parentId = data.parentId === undefined ? current.parentId : data.parentId;
    if (horizon === "long") parentId = null;
    if (parentId && parentId !== current.parentId) {
      if (parentId === id) throw new GoalError("A goal can't be part of itself.");
      await assertValidParent(tx, parentId);
    }

    if (horizon === "short" && current.horizon === "long") {
      const child = await tx.select({ id: goals.id }).from(goals).where(eq(goals.parentId, id)).get();
      if (child) {
        throw new GoalError(
          "This goal has short-term goals linked to it. Unlink them before making it short-term.",
        );
      }
    }

    const [goal] = await tx
      .update(goals)
      .set({ ...data, horizon, parentId })
      .where(eq(goals.id, id))
      .returning();

    if (data.manualProgress !== undefined) {
      await recordProgress(tx, id, meta);
    }
    return goal;
  });
}

export async function deleteGoal(id: string): Promise<void> {
  // Steps and progress history cascade; linked short-term goals are unlinked.
  const deleted = await db.delete(goals).where(eq(goals.id, id)).returning({ id: goals.id });
  if (deleted.length === 0) throw new GoalError("That goal doesn't exist.");
}

export async function addStep(
  goalId: string,
  input: AddStepInput,
  meta: ChangeMeta = {},
): Promise<Step> {
  const data = addStepInput.parse(input);
  return db.transaction(async (tx) => {
    await getGoalOrThrow(tx, goalId);
    const last = await tx
      .select({ value: max(steps.position) })
      .from(steps)
      .where(eq(steps.goalId, goalId))
      .get();
    const [step] = await tx
      .insert(steps)
      .values({ ...data, goalId, position: (last?.value ?? -1) + 1 })
      .returning();
    await recordProgress(tx, goalId, {
      ...meta,
      stepId: step.id,
      note: meta.note ?? `Added step "${step.title}"`,
    });
    return step;
  });
}

export async function updateStep(
  stepId: string,
  input: UpdateStepInput,
  meta: ChangeMeta = {},
): Promise<Step> {
  const data = updateStepInput.parse(input);
  return db.transaction(async (tx) => {
    const current = await getStepOrThrow(tx, stepId);
    if (Object.values(data).every((v) => v === undefined)) return current;
    const [step] = await tx.update(steps).set(data).where(eq(steps.id, stepId)).returning();
    await recordProgress(tx, step.goalId, {
      ...meta,
      stepId,
      note: meta.note ?? describeStepChange(current, step),
    });
    return step;
  });
}

export async function deleteStep(stepId: string, meta: ChangeMeta = {}): Promise<void> {
  await db.transaction(async (tx) => {
    const step = await getStepOrThrow(tx, stepId);
    await tx.delete(steps).where(eq(steps.id, stepId));
    await recordProgress(tx, step.goalId, {
      ...meta,
      note: meta.note ?? `Removed step "${step.title}"`,
    });
  });
}

/** Swaps a step with its neighbour above or below. */
export async function moveStep(stepId: string, direction: "up" | "down"): Promise<void> {
  await db.transaction(async (tx) => {
    const step = await getStepOrThrow(tx, stepId);
    const neighbour = await tx
      .select()
      .from(steps)
      .where(
        and(
          eq(steps.goalId, step.goalId),
          direction === "up" ? lt(steps.position, step.position) : gt(steps.position, step.position),
        ),
      )
      .orderBy(direction === "up" ? desc(steps.position) : asc(steps.position))
      .get();
    if (!neighbour) return;
    await tx.update(steps).set({ position: neighbour.position }).where(eq(steps.id, step.id));
    await tx.update(steps).set({ position: step.position }).where(eq(steps.id, neighbour.id));
  });
}

async function getGoalOrThrow(tx: Transaction, id: string): Promise<Goal> {
  const goal = await tx.select().from(goals).where(eq(goals.id, id)).get();
  if (!goal) throw new GoalError("That goal doesn't exist.");
  return goal;
}

async function getStepOrThrow(tx: Transaction, id: string): Promise<Step> {
  const step = await tx.select().from(steps).where(eq(steps.id, id)).get();
  if (!step) throw new GoalError("That step doesn't exist.");
  return step;
}

async function assertValidParent(tx: Transaction, parentId: string): Promise<void> {
  const parent = await getGoalOrThrow(tx, parentId);
  if (parent.horizon !== "long") {
    throw new GoalError("Short-term goals can only be linked to a long-term goal.");
  }
}

function describeStepChange(before: Step, after: Step): string {
  if (after.progress !== before.progress) {
    if (after.progress === 100) return `Completed "${after.title}"`;
    if (before.progress === 100) return `Reopened "${after.title}"`;
    return `"${after.title}" ${before.progress}% → ${after.progress}%`;
  }
  if (after.weight !== before.weight) {
    return `Changed weight of "${after.title}" to ${after.weight}`;
  }
  return `Updated "${after.title}"`;
}

/** Logs the goal's current progress, but only if it changed since the last entry. */
async function recordProgress(
  tx: Transaction,
  goalId: string,
  meta: ChangeMeta & { stepId?: string },
): Promise<void> {
  const goal = await getGoalOrThrow(tx, goalId);
  const goalSteps = await tx
    .select({ weight: steps.weight, progress: steps.progress })
    .from(steps)
    .where(eq(steps.goalId, goalId));
  const goalProgress = computeGoalProgress(goal, goalSteps);

  const last = await tx
    .select({ goalProgress: progressEntries.goalProgress })
    .from(progressEntries)
    .where(eq(progressEntries.goalId, goalId))
    .orderBy(desc(progressEntries.createdAt), desc(sql`rowid`))
    .get();
  if (last && last.goalProgress === goalProgress) return;

  await tx.insert(progressEntries).values({
    goalId,
    stepId: meta.stepId ?? null,
    goalProgress,
    note: meta.note ?? "",
    source: meta.source ?? "user",
  });
}
