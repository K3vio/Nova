"use client";

import type { ComponentProps } from "react";

/** A submit button that asks for confirmation first. */
export function ConfirmSubmit({
  message,
  onClick,
  ...props
}: ComponentProps<"button"> & { message: string }) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    />
  );
}
