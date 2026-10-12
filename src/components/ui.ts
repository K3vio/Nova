// Shared Tailwind class strings so forms and buttons look the same everywhere.

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-xs placeholder:text-zinc-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500";

export const labelClass = "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttonClass = {
  primary: `${buttonBase} bg-violet-600 text-white hover:bg-violet-500`,
  secondary: `${buttonBase} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800`,
  danger: `${buttonBase} border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`,
};

export const iconButtonClass =
  "inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export const cardClass =
  "rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900";
