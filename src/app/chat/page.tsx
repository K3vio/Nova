import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatScreen } from "./chat-screen";
import { ChatSkeleton } from "./chat-skeleton";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatScreen conversationId="latest" />
    </Suspense>
  );
}
