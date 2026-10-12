"use client";

import { useId, useLayoutEffect, useState } from "react";
import { createGoalAction } from "@/app/actions";
import type { Goal, GoalHorizon } from "@/db/schema";
import { FormError } from "./form-error";
import { PlusIcon } from "./icons";
import { buttonClass, cardClass, inputClass, labelClass } from "./ui";
import { useFormAction } from "./use-form-action";

type ParentOption = Pick<Goal, "id" | "title">;

const horizonOptions: { value: GoalHorizon; label: string; hint: string }[] = [
  { value: "long", label: "Long-term", hint: "A big goal you'll work toward over months" },
  { value: "short", label: "Short-term", hint: "Something to get done soon, like an assignment" },
];

/**
 * A "New goal" button that opens the form. With `fixedParent`, it creates a
 * short-term goal under that long-term goal.
 */
export function NewGoalPanel({
  parentOptions,
  fixedParent,
  defaultOpen = false,
  buttonLabel = "New goal",
}: {
  parentOptions: ParentOption[];
  fixedParent?: ParentOption;
  defaultOpen?: boolean;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [horizon, setHorizon] = useState<GoalHorizon>(fixedParent ? "short" : "long");
  const { state, pending, onSubmit } = useFormAction(createGoalAction);
  const id = useId();

  // Next keeps visited pages alive but hidden; reset the form when this one is hidden.
  useLayoutEffect(() => () => setOpen(defaultOpen), [defaultOpen]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass.primary}>
        <PlusIcon className="size-4" />
        {buttonLabel}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`${cardClass} w-full space-y-5 p-5 sm:p-6`}>
      <h2 className="font-semibold">
        {fixedParent ? `New short-term goal for “${fixedParent.title}”` : "New goal"}
      </h2>

      <div>
        <label htmlFor={`${id}-goal-title`} className={labelClass}>
          What do you want to achieve?
        </label>
        <input
          id={`${id}-goal-title`}
          name="title"
          required
          maxLength={200}
          autoFocus
          placeholder={fixedParent ? "e.g. Submit the research proposal" : "e.g. Get a first-class degree"}
          className={inputClass}
        />
      </div>

      {fixedParent ? (
        <>
          <input type="hidden" name="horizon" value="short" />
          <input type="hidden" name="parentId" value={fixedParent.id} />
        </>
      ) : (
        <fieldset>
          <legend className={labelClass}>Type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {horizonOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 p-3 has-checked:border-violet-500 has-checked:bg-violet-50 dark:border-zinc-700 dark:has-checked:bg-violet-950/40"
              >
                <input
                  type="radio"
                  name="horizon"
                  value={option.value}
                  checked={horizon === option.value}
                  onChange={() => setHorizon(option.value)}
                  className="mt-1 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-goal-due`} className={labelClass}>
            Due date <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input id={`${id}-goal-due`} name="dueDate" type="date" className={inputClass} />
        </div>
        {!fixedParent && horizon === "short" && parentOptions.length > 0 && (
          <div>
            <label htmlFor={`${id}-goal-parent`} className={labelClass}>
              Part of <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <select id={`${id}-goal-parent`} name="parentId" defaultValue="" className={inputClass}>
              <option value="">No long-term goal</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-goal-steps`} className={labelClass}>
          Steps <span className="font-normal text-zinc-400">(one per line, bullet points work)</span>
        </label>
        <textarea
          id={`${id}-goal-steps`}
          name="steps"
          rows={4}
          placeholder={"- Research sources\n- Write outline\n- First draft"}
          className={`${inputClass} font-mono`}
        />
      </div>

      <div>
        <label htmlFor={`${id}-goal-description`} className={labelClass}>
          Details <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id={`${id}-goal-description`}
          name="description"
          rows={3}
          maxLength={5000}
          placeholder="Why this matters, requirements, anything worth remembering"
          className={inputClass}
        />
      </div>

      <FormError message={state.error} />

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Creating…" : "Create goal"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass.secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
