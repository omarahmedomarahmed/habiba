"use client";

import { useEffect } from "react";
import { AlertTriangle, Lightbulb, X } from "lucide-react";

import type { CopilotSuggestion } from "@/lib/ai/copilot";
import { cn } from "@/lib/utils";

/**
 * In-session suggestions, at the top, one at a time until they expire.
 *
 * They used to render in a tray just above the controls — the bottom of the
 * screen, which is exactly where the transcript's newest line lands. So a
 * clinician watching words arrive had the suggestion appear in the same few
 * pixels they were already reading, and then the next batch **replaced** it:
 * `setSuggestions` overwrote, so anything not read within one copilot cycle was
 * gone without ever having been seen.
 *
 * Now each suggestion is its own card with its own life. They stack downward
 * from under the header, newest first, and leave on their own after fifteen
 * seconds — long enough to read a sentence twice while listening to somebody,
 * short enough that the transcript is never buried.
 *
 * Two deliberate exceptions:
 *
 * - A `risk` card does not expire. It is the one kind that exists because
 *   somebody said something about harm, and a timer is not an acceptable reason
 *   for a clinician to have missed it. It goes when they dismiss it.
 * - Nothing is ever more than `MAX_VISIBLE` deep. The point of moving these to
 *   the top was to stop them competing with the transcript; a tower of six
 *   would just be the old problem upside down.
 */
export type Toast = CopilotSuggestion & { id: string; at: number };

export const TOAST_MS = 15_000;
const MAX_VISIBLE = 3;

const LABELS: Record<CopilotSuggestion["kind"], string> = {
  explore: "Explore",
  reflect: "Reflect",
  observation: "Pattern",
  risk: "Risk",
};

/** Arabic, Hebrew, Persian, Urdu — the suggestion is written to be read aloud. */
const RTL = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function CopilotToasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const visible = toasts.slice(0, MAX_VISIBLE);
  if (visible.length === 0) return null;

  return (
    <div
      // `pointer-events-none` on the column, restored on each card: the
      // transcript underneath has to stay scrollable through the gaps.
      // `top-11` clears the transcript panel's own header, so a card never
      // covers the recording indicator — the one thing on this screen a patient
      // has been promised they can check at a glance.
      className="pointer-events-none absolute inset-x-0 top-11 z-30 flex flex-col gap-2 p-3"
      data-copilot-toasts=""
      /*
       * Assertive, against the transcript's polite stream a few pixels below.
       *
       * Two polite regions on one screen means the shorter-lived one queues
       * behind the one that updates every few seconds — so a card that is gone
       * in fifteen seconds would be announced after it had already left, and a
       * `risk` card would be announced after the moment it was about.
       */
      aria-live="assertive"
    >
      {visible.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const risk = toast.kind === "risk";

  useEffect(() => {
    if (risk) return;
    // Measured from when it arrived, not from when it mounted, so a card that
    // was queued behind others does not get a fresh fifteen seconds.
    const left = TOAST_MS - (Date.now() - toast.at);
    const timer = setTimeout(() => onDismiss(toast.id), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [risk, toast.at, toast.id, onDismiss]);

  const rtl = RTL.test(toast.text);

  return (
    <div
      className={cn(
        "animate-fade-rise pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 shadow-lg backdrop-blur-md",
        risk
          ? "border-red-400/40 bg-red-500/20 shadow-red-900/30"
          : "border-white/15 bg-navy-500/90 shadow-black/30",
      )}
    >
      {risk ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
      ) : (
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-bold tracking-wider uppercase",
            risk ? "text-red-200" : "text-brand-300",
          )}
        >
          {LABELS[toast.kind]}
        </p>
        <p
          dir={rtl ? "rtl" : "ltr"}
          className={cn(
            "mt-0.5 text-[15px] leading-snug text-white",
            rtl && "text-end",
          )}
        >
          {toast.text}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="tap-target -my-1 -me-1 flex shrink-0 items-center justify-center rounded-lg text-white/40 hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Fold a new batch into the stack.
 *
 * Two things this has to get right. New suggestions go on **top**, because the
 * newest is the one about what was just said. And a suggestion whose text is
 * already on screen is dropped rather than stacked: the copilot runs every
 * three segments and frequently produces the same thought twice in a row, which
 * as a stack of near-identical cards would be worse than the tray it replaced.
 */
export function mergeToasts(current: Toast[], incoming: CopilotSuggestion[]): Toast[] {
  const seen = new Set(current.map((t) => normalise(t.text)));
  const now = Date.now();

  const fresh: Toast[] = [];
  for (const suggestion of incoming) {
    const key = normalise(suggestion.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    fresh.push({ ...suggestion, id: `${now}-${fresh.length}`, at: now });
  }

  // Keep a little more than is shown, so dismissing one reveals the next
  // rather than leaving a gap.
  return [...fresh, ...current].slice(0, MAX_VISIBLE * 2);
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?؟،]+$/u, "");
}
