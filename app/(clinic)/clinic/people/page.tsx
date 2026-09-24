import type { Metadata } from "next";

import { ClinicPeopleList } from "@/components/clinic/people-list";
import { formatUsd } from "@/lib/billing/plans";
import { currentSeatBill, quoteSeatChange, seatsFor } from "@/lib/billing/seats";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { can } from "@/lib/clinic-auth/capabilities";
import { clinicClinicians, clinicInvitations, patientsByClinician } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Your clinicians", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The clinic's clinicians. PLAN.md 54.4, 54.5, 54.11, C267.
 *
 * 🔴 A viewer reads this list; an admin invites and removes. The write actions call
 * `requireClinicAdmin` themselves rather than relying on the controls not rendering,
 * because a hidden control is a control somebody reaches with a form post.
 */
export default async function ClinicPeoplePage() {
  /* 🔴 W2-C01: by name, so a typed URL redirects instead of throwing. */
  const actor = await requireClinicCapability("people.read");

  const { locale } = await getI18n();

  const [people, invitations, seats, lists] = await Promise.all([
    clinicClinicians(actor),
    clinicInvitations(actor),
    /* 🔴 62.6 / C355 — which seats are live and which are waiting for a period. */
    seatsFor(actor.clinicOrganizationId),
    /*
     * 🔴 W2-C08 / D2 — each clinician's patients, first name and last initial,
     * for a principal who may read those names at all (`schedule.read`, scoped).
     */
    can(actor.capabilities, "schedule.read")
      ? patientsByClinician(actor)
      : Promise.resolve([]),
  ]);
  const patientsOf = new Map(lists.map((row) => [row.therapistId, row.names]));

  /*
   * 🔴 W2-C02 / C4 — WHAT INVITING OR REMOVING DOES TO THE SEAT BILL, BEFORE THE CLICK.
   *
   * Bought seats (`organizations.seats`, what the bill is priced on) against
   * filled seats plus live invitations. An invitation with no free seat buys
   * one; a removal that leaves a seat empty releases one. Both are quoted here
   * through `quoteSeatChange` and applied by the actions through
   * `applySeatChange`, the same pair the seats page uses.
   */
  const live = invitations.filter(
    (row) => row.state === "sent" && row.expiresAt.getTime() > Date.now(),
  );
  const admin = actor.role === "admin";
  const bill = admin ? await currentSeatBill(actor.clinicOrganizationId) : null;
  const [adding, releasing] = bill
    ? await Promise.all([
        /*
         * Enough seats for everybody on the account and everybody invited,
         * plus this one. Usually one more than bought; more when the count
         * was never raised as people joined, which is the drift C4 names.
         */
        seats.length + live.length >= bill.seats
          ? quoteSeatChange({
              organizationId: actor.clinicOrganizationId,
              toSeats: seats.length + live.length + 1,
            })
          : Promise.resolve(null),
        bill.seats > 0 && seats.length - 1 + live.length < bill.seats
          ? quoteSeatChange({ organizationId: actor.clinicOrganizationId, toSeats: bill.seats - 1 })
          : Promise.resolve(null),
      ])
    : [null, null];

  /*
   * 🔴 62.6 — THE START DATE IS ON THE ROW, and only where it is in the future.
   *
   * A clinician who joined with a plan they had already paid for costs the
   * practice nothing until their own month closes. Showing the date on every row
   * would make it noise; showing it on none of them turns "why is my bill not
   * what I expected" into a support ticket. So it appears exactly where it is
   * the answer to that question.
   *
   * 🔴 Formatted HERE, on the server, in the reader's language and a fixed zone.
   * C84: a `Date` handed to a client component renders one string on the server
   * pass and another after hydration.
   */
  const now = Date.now();
  const waiting = new Map(
    seats
      .filter((seat) => seat.billableFrom && seat.billableFrom.getTime() > now)
      .map((seat) => [seat.userId, formatDate(seat.billableFrom!, "UTC", locale)]),
  );

  return (
    <ClinicPeopleList
      canManage={admin}
      seatAdd={
        adding
          ? {
              fromSeats: adding.fromSeats,
              toSeats: adding.toSeats,
              monthlyLabel: formatUsd(adding.toMonthlyCents),
              todayLabel: formatUsd(Math.max(0, adding.proratedCents)),
            }
          : null
      }
      seatRelease={
        releasing
          ? { fromSeats: releasing.fromSeats, monthlyLabel: formatUsd(releasing.toMonthlyCents) }
          : null
      }
      people={people.map((person) => ({
        userId: person.userId,
        name: person.name,
        email: person.email,
        verificationStatus: person.verificationStatus,
        seatBillableFrom: waiting.get(person.userId) ?? null,
        patients: patientsOf.get(person.userId) ?? null,
      }))}
      invitations={invitations
        .filter((row) => row.state === "sent")
        .map((row) => ({
          id: row.id,
          email: row.email,
          name: [row.firstName, row.lastName].filter(Boolean).join(" "),
          state: row.state,
        }))}
    />
  );
}
