import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { clinicSeats, organizations, subscriptions } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { getSettings } from "@/lib/settings";
import { seatChange, seatMonthlyCents } from "@/lib/settings/defs";

/**
 * Seats. PLAN.md 62.1 to 62.9, C323, C329, C330, C333, C351, C355.
 *
 * ## 🔴 THE ONE THING THAT MAKES THIS DIFFERENT FROM A QUANTITY FIELD
 *
 * The rate is **retroactive**. Reaching a band reprices every seat, so going
 * from two to three is not "add a seat at $90", it is "the account costs $270
 * instead of $179 for the rest of the month". Every figure below is computed on
 * the whole monthly price at each count rather than on the seats being added,
 * and that is the difference between the founder's table and a number that
 * never appears on it.
 */

/** What this clinic pays a month right now, for its current seat count. */
export async function currentSeatBill(organizationId: string): Promise<{
  seats: number;
  monthlyCents: number;
}> {
  const settings = await getSettings();

  const [org] = await controlDb
    .select({ seats: organizations.seats })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const seats = org?.seats ?? 0;
  return { seats, monthlyCents: seatMonthlyCents(seats, settings.pricing.seatBands) };
}

/**
 * 🔴 62.2 / 62.3 / 62.4 — WHAT A CHANGE COSTS, BEFORE THE CLICK.
 *
 * Returned rather than applied, because the whole ruling is that the figure is
 * stated first. A function that changed the count and then told somebody what
 * it cost would satisfy every sentence in the sprint except the one that
 * matters.
 *
 * 🔴 K14: THE PERIOD IS THE ONE THE SEATS ARE BILLED IN. It used to come from
 * `subscriptions.current_period_end` alone, which a clinic on the transfer
 * rail never has, so every seat added on the 25th was charged a full thirty
 * days from that day and then again by the month's seat bill. See
 * `seatPeriod` for the three cases.
 */
export async function quoteSeatChange(input: {
  organizationId: string;
  toSeats: number;
  now?: Date;
}): Promise<ReturnType<typeof seatChange>> {
  const settings = await getSettings();
  const now = input.now ?? new Date();

  const [org] = await controlDb
    .select({ seats: organizations.seats })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);

  const { periodStart, periodEnd } = await seatPeriod(input.organizationId, now);

  return seatChange({
    fromSeats: org?.seats ?? 0,
    toSeats: input.toSeats,
    bands: settings.pricing.seatBands,
    now,
    periodStart,
    periodEnd,
  });
}

/** The calendar month `now` falls in, in UTC: the seat bill's own month. */
export function seatMonth(now: Date): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart, periodEnd };
}

/**
 * 🔴 K14: the period a seat change is prorated against, in order:
 *
 *   1. a PAID plan month covering now (the transfer rail): the next month is
 *      raised by `raiseManualRenewals` at the new seat count, so a change is
 *      owed only to that month's end.
 *   2. a Stripe period still running.
 *   3. otherwise the calendar month, which is the month `raiseSeatMonths`
 *      bills seats in. A seat added on the 25th costs the days to the 1st.
 */
async function seatPeriod(
  organizationId: string,
  now: Date,
): Promise<{ periodStart: Date; periodEnd: Date }> {
  const { obligationCovering } = await import("./obligations");
  const covering = await obligationCovering(organizationId, now);
  if (covering && covering.state === "paid") {
    return { periodStart: covering.periodStart, periodEnd: covering.periodEnd };
  }

  const [sub] = await controlDb
    .select({ currentPeriodEnd: subscriptions.currentPeriodEnd, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);
  if (sub?.currentPeriodEnd && sub.status !== "cancelled" && sub.currentPeriodEnd > now) {
    const periodStart = new Date(sub.currentPeriodEnd);
    periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
    return { periodStart, periodEnd: sub.currentPeriodEnd };
  }

  return seatMonth(now);
}

/**
 * Apply it. The quote above is what the clinic agreed to; this is the write.
 *
 * 🔴 GUARDED ON THE COUNT THE QUOTE WAS MADE AGAINST, so a second tab that
 * changed the seats in between cannot silently apply this one on top of a
 * number nobody was shown. The caller re-quotes and asks again, which is the
 * only honest answer when the thing somebody agreed to has moved.
 */
export async function applySeatChange(input: {
  organizationId: string;
  fromSeats: number;
  toSeats: number;
}): Promise<{ ok?: true; error?: string }> {
  const wanted = Math.max(0, Math.floor(input.toSeats));
  if (wanted > 500) return { error: "That is more seats than we can bill on one account." };
  /*
   * 🔴 NEVER BELOW THE PEOPLE IN THEM. This let a clinic drop to one seat, or
   * none, with four clinicians seated, and book the difference as credit.
   */
  const occupied = (await seatsFor(input.organizationId)).length;
  if (wanted < occupied) {
    return { error: `${occupied} clinicians hold seats. Remove somebody first, then reduce the seats.` };
  }

  /*
   * 🔴 QUOTED BEFORE THE WRITE, because after it `fromSeats` is `toSeats` and
   * every figure is zero. Asked with the count the clinic was shown rather than
   * read back off the row, so what is billed is what they agreed to.
   */
  const change = await quoteSeatChange({
    organizationId: input.organizationId,
    toSeats: wanted,
  });

  const [updated] = await controlDb
    .update(organizations)
    .set({ seats: wanted, updatedAt: new Date() })
    .where(
      and(
        eq(organizations.id, input.organizationId),
        eq(organizations.seats, Math.max(0, Math.floor(input.fromSeats))),
      ),
    )
    .returning({ id: organizations.id });

  if (!updated) {
    return {
      error:
        "The seat count changed while you were looking at this. We have refreshed the figures: check them and try again.",
    };
  }

  log.info("clinic seats changed", { organization: ref(input.organizationId), seats: wanted });

  /*
   * 🔴 74.4 — AND THE FIGURE THEY AGREED TO IS ACTUALLY CHARGED.
   *
   * ⚠️ `seatChange` has computed `proratedCents` since sprint 62 and the quote
   * screen has shown it since sprint 62, and nothing ever billed it. A solo
   * therapist taking their first seat on the 15th read "$89 for the 15 days
   * remaining", pressed the button, and was charged nothing at all. The whole
   * point of quoting first is that the quote is what happens.
   *
   * 🔴 AFTER the guarded update, and only when it succeeded. Billing first and
   * then losing the race would charge a clinic for a change that never
   * happened, and there is no processor on this path to reverse it. The
   * guard IS the idempotency: a second click finds the seats already moved,
   * returns the error above, and never reaches this line.
   *
   * 🔴 A DOWNGRADE BECOMES CREDIT, NEVER A REFUND. C331: a practice that adds
   * five seats on the first and removes them on the last must not pay for none
   * of them. The seat existed and was available; what they get back is the
   * unused part, against next month.
   */
  if (change.proratedCents > 0) {
    const { billSeatProration } = await import("./service");
    await billSeatProration({
      organizationId: input.organizationId,
      amountCents: change.proratedCents,
      fromSeats: change.fromSeats,
      toSeats: change.toSeats,
      daysRemaining: change.daysRemaining,
    });
  } else if (change.proratedCents < 0) {
    /* K14: added to any credit already waiting, and spent on the next seat bill. */
    const { addUpcomingDiscount } = await import("./service");
    await addUpcomingDiscount({
      organizationId: input.organizationId,
      discountCents: -change.proratedCents,
      reason: `${change.fromSeats} seats to ${change.toSeats}, for the ${change.daysRemaining} days left of this month`,
    });
  }

  return { ok: true };
}

/**
 * 🔴 62.6 / C355 — THE SEATS A CLINIC IS ACTUALLY BILLED FOR, AND THE ONES WAITING.
 *
 * A clinician on Practice who accepts an invitation has already paid for the
 * month. Their seat exists from the day they accept and is not billable until
 * their own period closes, so the clinic sees two numbers and a date rather
 * than one number that is wrong for three weeks.
 */
/** Whether a clinic has a paid seat nobody holds. */
export async function hasFreeSeat(organizationId: string): Promise<boolean> {
  const [org] = await controlDb
    .select({ seats: organizations.seats })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return (org?.seats ?? 0) > (await seatsFor(organizationId)).length;
}

export async function seatsFor(organizationId: string) {
  return controlDb
    .select({
      id: clinicSeats.id,
      userId: clinicSeats.userId,
      billableFrom: clinicSeats.billableFrom,
      createdAt: clinicSeats.createdAt,
    })
    .from(clinicSeats)
    .where(and(eq(clinicSeats.organizationId, organizationId), isNull(clinicSeats.releasedAt)))
    .orderBy(clinicSeats.createdAt);
}

/**
 * 🔴 62.5 — RELEASED, NEVER REFUNDED.
 *
 * The clinician keeps unlimited to period end and the seat is not renewed. A
 * refund here means a clinic adds five seats on the first of the month, removes
 * them on the last, and pays for none of them.
 *
 * Guarded on the seat still being live, so releasing twice does not move the
 * date and rewrite when this happened.
 */
export async function releaseSeat(input: {
  organizationId: string;
  userId: string;
}): Promise<{ released: boolean }> {
  const [row] = await controlDb
    .update(clinicSeats)
    .set({ releasedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clinicSeats.organizationId, input.organizationId),
        eq(clinicSeats.userId, input.userId),
        isNull(clinicSeats.releasedAt),
      ),
    )
    .returning({ id: clinicSeats.id });

  return { released: Boolean(row) };
}

/**
 * 🔴 62.6 / C329 — A SEAT FOR SOMEBODY WHO IS ALREADY PAYING US.
 *
 * Two halves, and doing one without the other charges twice or takes away a
 * month somebody bought:
 *
 *   - The seat is not billable until their own subscription period ends.
 *   - Their own subscription is cancelled AT PERIOD END, never immediately.
 *
 * 🔴 THE PERIOD IS THEIRS, NOT THE CLINIC'S, and reading the wrong one is the
 * whole defect this parameter exists to prevent.
 *
 * The first version of this function looked the subscription up on the CLINIC's
 * organisation, which is the account doing the hiring. That number has nothing
 * to do with the month the joining clinician already paid for: it would have
 * dated every seat from the clinic's own renewal, so a therapist who bought
 * Practice yesterday would be billed to the clinic from the clinic's next
 * renewal rather than from theirs, and the sentence C355 asks for would be
 * enforced against the wrong calendar. `ownOrganizationId` is their practice,
 * and null means they have never had one.
 *
 * 🔴 The cancellation is not performed here. `cancelSubscription` in
 * `lib/billing/stripe.ts` owns talking to the gateway and already cancels at
 * period end; calling it from the data layer would put a network call inside a
 * write path, and a gateway having a bad afternoon would then leave a clinician
 * with no seat and no plan.
 */
export async function takeSeat(input: {
  /** The clinic taking them on. */
  organizationId: string;
  userId: string;
  /**
   * 🔴 The joining clinician's OWN practice, whose period we are waiting for.
   * Null for somebody who has just created their account on the invitation, who
   * has paid us nothing and whose seat therefore starts today.
   */
  ownOrganizationId: string | null;
}): Promise<{ seatId: string | null; billableFrom: Date }> {
  const [sub] = input.ownOrganizationId
    ? await controlDb
        .select({ currentPeriodEnd: subscriptions.currentPeriodEnd })
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, input.ownOrganizationId))
        .limit(1)
    : [];

  /*
   * Their own period end if they have one, otherwise now: somebody with no
   * subscription is paying us nothing, so their seat starts costing money the
   * day they take it.
   *
   * 🔴 And a period end in the PAST is today, not a date already gone. A lapsed
   * subscription is not a month somebody is still owed, and billing from a date
   * behind us would read as free seats for however long the mirror was stale.
   */
  const now = new Date();
  const ends = sub?.currentPeriodEnd ?? null;
  const billableFrom = ends && ends.getTime() > now.getTime() ? ends : now;

  /*
   * 🔴 ONLY INTO A SEAT THE CLINIC HAS PAID FOR, one acceptance at a time.
   *
   * The count used to be asked in the same statement as the insert, which
   * reads as atomic and is not: under READ COMMITTED two acceptances both see
   * the same count and both insert (25 September inventory). A per-clinic
   * lock makes the second wait and then count the first.
   */
  const seatId = await controlDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`seats:${input.organizationId}`}))`);
    const created = await tx.execute(sql`
      INSERT INTO clinic_seats (organization_id, user_id, billable_from)
      SELECT ${input.organizationId}, ${input.userId}, ${billableFrom.toISOString()}::timestamptz
       WHERE (SELECT seats FROM organizations WHERE id = ${input.organizationId})
             > (SELECT count(*) FROM clinic_seats WHERE organization_id = ${input.organizationId} AND released_at IS NULL)
      ON CONFLICT DO NOTHING
      RETURNING id`);
    return (created.rows[0] as { id: string } | undefined)?.id ?? null;
  });

  return { seatId, billableFrom };
}
