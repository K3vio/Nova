import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteConversationAction } from "@/app/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { buttonClass, iconButtonClass } from "@/components/ui";
import type { Conversation } from "@/db/schema";
import { getConversation, listConversations } from "@/lib/conversations";
import { hasApiCredentials } from "@/lib/nova/client";
import { toChatItems } from "@/lib/nova/transcript";
import { ChatView } from "./chat-view";

/**
 * The chat page. `"latest"` opens the most recent conversation, `null` starts
 * a new one.
 */
export async function ChatScreen({ conversationId }: { conversationId: string | null | "latest" }) {
  await connection();
  const list = await listConversations();
  const id = conversationId === "latest" ? (list[0]?.id ?? null) : conversationId;
  const current = id ? await getConversation(id) : null;
  if (id && !current) notFound();

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] gap-6 sm:h-[calc(100dvh-8.5rem)]">
      <aside className="hidden w-56 shrink-0 flex-col gap-3 md:flex">
        <ConversationList conversations={list} currentId={id} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <details className="relative min-w-0">
            <summary className="cursor-pointer truncate text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {current?.conversation.title ?? "New chat"}
            </summary>
            <div className="absolute z-20 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              <ConversationList conversations={list} currentId={id} />
            </div>
          </details>
          <Link href="/chat/new" className={buttonClass.secondary}>
            <PlusIcon className="size-4" />
            New
          </Link>
        </div>
        <ChatView
          key={id ?? "new"}
          conversationId={id}
          initialItems={current ? toChatItems(current.messages) : []}
          connected={hasApiCredentials()}
        />
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  currentId,
}: {
  conversations: Conversation[];
  currentId: string | null;
}) {
  return (
    <>
      <Link href="/chat/new" className={`${buttonClass.secondary} hidden md:inline-flex`}>
        <PlusIcon className="size-4" />
        New chat
      </Link>
      {conversations.length > 0 && (
        <nav aria-label="Conversations" className="min-h-0 overflow-y-auto">
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const active = c.id === currentId;
              return (
                <li key={c.id} className="group flex items-center gap-1">
                  <Link
                    href={`/chat/${c.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-violet-100 font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-200"
                        : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {c.title}
                  </Link>
                  <form action={deleteConversationAction.bind(null, c.id, active)}>
                    <ConfirmSubmit
                      message={`Delete the chat “${c.title}”? Your goals stay as they are.`}
                      aria-label={`Delete chat “${c.title}”`}
                      className={`${iconButtonClass} opacity-0 group-hover:opacity-100 focus:opacity-100`}
                    >
                      <TrashIcon className="size-3.5" />
                    </ConfirmSubmit>
                  </form>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
