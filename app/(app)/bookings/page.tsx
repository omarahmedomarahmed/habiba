import type { Metadata } from "next";

import { Calendar } from "@/components/scheduling/calendar";
import { LateCancellations } from "@/components/scheduling/late-cancellations";
import { heldLateCancellations } from "@/lib/data/booking-change";
import { formatWhen, resolveZone } from "@/lib/scheduling/tz";
import { getSettings } from "@/lib/settings";
import { requireUser } from "@/lib/auth/guard";
import { listPatients } from "@/lib/data/patients";
import { bookedNames, myHours } from "@/lib/data/scheduling";
import { getI18n } from "@/lib/i18n/server";
import { fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Your calendar", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The bookings page. PLAN.md 51.7.
 *
 * ## What 51.7 asked for, and what was already there
 *
 * The ticket calls this "a third built", and the third that was built is the
 * part that matters most and is least visible: the rules. A booked hour
 * already takes a clinician off the radar, enforced as a `NOT EXISTS` inside
 * `reachable()` so they are unbookable even by a direct call to the action
 * rather than merely hidden from a board. Double booking is already a unique
 * index on (therapist, hour) plus a conditional UPDATE, so two patients
 * pressing book on the same Tuesday is a loser who is told rather than a
 * silent overwrite. The day-before reminder already runs hourly, goes out on
 * WhatsApp and email both, and holds anything landing in a quiet hour until
 * the morning.
 *
 * What was missing was the page. `/on-call` had fourteen day chips and a flat
 * list of hours, which is a form for publishing availability rather than a
 * calendar: a clinician could not answer "what does my Thursday look like"
 * without counting rows, and there was no way at all to put an existing
 * patient into a future hour.
 *
 * ## 🔴 Why the zone is threaded rather than read
 *
 * `actor.timezone` goes to the component and the component formats through it.
 * Reading the runtime's zone would render a Vercel server's idea of Thursday,
 * which is 11R.2's defect on the other side of the wire.
 */
export default async function BookingsPage() {
  const actor = await requireUser();
  const { t, locale } = await getI18n();

  const [hours, patients, bookedBy, late, settings] = await Promise.all([
    // 60 days, so a month view has something in its last row.
    myHours(actor, 60),
    listPatients(actor),
    bookedNames(actor),
    /* 🔴 Ruling 16: late cancellations still holding a payment. */
    heldLateCancellations(actor),
    getSettings(),
  ]);

  const names = new Map(
    patients.map((patient) => [patient.id, fullName(patient.firstName, patient.lastName, "")]),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("portal.book.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("portal.book.body")}</p>
      </div>

      <LateCancellations
        windowHours={settings.rules.refunds.patientCancelWindowHours}
        rows={late.map((row) => ({
          sessionId: row.sessionId,
          name: fullName(row.firstName, row.lastName, row.guestName ?? ""),
          when: row.scheduledAt ? formatWhen(row.scheduledAt, resolveZone(actor.timezone), locale) : "",
        }))}
      />

      <Calendar
        zone={actor.timezone ?? "UTC"}
        slots={hours.map((slot) => ({
          id: slot.id,
          startsAt: slot.startsAt.toISOString(),
          status: slot.status,
          note: slot.note,
          /*
           * Who is in this hour, for a booked slot. `bookedNames` joins the
           * slot's session to its patient and is scoped to this clinician's
           * own rows, so a name here is always somebody already in their
           * caseload. Null for every other status, because an open hour has
           * nobody in it.
           */
          patientName: bookedBy.get(slot.id) ?? null,
        }))}
        patients={patients
          .map((patient) => ({ id: patient.id, name: names.get(patient.id) ?? "" }))
          .filter((patient) => patient.name !== "")}
      />
    </div>
  );
}
