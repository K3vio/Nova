import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        That goal doesn&apos;t exist. It may have been deleted.
      </p>
      <Link href="/" className={buttonClass.primary}>
        Back to your goals
      </Link>
    </div>
  );
}
