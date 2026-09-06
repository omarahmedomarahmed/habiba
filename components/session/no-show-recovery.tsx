"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, HeartHandshake } from "lucide-react";

import {
  offerReplacements,
  takeRefund,
  takeReplacement,
  type RecoveryView,
} from "@/app/(patient)/sessions/[id]/recovery-actions";
import { Button, Card } from "@/components/ui";
import { formatMoney } from "@/lib/billing/plans";

/**
 * What a patient sees while nobody is joining. PLAN.md 14.1–14.4.
 *
 * ## The first five minutes say nothing about the therapist
 *
 * 🔴 "Joining shortly", and no blame. A clinician is late for the same reasons
 * anybody is late — a laptop that slept, a session that overran, a notification
 * that never arrived — and a product that starts hinting at unreliability in
 * minute two is wrong most of the time and unkind all of it.
 *
 * ## At five minutes the language changes, because the situation has
 *
 * A person who booked therapy and is looking at an empty room is having a
 * specific and bad experience. At that point the screen stops reassuring and
 * starts *doing something*: somebody else who is free right now, or their money
 * back with an apology. Never a spinner and a shrug.
 */
export function NoShowRecovery({
  sessionId,
  startedAt,
  waitMinutes,
  locale = "en-US",
}: {
  sessionId: string;
  /** Non-null once the therapist joined — this component then never appears. */
  startedAt: string | null;
  /** How long they have been here. Server-computed, so the clock is one clock. */
  waitMinutes: number;
  /**
   * 19.4 — the reader's language. This screen is shown to a patient whose
   * therapist has not turned up, and it quotes money at them; formatting it in
   * the runtime's locale would differ between the server pass and the browser.
   */
  locale?: string;
}) {
  const [view, setView] = useState<RecoveryView>({ state: "waiting" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * The offer is fetched once, when the wait crosses the line. Not polled: the
   * page already polls for the therapist joining, and a second timer racing the
   * first is how somebody gets offered a replacement half a second after their
   * therapist finally appears.
   */
  useEffect(() => {
    if (startedAt || waitMinutes < 5 || view.state !== "waiting") return;
    let live = true;
    void offerReplacements(sessionId).then((next) => {
      if (live) setView(next);
    });
    return () => {
      live = false;
    };
  }, [sessionId, startedAt, waitMinutes, view.state]);

  if (startedAt) return null;

  if (view.state === "waiting") {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Clock className="h-4 w-4 text-slate-400" aria-hidden />
          Joining shortly
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Your therapist has not joined yet. Stay here — this page will open the moment they do.
        </p>
      </Card>
    );
  }

  if (view.state === "done") {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">
          {view.outcome === "reassigned" ? "You are in good hands" : "You have been refunded"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {view.outcome === "reassigned"
            ? "They have been told and are joining now."
            : "The full amount is on its way back, including our fee. We are sorry."}
          {view.creditCents
            ? ` They charge less, so ${formatMoney(view.creditCents, "USD", locale)} is waiting as credit on your next session.`
            : ""}
        </p>
      </Card>
    );
  }

  if (view.state === "none") {
    return (
      <Card className="border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Nobody is free right now</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          We could not find another therapist who is online. This is our failure, not yours — take
          your money back and we will be sorry about it properly.
        </p>
        <Button
          className="mt-3"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const next = await takeRefund(sessionId);
              if ("error" in next) setError(next.error);
              else setView(next);
            })
          }
        >
          Refund me in full
        </Button>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <HeartHandshake className="h-4 w-4 text-teal-500" aria-hidden />
        Somebody else can see you now
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Your therapist has not joined. These people are online and free, and none of them costs
        more than you have already paid.
      </p>

      <ul className="mt-3 space-y-2">
        {view.replacements.map((person) => (
          <li key={person.userId}>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const next = await takeReplacement(sessionId, person.userId);
                  if ("error" in next) setError(next.error);
                  else setView(next);
                })
              }
              className="tap-target flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-start hover:border-slate-900"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{person.name}</span>
                {person.headline ? (
                  <span className="block truncate text-xs text-slate-500">{person.headline}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {formatMoney(person.rateCents, "USD", locale)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const next = await takeRefund(sessionId);
            if ("error" in next) setError(next.error);
            else setView(next);
          })
        }
        className="tap-target mt-3 h-10 w-full rounded-xl bg-slate-100 text-sm font-semibold text-slate-700"
      >
        None of these — refund me instead
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
