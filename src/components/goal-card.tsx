import Link from "next/link";
import type { GoalSummary } from "@/lib/goals";
import { DueBadge } from "./due-badge";
import { ProgressBar } from "./progress-bar";
import { cardClass } from "./ui";

export function GoalCard({
  goal,
  today,
  parentTitle,
}: {
  goal: GoalSummary;
  today: string;
  parentTitle?: string;
}) {
  const done = goal.status !== "active";
  return (
    <Link
      href={`/goals/${goal.id}`}
      className={`${cardClass} group flex flex-col gap-4 p-5 transition hover:border-violet-300 hover:shadow-md dark:hover:border-violet-800`}
    >
      <div className="space-y-1.5">
        {parentTitle && (
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">↳ {parentTitle}</p>
        )}
        <h3 className="font-semibold leading-snug group-hover:text-violet-700 dark:group-hover:text-violet-300">
          {goal.title}
        </h3>
        {goal.dueDate && <DueBadge dueDate={goal.dueDate} today={today} done={done} />}
      </div>
      <div className="mt-auto space-y-2">
        <ProgressBar value={goal.progress} size="sm" label={`${goal.title} progress`} />
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{goal.progress}%</span>
          {goal.stepCount > 0 && (
            <span>
              {goal.stepsDone}/{goal.stepCount} steps
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
