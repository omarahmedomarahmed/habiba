import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientBack } from "@/components/patient/back";
import { BookingChange, CancelledCard } from "@/components/patient/booking-change";
import { Card } from "@/components/patient/kit";
import { cancelledView, changeView } from "@/lib/data/booking-change";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { freeUntil } from "@/lib/scheduling/cancel-window";
import { formatWhen, resolveZone } from "@/lib/scheduling/tz";

/** K21: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.changeOrCancel"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 Ruling 16: cancel or move one booking.
 *
 * The page says, before anything is pressed, whether cancelling now is
 * refunded: free up to the window (a setting), and after it only if the
 * clinician agrees. Moving is offered only inside the window, to the same
 * clinician's open hours, and is never charged again.
 */
export default async function ChangeBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePatient();
  const { id } = await params;
  const { t, locale } = await getI18n();

  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const view = valid ? await changeView(actor.personId, id) : null;
  if (!view) {
    /*
     * 🔴 Board 407: cancelling redraws this page (the action revalidates), and
     * a cancelled booking is no longer changeable, so the patient who had just
     * pressed "Yes, cancel" landed on a 404. Their own cancelled booking says
     * Cancelled and where the money went.
     */
    const gone = valid ? await cancelledView(actor.personId, id) : null;
    if (!gone) notFound();
    const goneZone = resolveZone(actor.timezone, gone.therapistTimezone);
    return (
      <main className="mx-auto flex min-h-dvh flex-col w-full max-w-lg gap-4 px-5 pt-4 pb-10">
        <PatientBack fallback="/patient/sessions" />
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">{t("pchange.title")}</h1>
        <Card className="p-4">
          <p className="text-sm font-semibold text-navy-700">{gone.therapistName}</p>
          {gone.at ? <p className="mt-0.5 text-sm text-navy-400">{formatWhen(gone.at, goneZone, locale)}</p> : null}
        </Card>
        <CancelledCard money={gone.money} windowHours={gone.windowHours} />
      </main>
    );
  }

  const zone = resolveZone(actor.timezone, view.therapistTimezone);

  return (
    <main className="mx-auto flex min-h-dvh flex-col w-full max-w-lg gap-4 px-5 pt-4 pb-10">
      <PatientBack fallback="/patient/sessions" />
      <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">{t("pchange.title")}</h1>

      <Card className="p-4">
        <p className="text-sm font-semibold text-navy-700">{view.therapistName}</p>
        <p className="mt-0.5 text-sm text-navy-400">{formatWhen(view.at, zone, locale)}</p>
        <p className={`mt-3 text-sm ${view.free ? "text-emerald-700" : "text-amber-700"}`}>
          {/* 🔴 Board 419: their benefit paid it; no refund rule is about their money. */}
          {view.covered
            ? t("pchange.covered")
            : /* 🔴 Board 406: they sent a transfer; "nothing is paid" read as if they had not. */
              view.transferWaiting && !view.paid
              ? t("pchange.transferWaiting")
              : !view.paid
            ? t("pchange.unpaid")
            : view.free
              ? t("pchange.freeUntil", { date: formatWhen(freeUntil(view.at, view.windowHours), zone, locale) })
              : t("pchange.late", { hours: view.windowHours })}
        </p>
      </Card>

      <BookingChange
        sessionId={view.sessionId}
        windowHours={view.windowHours}
        canMove={view.free}
        slots={view.slots.map((slot) => ({ id: slot.id, label: formatWhen(slot.startsAt, zone, locale) }))}
      />
    </main>
  );
}
