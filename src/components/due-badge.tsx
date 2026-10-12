import { type DueTone, describeDue } from "@/lib/dates";

const tones: Record<DueTone | "done", string> = {
  overdue: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900",
  soon: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900",
  later: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
  done: "bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
};

export function DueBadge({
  dueDate,
  today,
  done = false,
}: {
  dueDate: string;
  today: string;
  done?: boolean;
}) {
  const { label, tone } = describeDue(dueDate, today);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${tones[done ? "done" : tone]}`}
    >
      Due {label}
    </span>
  );
}
