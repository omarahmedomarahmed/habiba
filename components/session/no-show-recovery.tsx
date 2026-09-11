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
import { useLocale, useT } from "@/lib/i18n/client";
import { localeTag } from "@/lib/i18n/config";

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
}: {
  sessionId: string;
  /** Non-null once the therapist joined — this component then never appears. */
  startedAt: string | null;
  /** How long they have been here. Server-computed, so the clock is one clock. */
  waitMinutes: number;
}) {
  const [view, setView] = useState<RecoveryView>({ state: "waiting" });
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  /*
   * 37L.9 — asked for, not passed in. This was `locale?: string = "en-US"`:
   * the same optional-prop shape as `PatientSessionList`, on the screen a
   * patient sees when their therapist has not turned up and money is being
   * quoted at them.
   */
  const locale = localeTag(useLocale());
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
          {t("tshow.joining")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("tshow.joiningBody")}
        </p>
      </Card>
    );
  }

  if (view.state === "done") {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">
          {view.outcome === "reassigned" ? t("tshow.reassigned") : t("tshow.refunded")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {view.outcome === "reassigned" ? t("tshow.reassignedBody") : t("tshow.refundedBody")}
          {view.creditCents
            ? ` ${t("tshow.creditWaiting", {
                amount: formatMoney(view.creditCents, "USD", locale),
              })}`
            : ""}
        </p>
      </Card>
    );
  }

  if (view.state === "none") {
    return (
      <Card className="border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">{t("tshow.nobody")}</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          {t("tshow.nobodyBody")}
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
          {t("tshow.refund")}
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
        {t("tshow.someoneElse")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("tshow.someoneElseBody")}
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
        {t("tshow.noneRefund")}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
