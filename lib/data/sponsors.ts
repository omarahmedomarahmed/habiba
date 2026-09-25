import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  enrolments,
  patientNotifications,
  people,
  sponsorCodes,
  sponsorIdentifierFields,
  rateLimits,
  sponsorPots,
  sponsors,
  type RemovalReason,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { getSettings } from "@/lib/settings";
import { subjectKey } from "@/lib/rate-limit";

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
  /**
   * 🔴 W2-S11: paused BY THIS COMPANY, which is its own act and so its own to
   * see and to undo. A re-verification pause (`paused`) is not: the page never
   * renders that one (E2), because it is stamped when one person comes back.
   */
  heldByYou: boolean;
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
      /*
       * W2-S11: a boolean, never the state itself: `provisional` is somebody
       * who enrolled in the last few days, which is the join date by another
       * name.
       */
      heldByYou: sql<boolean>`${enrolments.state} = 'paused'`,
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
    heldByYou: row.heldByYou === true,
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
): Promise<{
  balanceCents: number | null;
  overdraftCents: number;
  expiresAt: Date | null;
  /**
   * 🔴 E1 — the session count and spend that go WITH the published balance,
   * one snapshot, never the live totals. Null until a balance has been
   * published, for the reason the balance is.
   */
  published: { sessions: number; spentCents: number } | null;
}> {
  /*
   * 🔴 C377 — THIS FUNCTION DESCRIBED A FLOOR IT DID NOT APPLY, and nothing
   * called it anyway.
   *
   * The docblock above has always said "a balance is only shown once the period
   * since it last moved has cleared the floor". The body read the live balance
   * and returned it. Both sponsor screens ignored this function entirely and
   * rendered `ledgerPotBalance` raw, so the ruling was unenforced twice over: by
   * a body that did not implement it and by callers that did not call it.
   *
   * A comment describing a protection is the most expensive kind of defect in
   * this repository, because it reads as coverage to the next person.
   *
   * The rule, built: a balance is publishable only when the live pot-funded
   * session count has moved at least `activityFloor` beyond the count at which
   * the last balance was published. Until then the sponsor sees the balance
   * they already saw, or null if there has never been one.
   *
   * 🔴 Null is NOT zero and must never be rendered as it. "We have not got
   * enough activity to report" and "the pot is empty" are different facts, and
   * a sponsor who cannot tell them apart can subtract one from the other, which
   * is the differencing attack in one subtraction.
   */
  const [pot] = await controlDb
    .select({
      balanceCents: sponsorPots.balanceCents,
      overdraftCents: sponsorPots.overdraftCents,
      expiresAt: sponsorPots.expiresAt,
      publishedBalanceCents: sponsorPots.publishedBalanceCents,
      publishedSessions: sponsorPots.publishedSessions,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  if (!pot) return { balanceCents: null, overdraftCents: 0, expiresAt: null, published: null };

  const settings = await getSettings();
  const floor = settings.sponsor.activityFloor;

  /*
   * The session count comes from `potTotals`, which reads the LEDGER, so this
   * floor and the weekly heatmap beside it are counting the same events. Two
   * counts of "how many sessions came out of this pot" would eventually
   * disagree, and a sponsor able to see both could difference them.
   */
  const { potTotals, potSpentThrough } = await import("@/lib/billing/pot");
  const { sessions } = await potTotals(sponsorId);

  /*
   * Enough has happened since the last publication, so a new balance may be
   * published. The write is conditional on the count we just read, so two
   * readers racing cannot both publish and reveal a one-session difference
   * between their two answers.
   */
  if (sessions - pot.publishedSessions >= floor) {
    await controlDb
      .update(sponsorPots)
      .set({
        publishedBalanceCents: pot.balanceCents,
        publishedSessions: sessions,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sponsorPots.sponsorId, sponsorId),
          eq(sponsorPots.publishedSessions, pot.publishedSessions),
        ),
      );

    return {
      balanceCents: pot.balanceCents,
      overdraftCents: pot.overdraftCents,
      expiresAt: pot.expiresAt,
      published: { sessions, spentCents: await potSpentThrough(sponsorId, sessions) },
    };
  }

  return {
    balanceCents: pot.publishedBalanceCents,
    overdraftCents: pot.overdraftCents,
    expiresAt: pot.expiresAt,
    published:
      pot.publishedBalanceCents === null
        ? null
        : {
            sessions: pot.publishedSessions,
            spentCents: await potSpentThrough(sponsorId, pot.publishedSessions),
          },
  };
}

/** How many people are enrolled now (not removed), the roster's own count. */
export async function enrolledCount(sponsorId: string): Promise<number> {
  const [row] = await controlDb
    .select({ n: sql<number>`count(*)::int` })
    .from(enrolments)
    .where(and(eq(enrolments.sponsorId, sponsorId), isNull(enrolments.removedAt)));
  return row?.n ?? 0;
}

/**
 * 🔴 K6: THE BALANCE A COMPANY SCREEN MAY SHOW, BEHIND THE HEADCOUNT FLOOR TOO.
 *
 * `potBalance` floors by sessions since the last publication, which stops a
 * one-session difference. It does not stop a company of three reading
 * "Sessions paid for: 4" and knowing that somebody among three people it can
 * name is in therapy. The heatmap already goes dark under `activityFloor`
 * enrolled people; every company-facing figure derived from the pot goes dark
 * with it, from this one function, so no screen can forget the gate.
 *
 * `potBalance` itself stays ungated for the money paths (the pot alerts),
 * which never render a session count.
 *
 * 🔴 B3 — AND WHAT THE COMPANY PUT IN IS NEVER HIDDEN FROM IT. A company under
 * the floor read "Not enough activity to report yet" after its welcome credit
 * and after a confirmed $500 top-up: its own money, which it had just paid,
 * vanished from every screen. `fundedCents` is credits less returns, the
 * company's own acts only, so it is shown whatever the headcount. The balance
 * net of spend stays behind both floors, because at a company of three any fall
 * in it says somebody is in therapy.
 */
export async function reportablePot(
  sponsorId: string,
): Promise<
  Awaited<ReturnType<typeof potBalance>> & { underHeadcount: boolean; fundedCents: number }
> {
  const { potFundedCents } = await import("@/lib/billing/pot");
  const [pot, headcount, settings, fundedCents] = await Promise.all([
    potBalance(sponsorId),
    enrolledCount(sponsorId),
    getSettings(),
    potFundedCents(sponsorId),
  ]);
  if (headcount < settings.sponsor.activityFloor) {
    return { ...pot, balanceCents: null, published: null, underHeadcount: true, fundedCents };
  }
  return { ...pot, underHeadcount: false, fundedCents };
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

/**
 * 🔴 53.19 — HOW MANY ATTEMPTS ON THEIR CODE THIS WEEK. A NUMBER, NEVER NAMES.
 *
 * *A spike alerting admin and the sponsor as a number, never names.*
 *
 * `lib/data/enrolment.ts` counts every attempt on a live code against a key derived
 * from the code alone. This reads that count. What it cannot return is who tried or
 * what they typed, because the counter holds neither: a list of attempted employee
 * numbers is a list of people who tried, and half of them would be real staff who
 * mistyped.
 *
 * The threshold is a judgement rather than a rule, so it is exported and the screens
 * compare against it. A sponsor whose poster went up in a lobby this morning will
 * see a number that means nothing is wrong.
 */
export const SPIKE_THRESHOLD = 50;

export async function attemptsOnCode(code: string | null): Promise<number> {
  if (!code) return 0;

  const [row] = await controlDb
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(eq(rateLimits.key, subjectKey("enrol-code", code.trim().toUpperCase())))
    .limit(1);

  return row?.count ?? 0;
}

/** 53.7 — what this sponsor asks a person for. */
export async function identifierFields(sponsorId: string) {
  return controlDb
    .select({
      id: sponsorIdentifierFields.id,
      kind: sponsorIdentifierFields.kind,
      domain: sponsorIdentifierFields.domain,
      shapeHint: sponsorIdentifierFields.shapeHint,
      /* W2-S06: their own gate, for the test box on their own settings page. */
      pattern: sponsorIdentifierFields.pattern,
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
 * 🔴 W2-S11 / D1: PAUSE AND RESUME ONE PERSON'S BENEFIT, and they are told.
 *
 * The founder's decision: a company controls its employees' benefit (end,
 * pause, resume) and never sees their sessions. Pausing stops the funding and
 * nothing else, like C234's removal without the finality: the badge, the record
 * and the place on the list stay, and `payFromPot` funds only `active` and
 * `provisional`, so a paused person is offered the ordinary pay link.
 *
 * 🔴 `state = 'paused'`, NOT `paused_at`. `paused_at` is C247's re-verification
 * pause, lifted by the person proving themselves again. Sharing it would let a
 * company's resume lift a pause that was never theirs, and would show the
 * company a pause that tells it when one named person came back (E2).
 *
 * Only an `active` enrolment is paused: resuming writes `active`, and a
 * `provisional` one paused and resumed would skip its allowance (C350).
 *
 * 🔴 The notices name NO EMPLOYER and NO REASON (C231 amended), exactly as
 * removal's does. The company's act is audited by the caller.
 */
export async function pauseBenefit(input: {
  sponsorId: string;
  enrolmentId: string;
}): Promise<{ ok?: true; error?: string }> {
  const [row] = await controlDb
    .update(enrolments)
    .set({ state: "paused", updatedAt: new Date() })
    .where(
      and(
        eq(enrolments.id, input.enrolmentId),
        /* Scoped to the company doing it. A borrowed id pauses nobody. */
        eq(enrolments.sponsorId, input.sponsorId),
        eq(enrolments.state, "active"),
        isNull(enrolments.removedAt),
      ),
    )
    .returning({ personId: enrolments.personId });

  if (!row) return { error: "That benefit cannot be paused now." };

  await controlDb.insert(patientNotifications).values({
    personId: row.personId,
    kind: "benefit_paused",
    /* The words the benefit page already uses for a paused benefit. */
    messageKey: "benefit.paused",
  });

  log.info("benefit paused by the sponsor");
  return { ok: true };
}

export async function resumeBenefit(input: {
  sponsorId: string;
  enrolmentId: string;
}): Promise<{ ok?: true; error?: string }> {
  const [row] = await controlDb
    .update(enrolments)
    .set({ state: "active", updatedAt: new Date() })
    .where(
      and(
        eq(enrolments.id, input.enrolmentId),
        eq(enrolments.sponsorId, input.sponsorId),
        /*
         * Only the company's own pause. `paused_at` is not touched: a
         * re-verification pause is the person's to lift, and `payFromPot` keeps
         * refusing while it stands.
         */
        eq(enrolments.state, "paused"),
        isNull(enrolments.removedAt),
      ),
    )
    .returning({ personId: enrolments.personId });

  if (!row) return { error: "That benefit is not paused by you." };

  await controlDb.insert(patientNotifications).values({
    personId: row.personId,
    /* The benefit starting again, which is what the person experiences. */
    kind: "benefit_started",
    messageKey: "pnotice.benefitResumed",
  });

  log.info("benefit resumed by the sponsor");
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
   * ## 🔴 SPEND IS A POSITIVE LEG, and the first draft of this had it backwards
   *
   * `sponsor_pot` is a liability, so it rises with a NEGATIVE amount — the
   * schema states that convention once and `heldForTherapist` already negates
   * for the same reason. A top-up is therefore negative and a session SPENDING
   * the pot is positive, because spending reduces what we owe.
   *
   * This query originally read `amount_cents < 0` as spend, which is the sign of
   * a top-up. It would have reported every deposit as expenditure and every
   * session as nothing, and it would have looked entirely plausible on a chart.
   * `verify:sprint53` now posts a top-up and a spend and asserts which one this
   * counts, rather than trusting the sign written here.
   *
   * That is a knife-edge and it is named rather than hidden. The enforcement is
   * that no surface performs that self-join, which `verify:sprint53` asserts by
   * scanning for it across every file under `app/` and `components/` rather
   * than trusting this paragraph.
   */
  const rows = await controlDb.execute(sql`
    SELECT date_trunc('week', l.created_at) AS week_start,
           SUM(l.amount_cents)::int         AS spend_cents,
           COUNT(*)::int                    AS sessions
      FROM ledger_entries l
     WHERE l.account = 'sponsor_pot'
       AND l.amount_cents > 0
       AND l.txn_kind <> 'pot_return'
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

/* ------------------------------------------------ 60.1 to 60.6 · coverage -- */

/**
 * 🔴 60.1 / C311 / C344 — SET WHAT THIS EMPLOYER COVERS, with the asymmetry.
 *
 * An INCREASE applies at once. A DECREASE waits out a notice window, because a
 * person being asked for money they were not expecting deserves warning and a
 * person being asked for less does not.
 *
 * ## 🔴 WHY THE WINDOW IS DATA AND NOT A JOB
 *
 * The obvious build schedules a task to flip the number when the window closes.
 * A task that fails leaves an employer paying a percentage they changed three
 * weeks ago, and nothing on any screen says so. The pending pair applies itself
 * by being in the past: `coverageNow` reads it, every booking reads
 * `coverageNow`, and there is nothing to fail.
 *
 * ## 🔴 0% IS A SETTING, NOT A REMOVAL (C345)
 *
 * Nothing here touches the roster. The person keeps their place and their
 * badge; the money stops. C234 already separates a badge from funding and this
 * is the same separation with a number on it.
 *
 * ## 🔴 IT NAMES NOBODY
 *
 * A percentage is a fact about the account. There is no individual anywhere in
 * this function, which is C227 unchanged: a sponsor performs no act about any
 * one person except removal.
 */
export async function setCoverage(input: {
  sponsorId: string;
  coverageBps: number;
  /** Days of warning before a REDUCTION bites. An increase ignores it. */
  noticeDays: number;
  bySponsorUserId: string;
}): Promise<{ ok?: true; error?: string; effectiveFrom?: Date }> {
  const wanted = Math.round(input.coverageBps);

  /*
   * Validated here as well as in the CHECK, because a constraint violation
   * reaches a person as a failed save naming a constraint. Five per cent steps
   * are what a finance team agrees to; anything else is a typo or an API.
   */
  if (!Number.isInteger(wanted) || wanted < 0 || wanted > 10_000 || wanted % 500 !== 0) {
    return { error: "Coverage is a whole percentage in steps of five, from 0 to 100." };
  }

  const [row] = await controlDb
    .select({
      id: sponsorPots.id,
      coverageBps: sponsorPots.coverageBps,
      pendingCoverageBps: sponsorPots.pendingCoverageBps,
      pendingCoverageFrom: sponsorPots.pendingCoverageFrom,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, input.sponsorId))
    .limit(1);

  if (!row) return { error: "This account has no pot yet. We open it with you, with the terms agreed." };

  /*
   * 🔴 COMPARED WITH WHAT IS IN FORCE, NOT WITH A STALE COLUMN.
   *
   * A reduction that had fallen due was read by `coverageNow` and never
   * written back, so 100 -> 50 (in force) -> 80 was treated as a cut from 100,
   * scheduled a month out, and cleared the 50: the pot paid 100% meanwhile.
   * A due change is folded in first; choosing the figure in force again
   * cancels a scheduled cut rather than doing nothing.
   */
  const { coverageNow } = await import("@/lib/settings/defs");
  const live = coverageNow(row, new Date());
  const pot = { id: row.id, coverageBps: live };
  if (live !== row.coverageBps) {
    await controlDb
      .update(sponsorPots)
      .set({ coverageBps: live, pendingCoverageBps: null, pendingCoverageFrom: null, updatedAt: new Date() })
      .where(eq(sponsorPots.id, row.id));
  }
  if (live === wanted) {
    if (row.pendingCoverageBps !== null && live === row.coverageBps) {
      await controlDb
        .update(sponsorPots)
        .set({ pendingCoverageBps: null, pendingCoverageFrom: null, updatedAt: new Date() })
        .where(eq(sponsorPots.id, row.id));
    }
    return { ok: true };
  }

  /*
   * 🔴 THE ASYMMETRY, C344, in four lines and with the reason beside them.
   *
   * More is immediate. Less waits. Somebody reading this later will want to
   * change it to be consistent, so: consistency here would mean either delaying
   * good news for no reason, or asking a patient for money on a session they
   * have already agreed to, and only one of those is a real cost.
   */
  if (wanted > pot.coverageBps) {
    await controlDb
      .update(sponsorPots)
      .set({
        coverageBps: wanted,
        pendingCoverageBps: null,
        pendingCoverageFrom: null,
        updatedAt: new Date(),
      })
      .where(eq(sponsorPots.id, pot.id));

    log.info("sponsor coverage raised", { bps: wanted });
    return { ok: true, effectiveFrom: new Date() };
  }

  const days = Math.max(0, Math.round(input.noticeDays));
  const from = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await controlDb
    .update(sponsorPots)
    .set({
      pendingCoverageBps: wanted,
      pendingCoverageFrom: from,
      updatedAt: new Date(),
    })
    .where(eq(sponsorPots.id, pot.id));

  log.info("sponsor coverage reduction scheduled", { bps: wanted, days });
  return { ok: true, effectiveFrom: from };
}

/**
 * What this sponsor covers, for their own screen and for a patient's.
 *
 * 🔴 Returns the LIVE figure and the pending one separately rather than
 * resolving to a single number, because both screens need to say "this is what
 * we cover, and from the 14th it will be that". A caller that only wants the
 * number applies `coverageNow`.
 */
export async function coverageFor(sponsorId: string): Promise<{
  coverageBps: number;
  pendingCoverageBps: number | null;
  pendingCoverageFrom: Date | null;
} | null> {
  const [pot] = await controlDb
    .select({
      coverageBps: sponsorPots.coverageBps,
      pendingCoverageBps: sponsorPots.pendingCoverageBps,
      pendingCoverageFrom: sponsorPots.pendingCoverageFrom,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  if (!pot) return null;
  /* A change that has fallen due is the figure in force, with nothing pending. */
  if (pot.pendingCoverageBps !== null && pot.pendingCoverageFrom !== null && pot.pendingCoverageFrom.getTime() <= Date.now()) {
    return { coverageBps: pot.pendingCoverageBps, pendingCoverageBps: null, pendingCoverageFrom: null };
  }
  return pot;
}
