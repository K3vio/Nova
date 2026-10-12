"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import type { FormState } from "@/app/actions";

/**
 * Runs a form-state server action from onSubmit instead of the form's `action`
 * prop, so React doesn't clear what the user typed when validation fails.
 */
export function useFormAction(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  { onSuccess }: { onSuccess?: (form: HTMLFormElement) => void } = {},
) {
  const [state, dispatch, pending] = useActionState(
    async (prev: FormState, { form, formData }: { form: HTMLFormElement; formData: FormData }) => {
      const result = await action(prev, formData);
      if (result.ok) onSuccess?.(form);
      return result;
    },
    {},
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(() => dispatch({ form, formData }));
  }

  return { state, pending, onSubmit };
}
