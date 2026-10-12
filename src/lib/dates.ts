// Due dates are stored as plain calendar dates (YYYY-MM-DD). Parsing them as
// UTC midnight keeps day arithmetic free of timezone and DST surprises.

const DAY_MS = 24 * 60 * 60 * 1000;

function parseISODate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Today's date in the server's local timezone, as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO) - parseISODate(fromISO)) / DAY_MS);
}

export function formatDate(iso: string, today: string): string {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(parseISODate(iso));
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export type DueTone = "overdue" | "soon" | "later";

export function describeDue(
  dueDate: string,
  today: string,
): { label: string; tone: DueTone } {
  const days = daysBetween(today, dueDate);
  const date = formatDate(dueDate, today);
  if (days < 0) {
    const n = -days;
    return { label: `${date} · ${n} day${n === 1 ? "" : "s"} overdue`, tone: "overdue" };
  }
  if (days === 0) return { label: `${date} · today`, tone: "soon" };
  if (days === 1) return { label: `${date} · tomorrow`, tone: "soon" };
  return { label: `${date} · in ${days} days`, tone: days <= 7 ? "soon" : "later" };
}
