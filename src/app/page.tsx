import { connection } from "next/server";
import { Suspense } from "react";
import { GoalCard } from "@/components/goal-card";
import { NewGoalPanel } from "@/components/new-goal-form";
import { daysBetween, todayISO } from "@/lib/dates";
import { type GoalSummary, listGoals, listParentOptions } from "@/lib/goals";

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await connection();
  const [goals, parentOptions] = await Promise.all([listGoals(), listParentOptions()]);
  const today = todayISO();

  const active = goals.filter((g) => g.status === "active");
  const longTerm = active.filter((g) => g.horizon === "long");
  const shortTerm = active.filter((g) => g.horizon === "short");
  const finished = goals.filter((g) => g.status !== "active");
  const titles = new Map(goals.map((g) => [g.id, g.title]));
  const dueThisWeek = active.filter((g) => {
    if (!g.dueDate) return false;
    const days = daysBetween(today, g.dueDate);
    return days >= 0 && days <= 7;
  }).length;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your goals</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {active.length === 0
              ? "Nothing on the board yet. Start with something big, or something due soon."
              : `${active.length} active · ${dueThisWeek} due in the next 7 days`}
          </p>
        </div>
        {goals.length > 0 && <NewGoalPanel parentOptions={parentOptions} />}
      </div>

      {goals.length === 0 && <NewGoalPanel parentOptions={parentOptions} defaultOpen />}

      <GoalSection
        title="Long-term"
        goals={longTerm}
        today={today}
        empty="Big goals you're working toward over months or years."
      />
      <GoalSection
        title="Short-term"
        goals={shortTerm}
        today={today}
        titles={titles}
        empty="Assignments, tasks and anything due soon."
      />

      {finished.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            Completed and archived ({finished.length})
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {finished.map((goal) => (
              <GoalCard key={goal.id} goal={goal} today={today} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function GoalSection({
  title,
  goals,
  today,
  titles,
  empty,
}: {
  title: string;
  goals: GoalSummary[];
  today: string;
  titles?: Map<string, string>;
  empty: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {title}
      </h2>
      {goals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              today={today}
              parentTitle={goal.parentId ? titles?.get(goal.parentId) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="h-9 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
