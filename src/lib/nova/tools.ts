import type {
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages";
import { z } from "zod";
import { goalHorizons, goalStatuses } from "@/db/schema";
import {
  addStep,
  createGoal,
  deleteStep,
  getGoal,
  GoalError,
  getStep,
  updateGoal,
  updateStep,
} from "@/lib/goals";

// Nova's tools. Each one calls the same goal service the UI uses, tagged with
// source "nova" so the history shows which changes Nova made.

const NOVA = { source: "nova" } as const;

// Strict tool use doesn't support numeric or length constraints; the goal
// service enforces those instead. Nullable types become anyOf.
const UNSUPPORTED_KEYS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
]);

function toApiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toApiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYS.has(key)) continue;
    out[key] = toApiSchema(value);
  }
  if (Array.isArray(out.type)) {
    const { type, description, ...rest } = out;
    return {
      ...(description ? { description } : {}),
      anyOf: (type as string[]).map((t) => ({ ...(t === "null" ? {} : rest), type: t })),
    };
  }
  return out;
}


const date = z.string().describe("Calendar date as YYYY-MM-DD.");
const historyNote = z
  .string()
  .describe(
    "Short note for the goal's history in the user's own terms, e.g. 'Wrote the intro (500 words)'.",
  );

const toolInputs = {
  create_goal: z.strictObject({
    title: z.string().describe("Short, specific goal title."),
    horizon: z
      .enum(goalHorizons)
      .describe("'long' for goals over months or years; 'short' for days or weeks, like an assignment."),
    description: z
      .string()
      .optional()
      .describe("Why it matters, requirements (word count, format, criteria), anything worth remembering."),
    due_date: date.optional(),
    parent_goal_id: z
      .string()
      .optional()
      .describe("For a short-term goal: the ID of the long-term goal it is part of."),
    steps: z
      .array(z.string())
      .optional()
      .describe("Concrete steps in the order they should happen."),
  }),
  update_goal: z.strictObject({
    goal_id: z.string(),
    title: z.string().optional(),
    description: z
      .string()
      .optional()
      .describe("Replaces the whole description, so include anything worth keeping from the old one."),
    horizon: z.enum(goalHorizons).optional(),
    due_date: date.nullable().optional().describe("YYYY-MM-DD, or null to remove the due date."),
    parent_goal_id: z.string().nullable().optional().describe("Long-term goal ID, or null to unlink."),
    status: z
      .enum(goalStatuses)
      .optional()
      .describe("'completed' when achieved, 'archived' to put it away, 'active' to reopen."),
    progress: z
      .int()
      .optional()
      .describe("0-100. Only for goals with no steps; otherwise progress comes from the steps."),
    note: historyNote.optional(),
  }),
  add_steps: z.strictObject({
    goal_id: z.string(),
    steps: z.array(
      z.strictObject({
        title: z.string(),
        weight: z
          .int()
          .optional()
          .describe("1-100, default 1. How much this step counts relative to the others."),
        due_date: date.optional(),
        notes: z.string().optional(),
      }),
    ),
  }),
  update_step: z.strictObject({
    step_id: z.string(),
    progress: z.int().optional().describe("0-100, where 100 means done."),
    title: z.string().optional(),
    weight: z.int().optional().describe("1-100."),
    due_date: date.nullable().optional().describe("YYYY-MM-DD, or null to remove."),
    notes: z.string().optional(),
    note: historyNote.optional(),
  }),
  delete_step: z.strictObject({ step_id: z.string() }),
  get_goal: z.strictObject({ goal_id: z.string() }),
};

type ToolName = keyof typeof toolInputs;

const toolDescriptions: Record<ToolName, string> = {
  create_goal:
    "Create a new goal. Use when the user wants to start working toward something, or agrees to your suggestion to track it. If they didn't list steps, include 3-7 concrete steps they could tick off.",
  update_goal:
    "Change a goal: new due date, changed requirements (update the description), new title, link to a long-term goal, mark it completed/archived/active, or set progress on a goal with no steps. Use whenever the user mentions that something about a goal changed.",
  add_steps: "Add one or more steps to the end of a goal's step list.",
  update_step:
    "Update a step. Call this whenever the user reports progress on something that matches a step: set progress (100 = done) and add a history note. Also edits a step's title, weight, due date or notes.",
  delete_step: "Delete a step from a goal. Only when the user asks, or agrees, to remove it.",
  get_goal:
    "Get a goal's full details: description, every step with notes, linked goals and recent progress history. Use when the snapshot isn't enough, e.g. to review how a goal has gone.",
};

export const NOVA_TOOLS: BetaTool[] = (Object.keys(toolInputs) as ToolName[]).map((name) => ({
  name,
  description: toolDescriptions[name],
  input_schema: toApiSchema(z.toJSONSchema(toolInputs[name], { io: "input" })) as BetaTool["input_schema"],
  strict: true,
}));

/** What the chat shows for a tool call. */
export type ToolDisplay = { summary: string; goalId?: string; isError: boolean };

export type ToolOutcome = { result: BetaToolResultBlockParam; display: ToolDisplay; changed: boolean };

export async function runTool(block: Pick<BetaToolUseBlock, "id" | "name" | "input">): Promise<ToolOutcome> {
  try {
    const { summary, goalId, data, changed } = await execute(block.name, block.input);
    return {
      result: {
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify({ summary, ...data }),
      },
      display: { summary, goalId, isError: false },
      changed,
    };
  } catch (error) {
    const message = describeError(error);
    return {
      result: { type: "tool_result", tool_use_id: block.id, content: message, is_error: true },
      display: { summary: message, isError: true },
      changed: false,
    };
  }
}

type Executed = {
  summary: string;
  goalId?: string;
  data: Record<string, unknown>;
  changed: boolean;
};

async function execute(name: string, rawInput: unknown): Promise<Executed> {
  if (!(name in toolInputs)) throw new GoalError(`Unknown tool "${name}".`);
  switch (name as ToolName) {
    case "create_goal": {
      const input = toolInputs.create_goal.parse(rawInput);
      const goal = await createGoal(
        {
          title: input.title,
          horizon: input.horizon,
          description: input.description,
          dueDate: input.due_date ?? null,
          parentId: input.parent_goal_id ?? null,
          steps: input.steps,
        },
        NOVA,
      );
      const detail = await getGoalOrThrow(goal.id);
      return {
        summary: `Created “${goal.title}”${detail.steps.length ? ` with ${detail.steps.length} steps` : ""}`,
        goalId: goal.id,
        data: { goal: goalData(detail) },
        changed: true,
      };
    }
    case "update_goal": {
      const input = toolInputs.update_goal.parse(rawInput);
      if (input.progress !== undefined && (await getGoalOrThrow(input.goal_id)).steps.length > 0) {
        throw new GoalError(
          "This goal's progress comes from its steps. Update the steps with update_step instead.",
        );
      }
      const goal = await updateGoal(
        input.goal_id,
        {
          title: input.title,
          description: input.description,
          horizon: input.horizon,
          dueDate: input.due_date,
          parentId: input.parent_goal_id,
          status: input.status,
          manualProgress: input.progress,
        },
        { ...NOVA, note: input.note },
      );
      const detail = await getGoalOrThrow(goal.id);
      return {
        summary: `Updated “${goal.title}”${describeGoalChanges(input)}`,
        goalId: goal.id,
        data: { goal: goalData(detail) },
        changed: true,
      };
    }
    case "add_steps": {
      const input = toolInputs.add_steps.parse(rawInput);
      if (input.steps.length === 0) throw new GoalError("No steps given.");
      for (const step of input.steps) {
        await addStep(
          input.goal_id,
          { title: step.title, weight: step.weight, dueDate: step.due_date ?? null, notes: step.notes },
          NOVA,
        );
      }
      const detail = await getGoalOrThrow(input.goal_id);
      const n = input.steps.length;
      return {
        summary: `Added ${n === 1 ? `“${input.steps[0].title}”` : `${n} steps`} to “${detail.goal.title}”`,
        goalId: input.goal_id,
        data: { goal: goalData(detail) },
        changed: true,
      };
    }
    case "update_step": {
      const input = toolInputs.update_step.parse(rawInput);
      const step = await updateStep(
        input.step_id,
        {
          title: input.title,
          notes: input.notes,
          weight: input.weight,
          progress: input.progress,
          dueDate: input.due_date,
        },
        { ...NOVA, note: input.note },
      );
      const detail = await getGoalOrThrow(step.goalId);
      const summary =
        input.progress === undefined
          ? `Updated “${step.title}”`
          : step.progress === 100
            ? `Completed “${step.title}” · ${detail.goal.title} now ${detail.progress}%`
            : `“${step.title}” at ${step.progress}% · ${detail.goal.title} now ${detail.progress}%`;
      return { summary, goalId: step.goalId, data: { goal: goalData(detail) }, changed: true };
    }
    case "delete_step": {
      const input = toolInputs.delete_step.parse(rawInput);
      const before = await findStep(input.step_id);
      await deleteStep(input.step_id, NOVA);
      const detail = await getGoalOrThrow(before.goalId);
      return {
        summary: `Removed “${before.title}” from “${detail.goal.title}”`,
        goalId: before.goalId,
        data: { goal: goalData(detail) },
        changed: true,
      };
    }
    case "get_goal": {
      const input = toolInputs.get_goal.parse(rawInput);
      const detail = await getGoalOrThrow(input.goal_id);
      return {
        summary: `Looked at “${detail.goal.title}”`,
        goalId: detail.goal.id,
        data: {
          goal: goalData(detail),
          parent: detail.parent,
          short_term_goals: detail.children.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status,
            due_date: c.dueDate,
            progress: c.progress,
          })),
          recent_history: detail.history.slice(0, 15).map((h) => ({
            at: h.createdAt.toISOString(),
            progress: h.goalProgress,
            note: h.note,
            by: h.source,
          })),
        },
        changed: false,
      };
    }
  }
}

async function getGoalOrThrow(id: string) {
  const detail = await getGoal(id);
  if (!detail) throw new GoalError("That goal doesn't exist.");
  return detail;
}

async function findStep(stepId: string) {
  const step = await getStep(stepId);
  if (!step) throw new GoalError("That step doesn't exist.");
  return step;
}

function goalData(detail: NonNullable<Awaited<ReturnType<typeof getGoal>>>) {
  const { goal } = detail;
  return {
    id: goal.id,
    title: goal.title,
    horizon: goal.horizon,
    status: goal.status,
    due_date: goal.dueDate,
    progress: detail.progress,
    steps: detail.steps.map((s) => ({
      id: s.id,
      title: s.title,
      progress: s.progress,
      weight: s.weight,
      due_date: s.dueDate,
      notes: s.notes || undefined,
    })),
  };
}

function describeGoalChanges(input: z.infer<(typeof toolInputs)["update_goal"]>): string {
  if (input.status === "completed") return " · marked complete";
  if (input.status === "archived") return " · archived";
  if (input.status === "active") return " · reopened";
  if (input.due_date) return ` · due ${input.due_date}`;
  if (input.progress !== undefined) return ` · ${input.progress}%`;
  return "";
}

function describeError(error: unknown): string {
  if (error instanceof GoalError) return error.message;
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return `Invalid input${issue?.path.length ? ` for ${issue.path.join(".")}` : ""}: ${issue?.message ?? "unknown problem"}`;
  }
  console.error("Nova tool failed", error);
  return "Something went wrong while making that change.";
}
