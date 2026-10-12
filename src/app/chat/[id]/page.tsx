import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatScreen } from "../chat-screen";
import { ChatSkeleton } from "../chat-skeleton";

export const metadata: Metadata = { title: "Chat" };

export default function ConversationPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      {params.then(({ id }) => (
        <ChatScreen conversationId={id} />
      ))}
    </Suspense>
  );
}
