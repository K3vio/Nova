import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatScreen } from "../chat-screen";
import { ChatSkeleton } from "../chat-skeleton";

export const metadata: Metadata = { title: "New chat" };

export default function NewChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatScreen conversationId={null} />
    </Suspense>
  );
}
