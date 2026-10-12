"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckIcon, SparkleIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import type { NovaEvent } from "@/lib/nova/agent";
import { appendText, type ChatItem, type ChatPart } from "@/lib/nova/transcript";

const suggestions = [
  "Help me plan a big goal",
  "I have an assignment due soon",
  "Here's what I got done today:",
  "What should I focus on this week?",
];

export function ChatView({
  conversationId,
  initialItems,
  connected,
}: {
  conversationId: string | null;
  initialItems: ChatItem[];
  connected: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [syncedItems, setSyncedItems] = useState(initialItems);
  const [streaming, setStreaming] = useState<ChatPart[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const busy = streaming !== null;
  const idRef = useRef(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The server's transcript is the source of truth once it refreshes after a turn.
  if (initialItems !== syncedItems) {
    setSyncedItems(initialItems);
    setItems(initialItems);
  }

  // Next keeps visited pages alive but hidden. When the "new chat" page is
  // hidden (e.g. after its first message became a conversation), clear it so
  // the next new chat starts empty.
  useLayoutEffect(
    () => () => {
      idRef.current = conversationId;
      setError(null);
      if (conversationId === null) setItems([]);
    },
    [conversationId],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, streaming]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setInput("");
    setItems((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", text: message }]);
    setStreaming([]);

    let parts: ChatPart[] = [];
    let newConversationId: string | null = null;
    let failure: string | null = null;
    const update = (next: ChatPart[]) => {
      parts = next;
      setStreaming(next);
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: idRef.current, message }),
      });
      if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);
      for await (const event of readEvents(response.body)) {
        if (event.type === "text") {
          update(appendText(parts, event.text));
        } else if (event.type === "tool_start") {
          update([...parts, { kind: "tool", id: event.id, summary: "Working…", isError: false, pending: true }]);
        } else if (event.type === "tool_result") {
          const { id, summary, goalId, isError } = event;
          update(parts.map((p) => (p.kind === "tool" && p.id === id ? { kind: "tool", id, summary, goalId, isError } : p)));
        } else if (event.type === "conversation") {
          newConversationId = event.id;
        } else if (event.type === "error") {
          failure = event.message;
        }
      }
    } catch {
      failure = "Couldn't reach Nova. Check that the app is still running.";
    }

    // Tool calls that never finished (e.g. the stream broke) aren't saved.
    const shown = parts.filter((p) => !(p.kind === "tool" && p.pending));
    const savedSomething = !failure || shown.some((p) => p.kind === "tool");
    if (failure) setError(failure);

    if (savedSomething) {
      if (shown.length > 0) {
        setItems((prev) => [...prev, { id: `local-nova-${Date.now()}`, role: "nova", parts: shown }]);
      }
      if (newConversationId) {
        idRef.current = newConversationId;
        router.replace(`/chat/${newConversationId}`);
      } else {
        router.refresh();
      }
    } else {
      // Nothing was saved: take the message back so it can be retried.
      setItems((prev) => prev.slice(0, -1));
      setInput(message);
    }
    setStreaming(null);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  const empty = items.length === 0 && !busy;

  return (
    <section aria-busy={busy} className="flex min-h-0 flex-1 flex-col">
      {!connected && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Nova isn&apos;t connected to Claude yet. Add <code className="font-mono">ANTHROPIC_API_KEY=…</code> to{" "}
          <code className="font-mono">.env.local</code> and restart the app.
        </p>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <SparkleIcon className="size-6" />
            </span>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Hi, I&apos;m Nova.</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Tell me what you&apos;re working toward, what you got done, or what changed.
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setInput(s.endsWith(":") ? `${s} ` : s);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-700 dark:hover:text-violet-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="space-y-6 pb-4">
            {items.map((item) =>
              item.role === "user" ? (
                <UserMessage key={item.id} text={item.text} />
              ) : (
                <NovaMessage key={item.id} parts={item.parts} />
              ),
            )}
            {streaming && <NovaMessage parts={streaming} thinking />}
          </ol>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 shadow-xs focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/30 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Message Nova…"
          aria-label="Message Nova"
          className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
        {text}
      </p>
    </li>
  );
}

function NovaMessage({ parts, thinking = false }: { parts: ChatPart[]; thinking?: boolean }) {
  const waiting = thinking && (parts.length === 0 || parts.at(-1)?.kind === "tool");
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
        <SparkleIcon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed">
        {parts.map((part, i) =>
          part.kind === "text" ? (
            <div key={i}>
              <Markdown>{part.text}</Markdown>
            </div>
          ) : (
            <ToolChip key={part.id} part={part} />
          ),
        )}
        {waiting && (
          <p className="flex items-center gap-1 py-1 text-zinc-400" aria-label="Nova is thinking">
            <span className="size-1.5 animate-bounce rounded-full bg-current" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
          </p>
        )}
      </div>
    </li>
  );
}

function ToolChip({ part }: { part: Extract<ChatPart, { kind: "tool" }> }) {
  const tone = part.isError
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
    : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
  const content = (
    <>
      {part.pending ? (
        <span className="size-3 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      ) : part.isError ? (
        <span aria-hidden="true">!</span>
      ) : (
        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
      )}
      <span className="min-w-0 truncate">{part.summary}</span>
    </>
  );
  const className = `inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1 text-xs ${tone}`;
  return (
    <div>
      {part.goalId ? (
        <Link href={`/goals/${part.goalId}`} className={`${className} hover:border-violet-300 dark:hover:border-violet-700`}>
          {content}
        </Link>
      ) : (
        <span className={className}>{content}</span>
      )}
    </div>
  );
}

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<NovaEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as NovaEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as NovaEvent;
}
