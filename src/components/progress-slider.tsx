"use client";

import { useRef, useState } from "react";

/**
 * A 0-100 slider that saves when you let go. Give it `key={value}` so it
 * resets to the saved value after the page refreshes.
 */
export function ProgressSlider({
  action,
  value,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  value: number;
  label: string;
}) {
  const [current, setCurrent] = useState(value);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(value);
  const keyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reads the value from the form so it's never a stale render's value.
  function commit() {
    clearTimeout(keyTimer.current);
    const form = formRef.current;
    if (!form) return;
    const next = Number(new FormData(form).get("progress"));
    if (next === submitted.current) return;
    submitted.current = next;
    form.requestSubmit();
  }

  // Arrow keys move in small steps; save once the user pauses so the history
  // gets one entry instead of one per key press.
  function commitSoon() {
    clearTimeout(keyTimer.current);
    keyTimer.current = setTimeout(commit, 600);
  }

  return (
    <form ref={formRef} action={action} className="flex items-center gap-3">
      <input
        type="range"
        name="progress"
        min={0}
        max={100}
        step={5}
        value={current}
        onChange={(event) => setCurrent(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commitSoon}
        onBlur={commit}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer"
      />
      <output className="w-10 shrink-0 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
        {current}%
      </output>
    </form>
  );
}
