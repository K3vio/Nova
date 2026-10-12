"use client";

import { useId, useLayoutEffect, useState } from "react";
import { updateGoalAction } from "@/app/actions";
import { FormError } from "@/components/form-error";
import { PencilIcon } from "@/components/icons";
import { buttonClass, cardClass, inputClass, labelClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { Goal, GoalHorizon } from "@/db/schema";

export function EditGoalPanel({
  goal,
  parentOptions,
}: {
  goal: Goal;
  parentOptions: Pick<Goal, "id" | "title">[];
}) {
  const [open, setOpen] = useState(false);
  const [horizon, setHorizon] = useState<GoalHorizon>(goal.horizon);
  const { state, pending, onSubmit } = useFormAction(updateGoalAction.bind(null, goal.id), {
    onSuccess: () => setOpen(false),
  });
  const parents = parentOptions.filter((p) => p.id !== goal.id);
  const id = useId();

  // Next keeps visited pages alive but hidden; close the form when this one is hidden.
  useLayoutEffect(() => () => setOpen(false), []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setHorizon(goal.horizon);
          setOpen(true);
        }}
        className={buttonClass.secondary}
      >
        <PencilIcon className="size-4" />
        Edit details
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`${cardClass} w-full space-y-5 p-5 sm:p-6`}>
      <h2 className="font-semibold">Edit goal</h2>
      <div>
        <label htmlFor={`${id}-edit-title`} className={labelClass}>
          Title
        </label>
        <input
          id={`${id}-edit-title`}
          name="title"
          required
          maxLength={200}
          defaultValue={goal.title}
          className={inputClass}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-edit-horizon`} className={labelClass}>
            Type
          </label>
          <select
            id={`${id}-edit-horizon`}
            name="horizon"
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as GoalHorizon)}
            className={inputClass}
          >
            <option value="long">Long-term</option>
            <option value="short">Short-term</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-edit-due`} className={labelClass}>
            Due date
          </label>
          <input
            id={`${id}-edit-due`}
            name="dueDate"
            type="date"
            defaultValue={goal.dueDate ?? ""}
            className={inputClass}
          />
        </div>
        {horizon === "short" && (
          <div>
            <label htmlFor={`${id}-edit-parent`} className={labelClass}>
              Part of
            </label>
            <select
              id={`${id}-edit-parent`}
              name="parentId"
              defaultValue={goal.parentId ?? ""}
              className={inputClass}
            >
              <option value="">No long-term goal</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-edit-description`} className={labelClass}>
          Details
        </label>
        <textarea
          id={`${id}-edit-description`}
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={goal.description}
          className={inputClass}
        />
      </div>
      <FormError message={state.error} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass.secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
