import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import { asc, desc, eq, gte, and, max } from "drizzle-orm";
import { db } from "@/db";
import { type ChatMessage, chatMessages, type Conversation, conversations } from "@/db/schema";

export async function listConversations(): Promise<Conversation[]> {
  return db.select().from(conversations).orderBy(desc(conversations.updatedAt));
}

export async function getConversation(
  id: string,
): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
  const conversation = await db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(asc(chatMessages.position));
  return { conversation, messages };
}

export async function createConversation(firstMessage: string): Promise<Conversation> {
  const [conversation] = await db
    .insert(conversations)
    .values({ title: titleFrom(firstMessage) })
    .returning();
  return conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  await db.delete(conversations).where(eq(conversations.id, id));
}

/** Appends messages in order. Returns the position of the first one. */
export async function appendMessages(
  conversationId: string,
  messages: BetaMessageParam[],
): Promise<number> {
  return db.transaction(async (tx) => {
    const last = await tx
      .select({ value: max(chatMessages.position) })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .get();
    const start = (last?.value ?? -1) + 1;
    await tx.insert(chatMessages).values(
      messages.map((m, i) => ({
        conversationId,
        position: start + i,
        role: m.role,
        content: m.content,
      })),
    );
    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return start;
  });
}

/**
 * Removes the messages of a turn that failed before Nova replied. Only ever
 * call this for the newest messages, so earlier history stays untouched.
 */
export async function removeMessagesFrom(conversationId: string, position: number): Promise<void> {
  await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), gte(chatMessages.position, position)));
}

function titleFrom(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 60) return oneLine || "New chat";
  const cut = oneLine.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 30 ? lastSpace : 60)}…`;
}
