"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  cancelMyBooking,
  moveMyBooking,
  type ChangeState,
} from "@/app/(patient)/patient/sessions/[id]/change/actions";
import { Card } from "@/components/patient/kit";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 Ruling 16: the two things a patient can do to a booking. Cancel asks
 * once more before it acts, because a late cancellation is not refunded.
 * Times arrive formatted by the server in the reader's zone (C84).
 */
export function BookingChange({
  sessionId,
  windowHours,
  canMove,
  slots,
}: {
  sessionId: string;
  windowHours: number;
  canMove: boolean;
  slots: { id: string; label: string }[];
}) {
  const t = useT();
  const [state, setState] = useState<ChangeState>({});
  const [sure, setSure] = useState(false);
  const [slot, setSlot] = useState(slots[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  if (state.done) {
    return (
      <Card className="p-4" role="status">
        <p className="text-sm font-semibold text-navy-700">
          {state.done === "moved" ? t("pchange.moved") : t("pchange.cancelled")}
        </p>
        {state.refund === "refunded" ? <p className="mt-1 text-sm text-navy-400">{t("pchange.refunded")}</p> : null}
        {state.refund === "queued" ? <p className="mt-1 text-sm text-navy-400">{t("pchange.refundQueued")}</p> : null}
        {state.refund === "held" ? (
          <p className="mt-1 text-sm text-navy-400">{t("pchange.held", { hours: windowHours })}</p>
        ) : null}
        <Link href="/patient/sessions" className="mt-3 inline-flex text-sm font-semibold text-brand-700">
          {t("psessions.title")}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold text-navy-700">{t("pchange.move")}</p>
        {!canMove ? (
          <p className="mt-1 text-sm text-navy-400">{t("pchange.moveClosed")}</p>
        ) : slots.length === 0 ? (
          <p className="mt-1 text-sm text-navy-400">{t("pchange.moveNone")}</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
              aria-label={t("pchange.move")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-navy-100 px-2 text-sm"
            >
              {slots.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !slot}
              onClick={() => startTransition(async () => setState(await moveMyBooking(sessionId, slot)))}
              className="h-11 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600 disabled:opacity-50"
            >
              {t("pchange.moveButton")}
            </button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        {!sure ? (
          <button
            type="button"
            onClick={() => setSure(true)}
            className="h-11 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700"
          >
            {t("pchange.cancel")}
          </button>
        ) : (
          <div>
            <p className="text-sm font-semibold text-navy-700">{t("pchange.cancelSure")}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => setState(await cancelMyBooking(sessionId)))}
                className="h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("pchange.cancelYes")}
              </button>
              <button
                type="button"
                onClick={() => setSure(false)}
                className="h-11 rounded-xl px-4 text-sm font-semibold text-navy-400"
              >
                {t("pchange.keep")}
              </button>
            </div>
          </div>
        )}
      </Card>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {t(state.error)}
        </p>
      ) : null}
    </div>
  );
}
