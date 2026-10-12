import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

export const goalHorizons = ["long", "short"] as const;
export const goalStatuses = ["active", "completed", "archived"] as const;
export const progressSources = ["user", "nova"] as const;

export const goals = sqliteTable(
  "goals",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    horizon: text("horizon", { enum: goalHorizons }).notNull(),
    // A short-term goal can roll up into a long-term one.
    parentId: text("parent_id").references((): AnySQLiteColumn => goals.id, {
      onDelete: "set null",
    }),
    // Calendar date (YYYY-MM-DD), no time or timezone.
    dueDate: text("due_date"),
    status: text("status", { enum: goalStatuses }).notNull().default("active"),
    // Only used when the goal has no steps; otherwise progress comes from steps.
    manualProgress: integer("manual_progress").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("goals_parent_idx").on(t.parentId)],
);

export const steps = sqliteTable(
  "steps",
  {
    id: id(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    // Relative size of this step when computing the goal's overall progress.
    weight: integer("weight").notNull().default(1),
    progress: integer("progress").notNull().default(0),
    position: integer("position").notNull(),
    dueDate: text("due_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("steps_goal_idx").on(t.goalId, t.position)],
);

// One row each time a goal's overall progress changes; powers the progress chart.
export const progressEntries = sqliteTable(
  "progress_entries",
  {
    id: id(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    stepId: text("step_id").references(() => steps.id, {
      onDelete: "set null",
    }),
    goalProgress: integer("goal_progress").notNull(),
    note: text("note").notNull().default(""),
    source: text("source", { enum: progressSources }).notNull().default("user"),
    createdAt: createdAt(),
  },
  (t) => [index("progress_goal_idx").on(t.goalId, t.createdAt)],
);

export type Goal = typeof goals.$inferSelect;
export type Step = typeof steps.$inferSelect;
export type ProgressEntry = typeof progressEntries.$inferSelect;
export type GoalHorizon = (typeof goalHorizons)[number];
export type GoalStatus = (typeof goalStatuses)[number];
export type ProgressSource = (typeof progressSources)[number];
