"use client";

import { useId, useLayoutEffect, useState } from "react";
import {
  deleteStepAction,
  moveStepAction,
  setStepProgressAction,
  toggleStepAction,
  updateStepAction,
} from "@/app/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DueBadge } from "@/components/due-badge";
import { FormError } from "@/components/form-error";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/icons";
import { ProgressSlider } from "@/components/progress-slider";
import { buttonClass, iconButtonClass, inputClass, labelClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { Step } from "@/db/schema";

export function StepRow({
  step,
  today,
  isFirst,
  isLast,
}: {
  step: Step;
  today: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const done = step.progress === 100;

  // Next keeps visited pages alive but hidden; close the editor when this one is hidden.
  useLayoutEffect(() => () => setEditing(false), []);

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <form action={toggleStepAction.bind(null, step.id, !done)} className="pt-0.5">
          <button
            type="submit"
            aria-label={done ? `Mark “${step.title}” as not done` : `Mark “${step.title}” as done`}
            className={`flex size-5 items-center justify-center rounded-full border-2 transition-colors ${
              done
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-zinc-300 hover:border-violet-500 dark:border-zinc-600"
            }`}
          >
            {done && <CheckIcon className="size-3" strokeWidth={3} />}
          </button>
        </form>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={done ? "text-zinc-400 line-through dark:text-zinc-500" : ""}>{step.title}</span>
            {step.weight > 1 && (
              <span
                title="Weight: how much this step counts toward the goal"
                className="rounded bg-zinc-100 px-1.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              >
                ×{step.weight}
              </span>
            )}
            {step.dueDate && <DueBadge dueDate={step.dueDate} today={today} done={done} />}
          </div>
          {step.notes && (
            <p className="text-sm whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">{step.notes}</p>
          )}
          <div className="max-w-xs">
            <ProgressSlider
              key={step.progress}
              action={setStepProgressAction.bind(null, step.id)}
              value={step.progress}
              label={`Progress on “${step.title}”`}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <form action={moveStepAction.bind(null, step.id, "up")}>
            <button type="submit" disabled={isFirst} aria-label="Move up" className={iconButtonClass}>
              <ChevronUpIcon className="size-4" />
            </button>
          </form>
          <form action={moveStepAction.bind(null, step.id, "down")}>
            <button type="submit" disabled={isLast} aria-label="Move down" className={iconButtonClass}>
              <ChevronDownIcon className="size-4" />
            </button>
          </form>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-label="Edit step"
            aria-expanded={editing}
            className={iconButtonClass}
          >
            <PencilIcon className="size-4" />
          </button>
          <form action={deleteStepAction.bind(null, step.id)}>
            <ConfirmSubmit
              message={`Delete the step “${step.title}”?`}
              aria-label="Delete step"
              className={`${iconButtonClass} hover:text-red-600 dark:hover:text-red-400`}
            >
              <TrashIcon className="size-4" />
            </ConfirmSubmit>
          </form>
        </div>
      </div>

      {editing && <EditStepForm step={step} onDone={() => setEditing(false)} />}
    </li>
  );
}

function EditStepForm({ step, onDone }: { step: Step; onDone: () => void }) {
  const { state, pending, onSubmit } = useFormAction(updateStepAction.bind(null, step.id), {
    onSuccess: onDone,
  });
  const id = useId();

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 ml-8 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div>
        <label htmlFor={`${id}-title`} className={labelClass}>
          Step
        </label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={200}
          defaultValue={step.title}
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-weight`} className={labelClass}>
            Weight <span className="font-normal text-zinc-400">(how much it counts)</span>
          </label>
          <input
            id={`${id}-weight`}
            name="weight"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={step.weight}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-due`} className={labelClass}>
            Due date
          </label>
          <input
            id={`${id}-due`}
            name="dueDate"
            type="date"
            defaultValue={step.dueDate ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-notes`} className={labelClass}>
          Notes
        </label>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={2}
          maxLength={5000}
          defaultValue={step.notes}
          className={inputClass}
        />
      </div>
      <FormError message={state.error} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className={buttonClass.secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
