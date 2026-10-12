const heights = { sm: "h-1.5", md: "h-2", lg: "h-3" };

export function ProgressBar({
  value,
  size = "md",
  label = "Progress",
}: {
  value: number;
  size?: keyof typeof heights;
  label?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${heights[size]}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${value === 100 ? "bg-emerald-500" : "bg-violet-500"}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
