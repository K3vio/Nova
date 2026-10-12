import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  deleteGoalAction,
  setGoalStatusAction,
  setManualProgressAction,
} from "@/app/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DueBadge } from "@/components/due-badge";
import { GoalCard } from "@/components/goal-card";
import { ArrowLeftIcon, SparkleIcon } from "@/components/icons";
import { NewGoalPanel } from "@/components/new-goal-form";
import { ProgressBar } from "@/components/progress-bar";
import { ProgressSlider } from "@/components/progress-slider";
import { buttonClass, cardClass } from "@/components/ui";
import type { GoalStatus } from "@/db/schema";
import { formatDateTime, todayISO } from "@/lib/dates";
import { getGoal, listParentOptions } from "@/lib/goals";
import { AddStepForm } from "./add-step-form";
import { EditGoalPanel } from "./edit-goal-form";
import { StepRow } from "./step-row";

export default function GoalPage({ params }: PageProps<"/goals/[id]">) {
  return (
    <Suspense fallback={<GoalSkeleton />}>
      <GoalView params={params} />
    </Suspense>
  );
}

async function GoalView({ params }: Pick<PageProps<"/goals/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const [detail, parentOptions] = await Promise.all([getGoal(id), listParentOptions()]);
  if (!detail) notFound();

  const { goal, progress, steps, parent, children, history } = detail;
  const today = todayISO();
  const stepsDone = steps.filter((s) => s.progress === 100).length;
  // Keep the current parent selectable even if it's no longer active.
  const editParentOptions =
    parent && !parentOptions.some((p) => p.id === parent.id)
      ? [parent, ...parentOptions]
      : parentOptions;

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeftIcon className="size-4" />
        All goals
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
            {goal.horizon === "long" ? "Long-term" : "Short-term"}
          </span>
          {goal.status !== "active" && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 capitalize dark:bg-emerald-950 dark:text-emerald-300">
              {goal.status}
            </span>
          )}
          {goal.dueDate && (
            <DueBadge dueDate={goal.dueDate} today={today} done={goal.status !== "active"} />
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{goal.title}</h1>
        {parent && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Part of{" "}
            <Link href={`/goals/${parent.id}`} className="font-medium text-violet-700 hover:underline dark:text-violet-300">
              {parent.title}
            </Link>
          </p>
        )}
        {goal.description && (
          <p className="max-w-3xl whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">{goal.description}</p>
        )}
      </header>

      <section className={`${cardClass} space-y-3 p-5 sm:p-6`}>
        <div className="flex items-baseline justify-between">
          <span className="text-4xl font-semibold tabular-nums">{progress}%</span>
          {steps.length > 0 && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {stepsDone} of {steps.length} steps done
            </span>
          )}
        </div>
        <ProgressBar value={progress} size="lg" label="Goal progress" />
        {steps.length === 0 && (
          <div className="space-y-1 pt-2">
            <ProgressSlider
              key={goal.manualProgress}
              action={setManualProgressAction.bind(null, goal.id)}
              value={goal.manualProgress}
              label="Set progress"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Drag to set progress, or add steps below and Nova will work it out from them.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Steps</h2>
        <div className={`${cardClass} space-y-5 p-5 sm:p-6`}>
          {steps.length > 0 && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {steps.map((step, i) => (
                <StepRow
                  key={step.id}
                  step={step}
                  today={today}
                  isFirst={i === 0}
                  isLast={i === steps.length - 1}
                />
              ))}
            </ul>
          )}
          <AddStepForm goalId={goal.id} />
        </div>
      </section>

      {goal.horizon === "long" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Short-term goals</h2>
            <NewGoalPanel
              parentOptions={[]}
              fixedParent={{ id: goal.id, title: goal.title }}
              buttonLabel="Add short-term goal"
            />
          </div>
          {children.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => (
                <GoalCard key={child.id} goal={child} today={today} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Break this goal into smaller goals with their own deadlines.
            </p>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">History</h2>
        <ol className={`${cardClass} divide-y divide-zinc-100 dark:divide-zinc-800`}>
          {history.map((entry) => (
            <li key={entry.id} className="flex items-center gap-4 px-5 py-3 text-sm">
              <span className="w-12 shrink-0 font-medium tabular-nums">{entry.goalProgress}%</span>
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                {entry.note || "Progress updated"}
              </span>
              {entry.source === "nova" && (
                <span className="inline-flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300">
                  <SparkleIcon className="size-3" />
                  Nova
                </span>
              )}
              <time
                dateTime={entry.createdAt.toISOString()}
                className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
              >
                {formatDateTime(entry.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-wrap items-start gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <EditGoalPanel goal={goal} parentOptions={editParentOptions} />
        <StatusButtons goalId={goal.id} status={goal.status} />
        <form action={deleteGoalAction.bind(null, goal.id)} className="ml-auto">
          <ConfirmSubmit
            message={`Delete “${goal.title}” and all its steps and history? This can't be undone.`}
            className={buttonClass.danger}
          >
            Delete goal
          </ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}

function StatusButtons({ goalId, status }: { goalId: string; status: GoalStatus }) {
  const actions: { status: GoalStatus; label: string }[] =
    status === "active"
      ? [
          { status: "completed", label: "Mark complete" },
          { status: "archived", label: "Archive" },
        ]
      : [{ status: "active", label: "Reopen" }];

  return actions.map((a) => (
    <form key={a.status} action={setGoalStatusAction.bind(null, goalId, a.status)}>
      <button type="submit" className={buttonClass.secondary}>
        {a.label}
      </button>
    </form>
  ));
}

function GoalSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-9 w-2/3 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
