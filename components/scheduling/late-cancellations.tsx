"use client";

import { useState, useTransition } from "react";

import { refundLateCancellation } from "@/app/(app)/bookings/actions";
import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 Ruling 16: "none after, unless the therapist agrees". The late
 * cancellations still holding a payment, each with the one button that
 * agrees. The refund happens once, whoever presses twice.
 */
export function LateCancellations({
  rows,
  windowHours,
}: {
  rows: { sessionId: string; name: string; when: string }[];
  windowHours: number;
}) {
  const t = useT();
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) return null;

  return (
    <Card className="mb-4 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("tchange.lateTitle")}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{t("tchange.lateBody", { hours: windowHours })}</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.sessionId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
          >
            <span className="text-sm text-slate-900">
              {row.name} <span className="text-xs text-slate-500">· {row.when}</span>
            </span>
            {done.includes(row.sessionId) ? (
              <span className="text-xs text-emerald-700">{t("tchange.refunded")}</span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await refundLateCancellation(row.sessionId);
                    if (result.ok) setDone((list) => [...list, row.sessionId]);
                    else setError(result.errorKey ?? "pchange.errGone");
                  })
                }
                className="tap-target h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                {t("tchange.refund")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {t(error)}
        </p>
      ) : null}
    </Card>
  );
}
