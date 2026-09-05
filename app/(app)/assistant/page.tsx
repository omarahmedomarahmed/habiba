import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant/assistant-chat";
import { AssistantPrefsPrompt } from "@/components/assistant/prefs-prompt";
import {
  assistantAllowance,
  assistantPrefs,
  createThread,
  listThreads,
  messagesIn,
} from "@/lib/ai/assistant";
import { requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Assistant", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The general copilot. PLAN.md 10.1.
 *
 * 🔴 Nothing on this page reads a transcript, a note or a document. The
 * guarantee is in `lib/ai/assistant.ts` — it has no import that could reach
 * one — and this page only renders what that module returns.
 */
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const actor = await requireUser();
  const { thread } = await searchParams;

  const threads = await listThreads(actor.userId);

  /*
   * A clinician arriving for the first time gets a conversation rather than an
   * empty state with a button on it. The thread is cheap, and "click new chat
   * to begin" is a step that exists only because it was easier to build.
   */
  const threadId: string | null = thread ?? threads[0]?.id ?? (await createThread(actor));

  const [messages, allowance, prefs] = await Promise.all([
    threadId ? messagesIn(actor.userId, threadId) : Promise.resolve([]),
    assistantAllowance(actor.userId),
    assistantPrefs(actor.userId),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your practice, not your patients&rsquo; records. For anything clinical, open that
          patient&rsquo;s own copilot.
        </p>
      </div>

      {/* 10.6 — asked once, on first use, and skippable. */}
      {prefs.setAt === null ? <AssistantPrefsPrompt prefs={prefs} /> : null}

      <AssistantChat
        threadId={threadId}
        threads={threads.map((t) => ({ id: t.id, title: t.title }))}
        initial={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          mentions: m.mentions,
        }))}
        used={allowance.used}
        limit={allowance.limit}
      />
    </div>
  );
}
