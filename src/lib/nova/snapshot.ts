import type { Step } from "@/db/schema";
import { daysBetween } from "@/lib/dates";
import type { GoalSummary } from "@/lib/goals";

type GoalWithSteps = GoalSummary & { steps: Step[] };

/**
 * The current date and goals, as Nova sees them. Sent as a system message at
 * the start of a turn whenever it differs from the last one in the conversation.
 */
export function buildSnapshot(goals: GoalWithSteps[], today: string): string {
  const titles = new Map(goals.map((g) => [g.id, g.title]));
  const active = goals.filter((g) => g.status === "active");
  const finished = goals.filter((g) => g.status !== "active");

  const lines = [`Today is ${longDate(today)} (${today}).`, ""];
  if (active.length === 0) {
    lines.push("The user has no active goals yet.");
  } else {
    lines.push("The user's active goals:");
    for (const goal of active) lines.push(...describeGoal(goal, today, titles));
  }
  if (finished.length > 0) {
    lines.push("", "Completed or archived goals (use get_goal for details):");
    for (const goal of finished) lines.push(`- "${goal.title}" id=${goal.id} · ${goal.status}`);
  }
  return lines.join("\n");
}

function describeGoal(goal: GoalWithSteps, today: string, titles: Map<string, string>): string[] {
  const facts = [goal.horizon === "long" ? "long-term" : "short-term", `${goal.progress}% done`];
  if (goal.dueDate) facts.push(`due ${goal.dueDate} (${relativeDays(today, goal.dueDate)})`);
  if (goal.parentId) facts.push(`part of "${titles.get(goal.parentId) ?? "unknown"}"`);

  const lines = [`- "${goal.title}" id=${goal.id} · ${facts.join(" · ")}`];
  if (goal.description) lines.push(`  Details: ${truncate(goal.description.replace(/\s+/g, " "), 400)}`);
  if (goal.steps.length === 0) lines.push("  No steps; progress is set manually.");
  for (const step of goal.steps) {
    const stepFacts = [`${step.progress}%`];
    if (step.weight > 1) stepFacts.push(`weight ${step.weight}`);
    if (step.dueDate) stepFacts.push(`due ${step.dueDate} (${relativeDays(today, step.dueDate)})`);
    lines.push(`  - step "${step.title}" step_id=${step.id} · ${stepFacts.join(" · ")}`);
  }
  return lines;
}

function relativeDays(today: string, date: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "1 day overdue";
  return days > 0 ? `in ${days} days` : `${-days} days overdue`;
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(y, m - 1, d));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
