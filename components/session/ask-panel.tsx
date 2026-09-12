"use client";

import { useState, useTransition } from "react";
import { MessageSquare, Send, Sparkles, X } from "lucide-react";

import { askCopilot } from "@/app/(app)/copilot/actions";
import { Badge, Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The copilot, inside the room. PLAN.md 48.1, 48.3, 48.5, C210, C211, C224.
 *
 * ## What this replaces
 *
 * `CopilotToasts` has always shown live one-line suggestions written from the
 * transcript. What a therapist could never do was **ask**: the question they
 * actually have happens mid-session, and until now answering it meant leaving
 * the room for `/copilot`. C25 named that gap in sprint 2 and it has been open
 * since.
 *
 * ## 🔴 Free, and why that is not generosity
 *
 * Ticket 23.3 said in-room questions come out of the same allowance as
 * `/copilot`. The founder overturned it (C210) on one case: a patient declines
 * recording, so there is no transcript, so there is no note to draft, so the
 * therapist's only remaining help is this panel — and a shared counter would
 * lock them out of it on exactly the session where they need it most, having
 * already paid the platform fee.
 *
 * This is the only AI in the product a patient's refusal does not switch off,
 * because it reads the record that **already existed** rather than the session
 * happening now. That is also what makes it safe to give away.
 *
 * The window is the session (48.6), bounded by the session clock, so a room
 * left open on Monday is not still free on Tuesday (C224). Nothing here
 * enforces that: `liveSessionForPatient` does, on the server, because a client
 * that decides what is free is a client that can be told otherwise.
 *
 * ## 🔴 The sentence
 *
 * `troom.ask.bound` is on screen before a single question is asked, not
 * printed as an apology after one. A therapist who asks what the patient just
 * said should already know the answer will not come from this panel.
 */
export function AskPanel({
  patientId,
  className,
}: {
  patientId: string;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [pending, startTransition] = useTransition();
  const [turns, setTurns] = useState<{ question: string; answer: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      setError(null);
      const result = await askCopilot(patientId, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTurns((rest) => [
        ...rest,
        { question: trimmed, answer: result.answer?.content ?? "" },
      ]);
      setQuestion("");
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "tap-target flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50",
          className,
        )}
      >
        <MessageSquare className="h-4 w-4" aria-hidden />
        {t("troom.ask.open")}
        <Badge tone="teal">{t("troom.ask.free")}</Badge>
      </button>
    );
  }

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{t("troom.ask.title")}</p>
        <div className="flex items-center gap-2">
          <Badge tone="teal">{t("troom.ask.free")}</Badge>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tap-target rounded-lg p-1 text-slate-400 hover:text-slate-700"
            aria-label={t("troom.ask.close")}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {/*
        🔴 48.5 / C211 — said before the first question, not after a
        disappointing answer. A therapist who knows the bound will ask a
        different, better question.
      */}
      <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-relaxed text-slate-600">
        {t("troom.ask.bound")}
      </p>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 && !pending ? (
          <p className="text-xs text-slate-400">{t("troom.ask.empty")}</p>
        ) : null}

        {turns.map((turn, index) => (
          <div key={index} className="space-y-1.5">
            <p className="text-sm font-medium text-slate-900">{turn.question}</p>
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
              {turn.answer}
            </p>
          </div>
        ))}

        {pending ? <p className="text-xs text-slate-400">{t("troom.ask.thinking")}</p> : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        {/*
          🔴 48.3 — Prepare me, one click, one per session.
          It absorbs 39.1, which was scheduled as a separate screen eighteen
          months out. The once-per-session bound is C224's: free is not the
          same as unmetered, and the thing that would actually cost money is a
          button somebody can hold down.
        */}
        {!prepared ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPrepared(true);
              ask(t("troom.ask.preparePrompt"));
            }}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {t("troom.ask.prepare")}
            <span className="text-xs font-normal text-brand-500">
              {t("troom.ask.prepareOnce")}
            </span>
          </button>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, shift+enter is a newline. A therapist mid-session
              // is typing one sentence, not composing.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask(question);
              }
            }}
            rows={2}
            placeholder={t("troom.ask.placeholder")}
            className="min-h-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={pending || !question.trim()}>
            <Send className="h-4 w-4" aria-hidden />
            {t("troom.ask.send")}
          </Button>
        </form>
      </div>
    </section>
  );
}
