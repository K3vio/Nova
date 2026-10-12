"use server";

// TODO(phase 5): these are reachable by direct POST. Check the signed-in user in
// every action before Nova is deployed anywhere other than localhost.

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { GoalHorizon, GoalStatus } from "@/db/schema";
import { deleteConversation } from "@/lib/conversations";
import {
  addStep,
  createGoal,
  deleteGoal,
  deleteStep,
  GoalError,
  moveStep,
  updateGoal,
  updateStep,
} from "@/lib/goals";

export type FormState = { error?: string; ok?: boolean };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Empty fields mean "not set". */
function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key).trim() || null;
}

function optionalInt(formData: FormData, key: string): number | undefined {
  const value = text(formData, key).trim();
  return value === "" ? undefined : Number(value);
}

/** Turns pasted bullet points ("- foo", "1. bar", "[ ] baz") into step titles. */
function parseBullets(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*/, "").trim())
    .filter(Boolean);
}

async function attempt(fn: () => Promise<unknown>): Promise<FormState> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Invalid input" };
    if (error instanceof GoalError) return { error: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

export async function createGoalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let goalId: string | undefined;
  const state = await attempt(async () => {
    const goal = await createGoal({
      title: text(formData, "title"),
      description: text(formData, "description"),
      // Validated against the allowed values inside createGoal.
      horizon: text(formData, "horizon") as GoalHorizon,
      parentId: optionalText(formData, "parentId"),
      dueDate: optionalText(formData, "dueDate"),
      steps: parseBullets(text(formData, "steps")),
    });
    goalId = goal.id;
  });
  if (goalId) redirect(`/goals/${goalId}`);
  return state;
}

export async function updateGoalAction(
  goalId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return attempt(() =>
    updateGoal(goalId, {
      title: text(formData, "title"),
      description: text(formData, "description"),
      horizon: text(formData, "horizon") as GoalHorizon,
      parentId: optionalText(formData, "parentId"),
      dueDate: optionalText(formData, "dueDate"),
    }),
  );
}

export async function setGoalStatusAction(goalId: string, status: GoalStatus): Promise<void> {
  await updateGoal(goalId, { status });
  refresh();
}

export async function setManualProgressAction(goalId: string, formData: FormData): Promise<void> {
  await updateGoal(goalId, { manualProgress: optionalInt(formData, "progress") });
  refresh();
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  await deleteGoal(goalId);
  redirect("/");
}

export async function addStepAction(
  goalId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return attempt(() =>
    addStep(goalId, {
      title: text(formData, "title"),
      weight: optionalInt(formData, "weight"),
      dueDate: optionalText(formData, "dueDate"),
    }),
  );
}

export async function updateStepAction(
  stepId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return attempt(() =>
    updateStep(stepId, {
      title: text(formData, "title"),
      notes: text(formData, "notes"),
      weight: optionalInt(formData, "weight"),
      dueDate: optionalText(formData, "dueDate"),
    }),
  );
}

export async function toggleStepAction(stepId: string, done: boolean): Promise<void> {
  await updateStep(stepId, { progress: done ? 100 : 0 });
  refresh();
}

export async function setStepProgressAction(stepId: string, formData: FormData): Promise<void> {
  await updateStep(stepId, { progress: optionalInt(formData, "progress") });
  refresh();
}

export async function moveStepAction(stepId: string, direction: "up" | "down"): Promise<void> {
  await moveStep(stepId, direction);
  refresh();
}

export async function deleteStepAction(stepId: string): Promise<void> {
  await deleteStep(stepId);
  refresh();
}

export async function deleteConversationAction(conversationId: string, isCurrent: boolean): Promise<void> {
  await deleteConversation(conversationId);
  if (isCurrent) redirect("/chat");
  refresh();
}
