"use client";

import { addStepAction } from "@/app/actions";
import { FormError } from "@/components/form-error";
import { PlusIcon } from "@/components/icons";
import { buttonClass, inputClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";

export function AddStepForm({ goalId }: { goalId: string }) {
  const { state, pending, onSubmit } = useFormAction(addStepAction.bind(null, goalId), {
    onSuccess: (form) => form.reset(),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Add a step…"
          aria-label="New step"
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          <PlusIcon className="size-4" />
          Add
        </button>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
