"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {error.message || "An unexpected error happened."}
      </p>
      <button type="button" onClick={() => retry()} className={buttonClass.primary}>
        Try again
      </button>
    </div>
  );
}
