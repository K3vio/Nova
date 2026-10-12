export function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-7.5rem)] animate-pulse gap-6 sm:h-[calc(100dvh-8.5rem)]">
      <div className="hidden w-56 rounded-2xl bg-zinc-200 md:block dark:bg-zinc-800" />
      <div className="flex flex-1 flex-col justify-end">
        <div className="h-14 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
