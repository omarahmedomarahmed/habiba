"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquarePlus, Send, Trash2 } from "lucide-react";

import { ask, removeThread, startThread } from "@/app/(app)/assistant/actions";
import { Badge, Card } from "@/components/ui";
import { linkRoster, type RosterEntry } from "@/lib/assistant/roster";
import { cn } from "@/lib/utils";

/**
 * The general copilot. PLAN.md 10.1–10.5.
 *
 * ## Links are rendered from stored mentions, never from the text
 *
 * `linkRoster` runs here over the mentions the **server** resolved and saved
 * on the message, not over the whole roster and not over anything the model
 * claimed. So the worst a hallucinated name can do is appear as plain text.
 * That is the whole of 10.3, and it is the reason this component never
 * receives the roster itself.
 */

type Message = {
  id: string;
  role: "therapist" | "assistant";
  content: string;
  mentions: RosterEntry[];
};

export function AssistantChat({
  threadId,
  threads,
  initial,
  used,
  limit,
}: {
  threadId: string | null;
  threads: { id: string; title: string }[];
  initial: Message[];
  used: number;
  limit: number;
}) {
  const [messages, setMessages] = useState(initial);
  const [question, setQuestion] = useState("");
  const [spent, setSpent] = useState(used);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    if (!threadId || !question.trim()) return;
    const asked = question.trim();

    startTransition(async () => {
      setError(null);
      setQuestion("");
      setMessages((m) => [
        ...m,
        { id: `local-${Date.now()}`, role: "therapist", content: asked, mentions: [] },
      ]);

      const result = await ask(threadId, asked);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.answer) {
        setMessages((m) => [
          ...m,
          {
            id: `answer-${Date.now()}`,
            role: "assistant",
            content: result.answer!.content,
            mentions: result.answer!.mentions,
          },
        ]);
      }
      if (typeof result.used === "number") setSpent(result.used);
    });
  };

  const remaining = Math.max(0, limit - spent);

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* ------------------------------------------------------- 10.4 threads */}
      <aside className="space-y-2">
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const result = await startThread();
              if (result.id) window.location.href = `/assistant?thread=${result.id}`;
            })
          }
          className="tap-target flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          New chat
        </button>

        <ul className="space-y-1">
          {threads.map((thread) => (
            <li key={thread.id} className="group flex items-center gap-1">
              <Link
                href={`/assistant?thread=${thread.id}`}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm",
                  thread.id === threadId
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                {thread.title}
              </Link>
              <button
                type="button"
                aria-label={`Delete ${thread.title}`}
                onClick={() =>
                  startTransition(async () => {
                    await removeThread(thread.id);
                    if (thread.id === threadId) window.location.href = "/assistant";
                  })
                }
                className="tap-target shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ---------------------------------------------------------- the chat */}
      <div className="min-w-0 space-y-3">
        <Card className="flex min-h-[24rem] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs text-slate-500">
              Your roster only — names, dates and what is waiting. Not clinical notes.
            </p>
            {/*
              10.5. Shown as what is left rather than what is spent: a
              clinician glancing at this wants to know whether to ask, not to
              be scored on how much they have used.
            */}
            <Badge tone={remaining <= 5 ? "amber" : "slate"}>{remaining} left this month</Badge>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-sm leading-relaxed text-slate-500">
                Ask about your week. “Who have I not seen in a month?” “How many notes am I behind
                on?” For anything about what a patient actually said, open their own copilot — this
                one cannot see clinical records.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    message.role === "therapist"
                      ? "ms-auto bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-800",
                  )}
                >
                  {message.role === "assistant" ? (
                    <Linked text={message.content} mentions={message.mentions} />
                  ) : (
                    message.content
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={threadId ? "Ask about your week…" : "Start a chat first"}
                disabled={!threadId || pending}
                className="min-h-[3rem] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              />
              <button
                type="button"
                disabled={!threadId || pending || !question.trim()}
                onClick={send}
                aria-label="Send"
                className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {error ? (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {error}
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Render an answer with its patient links. 10.3.
 *
 * The candidate set is the message's own stored mentions — the ones the server
 * matched against the real roster when the answer was written. A name that is
 * not in that array renders as ordinary text, whatever it looks like.
 */
function Linked({ text, mentions }: { text: string; mentions: RosterEntry[] }) {
  const spans = linkRoster(text, mentions);

  return (
    <>
      {spans.map((span, i) =>
        span.kind === "link" ? (
          <Link
            key={i}
            href={`/patients/${span.patientId}`}
            className="font-medium underline underline-offset-2"
          >
            {span.text}
          </Link>
        ) : (
          <span key={i}>{span.text}</span>
        ),
      )}
    </>
  );
}
