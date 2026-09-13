import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  enrolments,
  patientNotifications,
  people,
  sponsorCodes,
  sponsorIdentifierFields,
  sponsorPots,
  sponsors,
  type RemovalReason,
  type Sponsor,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * 🔴 THE WALL. PLAN.md 53.1, 53.3, §3e, C227 to C229, C244.
 *
 * > **The payer sees the roster. The payer never sees usage attributable to a
 * > person.** Those two sentences are the whole design and everything else is
 * > plumbing.
 *
 * ## Why the wall lives in a SELECT LIST
 *
 * §3e is a rule about what a sponsor may know, and a rule like that can be
 * written three ways: as a promise in prose, as a filter on a screen, or as the
 * shape of the query. Only the third survives the next person.
 *
 * So every function in this file that a sponsor surface may call returns a
 * shape with **no session, no booking, no therapist, no date attributable to a
 * person, and no clinical field of any kind**. Not filtered out downstream —
 * never selected. A component cannot render what its query did not fetch, and
 * `verify:sprint53` reads these select lists rather than trusting this comment.
 *
 * ## 🔴 The one column here that would leak, and why it is still stored
 *
 * `enrolments.created_at` is the join date, which §3e explicitly forbids the
 * sponsor from seeing. It exists because C250 makes funding start from it and
 * because we need it. It is not in `roster()`.
 *
 * `last_verified_at` looks like the same problem and is not, because of C256:
 * the cycle is per sponsor on a fixed calendar, so everybody in one
 * organisation has the same date and it carries no signal about anybody. That
 * ruling is why the column can be shown at all.
 *
 * ## Control plane, not regional
 *
 * A sponsor is not clinical data and has no region. `enrolments` hangs off
 * `people`, which is the identity table, also control plane. Nothing in this
 * file reaches a chart, which is the point.
 */

/* ------------------------------------------------------------- the roster -- */

/**
 * 🔴 WHAT THE SPONSOR SEES ABOUT A PERSON, EXACTLY.
 *
 * §3e's own table has two columns and this type is the first of them:
 *
 * | May see | Never sees |
 * |---|---|
 * | Their **name** | Whether they have ever booked |
 * | **When they were last verified** | When they joined |
 * | Nothing else | Any clinical fact, in any form |
 *
 * "Nothing else" is why this type has three fields. The id is here because
 * removal needs a handle, and it is an enrolment id rather than a person id so
 * that nothing a sponsor holds can be joined to a `people` row by anybody who
 * later gets hold of their screen.
 */
export type RosterEntry = {
  /** The enrolment, not the person. A handle for removal and nothing more. */
  enrolmentId: string;
  name: string;
  /**
   * 🔴 The same date for everybody in this organisation (C256).
   *
   * Null until the first cycle runs. Rendered as "not yet checked", which is
   * true and carries no signal, rather than as a blank.
   */
  lastVerifiedAt: Date | null;
  /** Whether their funding is paused. C247 — they were not reached. */
  paused: boolean;
};

export async function roster(sponsorId: string): Promise<RosterEntry[]> {
  const rows = await controlDb
    .select({
      /*
       * 🔴 THIS SELECT LIST IS THE WALL. Adding a column here is the leak.
       *
       * There is no `createdAt` (the join date, §3e), no session, no booking,
       * no therapist, no count, and no patient id. `verify:sprint53` asserts
       * against this list by name.
       */
      enrolmentId: enrolments.id,
      firstName: people.firstName,
      lastName: people.lastName,
      lastVerifiedAt: enrolments.lastVerifiedAt,
      pausedAt: enrolments.pausedAt,
    })
    .from(enrolments)
    .innerJoin(people, eq(people.id, enrolments.personId))
    .where(and(eq(enrolments.sponsorId, sponsorId), isNull(enrolments.removedAt)))
    /*
     * 🔴 Ordered by NAME, not by when they enrolled.
     *
     * `ORDER BY created_at` would hand the sponsor the join date without ever
     * selecting it: the first row is the earliest joiner and the last is the
     * most recent, which is the whole signal §3e forbids, readable off the page
     * without a column.
     */
    .orderBy(asc(people.firstName), asc(people.lastName))
    .limit(2000);

  return rows.map((row) => ({
    enrolmentId: row.enrolmentId,
    name: `${row.firstName} ${row.lastName ?? ""}`.trim(),
    lastVerifiedAt: row.lastVerifiedAt,
    paused: row.pausedAt !== null,
  }));
}

/* ------------------------------------------------------- the reporting floors -- */

/**
 * 🔴 C229 — THE FLOOR IS ON THE DENOMINATOR, NOT THE HEADCOUNT.
 *
 * The original ruling suppressed reporting below a roster size, and the review
 * broke it with differencing:
 *
 * > *A sixty-person company is above any plausible headcount floor, but in week
 * > 14 the balance drops by exactly one session's cost, there was one session
 * > that week, and the payer knows one person went and which week. Set that
 * > beside somebody being signed off sick and it is a name.*
 *
 * So the rule is: **suppress every figure, the balance included, for any period
 * in which fewer than N sessions occurred, and roll the period forward until it
 * clears N.** Headcount was measuring the wrong population.
 *
 * The sponsor reads "not enough activity to report yet", which is also an
 * honest signal about their own enrolment drive.
 *
 * 🔴 `N` governs the heatmap cell, the total AND the balance delta alike. A
 * floor that covered the chart and not the balance would leave the differencing
 * attack exactly where it was.
 */
export const DEFAULT_ACTIVITY_FLOOR = 5;

export type WeeklySpend = {
  /** The Monday of the week, in the sponsor's own calendar. */
  weekStart: Date;
  /**
   * 🔴 Null means SUPPRESSED, and it is not the same as zero.
   *
   * Zero is "nothing happened". Null is "something happened and there was not
   * enough of it to tell you about". A reader who cannot tell those apart can
   * subtract one from the other, which is the differencing attack.
   */
  spendCents: number | null;
  sessions: number | null;
};

/**
 * 🔴 Roll periods forward until each clears the floor. C229.
 *
 * Pure, so the rule can be tested without a database, and exported so
 * `verify:sprint53` can plant the exact differencing attack the ruling
 * describes and watch it be refused.
 *
 * Weeks below the floor are merged into the NEXT week rather than dropped:
 * dropping them would let a reader subtract the visible weeks from the total
 * and recover the hidden ones.
 */
export function applyActivityFloor(
  weeks: { weekStart: Date; spendCents: number; sessions: number }[],
  floor = DEFAULT_ACTIVITY_FLOOR,
): WeeklySpend[] {
  const out: WeeklySpend[] = [];

  let carriedSpend = 0;
  let carriedSessions = 0;

  for (const week of weeks) {
    carriedSpend += week.spendCents;
    carriedSessions += week.sessions;

    if (carriedSessions >= floor) {
      out.push({
        weekStart: week.weekStart,
        spendCents: carriedSpend,
        sessions: carriedSessions,
      });
      carriedSpend = 0;
      carriedSessions = 0;
    } else {
      /*
       * 🔴 Suppressed, and the row still exists.
       *
       * A missing week would be worse than a null one: a reader would see the
       * gap, know a week is hidden, and difference the total against the
       * visible weeks to recover it. A null week says "not enough activity"
       * and takes its spend forward into the next figure, so there is nothing
       * to recover.
       */
      out.push({ weekStart: week.weekStart, spendCents: null, sessions: null });
    }
  }

  return out;
}

/* ------------------------------------------------------------- the sponsor -- */

export async function getSponsor(sponsorId: string): Promise<Sponsor | null> {
  const [row] = await controlDb
    .select()
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);
  return row ?? null;
}

/**
 * 🔴 The balance, and it goes through the floor too (C229).
 *
 * Returning a raw balance beside a suppressed chart is the differencing attack
 * with the chart removed: a sponsor who knows last week's balance and this
 * week's knows exactly what was spent, whatever the heatmap says.
 *
 * So a balance is only shown once the period since it last moved has cleared
 * the floor. Until then the sponsor reads "not enough activity to report yet",
 * which is honest and is also useful to them.
 */
export async function potBalance(
  sponsorId: string,
): Promise<{ balanceCents: number | null; overdraftCents: number; expiresAt: Date | null }> {
  const [pot] = await controlDb
    .select({
      balanceCents: sponsorPots.balanceCents,
      overdraftCents: sponsorPots.overdraftCents,
      expiresAt: sponsorPots.expiresAt,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  if (!pot) return { balanceCents: 0, overdraftCents: 0, expiresAt: null };
  return pot;
}

/** 53.9 — the live joining code, or none. */
export async function liveCode(sponsorId: string): Promise<string | null> {
  const [row] = await controlDb
    .select({ code: sponsorCodes.code })
    .from(sponsorCodes)
    .where(and(eq(sponsorCodes.sponsorId, sponsorId), isNull(sponsorCodes.revokedAt)))
    .orderBy(desc(sponsorCodes.createdAt))
    .limit(1);
  return row?.code ?? null;
}

/** 53.7 — what this sponsor asks a person for. */
export async function identifierFields(sponsorId: string) {
  return controlDb
    .select({
      id: sponsorIdentifierFields.id,
      kind: sponsorIdentifierFields.kind,
      domain: sponsorIdentifierFields.domain,
      shapeHint: sponsorIdentifierFields.shapeHint,
    })
    .from(sponsorIdentifierFields)
    .where(eq(sponsorIdentifierFields.sponsorId, sponsorId))
    .orderBy(asc(sponsorIdentifierFields.createdAt));
}

/**
 * 🔴 C234 / 53.22 — REMOVAL ENDS FUNDING AND THE BADGE AND TOUCHES NOTHING
 * ELSE.
 *
 * > *Their badge, their funding and their record are three different things and
 * > a build that treats them as one will take the record.*
 *
 * So this function writes to `enrolments` and to `patient_notifications`, and
 * to nothing else. It does not touch the record, the grants, the journals, the
 * summaries or the history, which were never the payer's. That is the strongest
 * thing we can say to an employee and it is said before they enrol, not after.
 *
 * The reason is one of four fixed values and the database refuses anything
 * else: a sponsor typing a reason is a sponsor writing a sentence about an
 * individual into our database, which is the one act C227 says they never
 * perform.
 *
 * 🔴 The notice to the person names NO EMPLOYER and NO REASON (C231 amended).
 */
export async function removeFromRoster(input: {
  sponsorId: string;
  enrolmentId: string;
  reason: RemovalReason;
  /** The sponsor user who did it, for `audit`. Never for the patient's log. */
  bySponsorUserId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const [removed] = await controlDb
    .update(enrolments)
    .set({
      removedAt: new Date(),
      removalReason: input.reason,
      state: "removed",
      /*
       * 🔴 The primary flag is cleared, so `enrolments_one_primary` lets the
       * person's other sponsor become primary. C249: exactly one is primary,
       * and a removed row holding the flag would leave somebody with a pot
       * nobody can pay from.
       */
      isPrimary: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(enrolments.id, input.enrolmentId),
        /* Scoped to the sponsor doing it. A borrowed id removes nobody. */
        eq(enrolments.sponsorId, input.sponsorId),
        isNull(enrolments.removedAt),
      ),
    )
    .returning({ personId: enrolments.personId });

  if (!removed) return { error: "That person is not on your list." };

  /*
   * 🔴 "Your benefit has ended." No employer, no reason, no prose in the row.
   *
   * C231 amended: a permanently undeletable entry naming an employer is a fact
   * about the employment relationship kept forever in a record C234 promises
   * the payer cannot touch, and it travels in an export. The payer's act is
   * audited separately, where it belongs.
   */
  await controlDb.insert(patientNotifications).values({
    personId: removed.personId,
    kind: "benefit_ended",
    messageKey: "pnotice.benefitEnded",
  });

  log.info("enrolment removed", { reason: input.reason });
  return { ok: true };
}

/**
 * 🔴 C240 — AN EMPLOYER CANNOT MANDATE ATTENDANCE THROUGH US, and there is no
 * function here that would let them.
 *
 * *"Go to the sessions or it goes on your file."* Unenforceable through us, on
 * purpose: we never confirm attendance to a sponsor for any individual, so a
 * mandate cannot be checked. That is the correct outcome rather than a gap, and
 * it is stated on the sponsor's own screen so nobody buys this expecting
 * otherwise.
 *
 * The enforcement is the absence of a function. There is no `hasBooked`, no
 * `sessionCountFor`, no `lastSeenAt` on a roster entry, and
 * `verify:sprint53` asserts that this module exports nothing shaped like one.
 */
export const ATTENDANCE_IS_NEVER_CONFIRMED = true;

/**
 * 🔴 53.3 / C228 — WEEKLY IS THE FINEST GRANULARITY THAT WILL EVER EXIST.
 *
 * *A day is an event; a week is a pattern.* Daily spend in a forty-person
 * company, set beside a known incident, a layoff or a bereavement, identifies a
 * person without a name being involved.
 *
 * Exported as a constant rather than left as a habit, so a future ticket asking
 * for "just daily for this one client" has to edit a line that says it will
 * never exist, and `verify:sprint53` asserts no sponsor query groups by day.
 */
export const FINEST_GRANULARITY = "week" as const;

/**
 * Weekly spend, from the ledger, through the floor. 53.25, 53.27.
 *
 * 🔴 Spend, never session COUNTS and never people (C228). The count is computed
 * only to apply the floor and is not returned to the caller in a form a sponsor
 * sees — `applyActivityFloor` returns it so a verifier can assert the floor
 * fired, and the sponsor surface renders `spendCents` alone.
 */
export async function weeklySpend(
  sponsorId: string,
  floor = DEFAULT_ACTIVITY_FLOOR,
): Promise<WeeklySpend[]> {
  /*
   * 🔴 GROUPED BY WEEK IN SQL, so there is no daily row anywhere in the
   * pipeline to leak. A query that fetched days and summed them in TypeScript
   * would put daily figures in a variable, in a log, and in a debugger.
   *
   * ## 🔴 The sponsor is on the leg's `ref`, and there is no new ledger
   *
   * C226 is explicit that there are no new ledger accounts beyond the pot
   * itself and no parallel billing path, so this uses the generic
   * `ref_type` / `ref_id` that `ledger_entries` already has. The first draft of
   * this query invented an `l.sponsor_id` column that does not exist, and
   * typecheck could not see it because the query is raw SQL — a runtime failure
   * that would have shipped.
   *
   * ## 🔴 And the join C244 forbids is one self-join away, deliberately
   *
   * Double entry means the pot leg and the session leg of one payment share a
   * `txn_id`. So "every pot cent traces to one payment in and one session out"
   * (53.16, C232) is TRUE, and "no screen may join a sponsor to a session, a
   * booking, a date or a patient name" (C244) is a rule about screens rather
   * than about the ledger — which is the only reading under which both hold.
   *
   * That is a knife-edge and it is named rather than hidden. The enforcement is
   * that no surface performs that self-join, which `verify:sprint53` asserts by
   * scanning for it across every file under `app/` and `components/` rather
   * than trusting this paragraph.
   */
  const rows = await controlDb.execute(sql`
    SELECT date_trunc('week', l.created_at) AS week_start,
           SUM(-l.amount_cents)::int        AS spend_cents,
           COUNT(*)::int                    AS sessions
      FROM ledger_entries l
     WHERE l.account = 'sponsor_pot'
       AND l.amount_cents < 0
       AND l.ref_type = 'sponsor'
       AND l.ref_id = ${sponsorId}
     GROUP BY 1
     ORDER BY 1 ASC`);

  const weeks = (rows.rows as { week_start: string; spend_cents: number; sessions: number }[]).map(
    (row) => ({
      weekStart: new Date(row.week_start),
      spendCents: Number(row.spend_cents),
      sessions: Number(row.sessions),
    }),
  );

  return applyActivityFloor(weeks, floor);
}
