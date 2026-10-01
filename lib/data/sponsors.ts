import "server-only";

import { and, asc, desc, eq, gte, isNull, notInArray, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  enrolments,
  ledgerEntries,
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
 * | Their own pause of it | When they joined, or last re-verified |
 * | Nothing else | Any clinical fact, in any form |
 *
 * 🔴 F7: the last-verified date left this shape too: it is stamped when one
 * person re-proves their employment, usually on their way to a booking.
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
   * 🔴 W2-S11: paused BY THIS COMPANY, which is its own act and so its own to
   * see and to undo. Nothing here says whether, when or how often anybody
   * USED the benefit.
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
      /*
       * 🔴 F7: no `lastVerifiedAt` and no `pausedAt` either. Both are stamped
       * when one person re-proves their employment, which in practice is when
       * they come back to book: a per-person "last used" by another name. The
       * company manages its own staff list; it never learns who used it.
       */
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
 * 🔴 The balance a company may see, under the same floor as every other figure.
 *
 * DD-2 B1: this used to publish a new balance once `activityFloor` SESSIONS had
 * happened since the last one, and five sessions can be one person. Now it is
 * the balance as of the end of the last published period (`publishedLedger`,
 * at least `floor` different people, complete weeks only): the live balance
 * with every session-driven movement since then added back. The company's own
 * acts (top-ups and money returned to it) always show at once.
 *
 * `published` is the session count and spend from the same periods, so the
 * balance, the totals, the chart and the ledger page all move together.
 */
export async function potBalance(
  sponsorId: string,
  now = new Date(),
): Promise<{
  balanceCents: number | null;
  overdraftCents: number;
  expiresAt: Date | null;
  /** The sessions and spend of the published periods. Null when none is published. */
  published: { sessions: number; spentCents: number } | null;
}> {
  const [pot] = await controlDb
    .select({
      balanceCents: sponsorPots.balanceCents,
      overdraftCents: sponsorPots.overdraftCents,
      expiresAt: sponsorPots.expiresAt,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  if (!pot) return { balanceCents: null, overdraftCents: 0, expiresAt: null, published: null };

  const { publishedLedger } = await import("@/lib/data/sponsor-ledger");
  const { weekAfter } = await import("@/lib/sponsor/ledger");
  const view = await publishedLedger(sponsorId, now);
  const since = view.publishedThrough ? weekAfter(view.publishedThrough) : null;
  const hidden = await sessionMovementSince(sponsorId, since);

  return {
    balanceCents: pot.balanceCents + hidden,
    overdraftCents: pot.overdraftCents,
    expiresAt: pot.expiresAt,
    published:
      view.stats.sessions === null || view.stats.spendCents === null
        ? null
        : { sessions: view.stats.sessions, spentCents: view.stats.spendCents },
  };
}

/**
 * DD-2 B1: the net of every session-driven pot movement since `since` (all
 * time when null), from the ledger. A spend is a positive `sponsor_pot` leg and
 * a refund back into the pot a negative one; the company's own top-ups and
 * returns are left out, because those it may always see.
 */
export async function sessionMovementSince(sponsorId: string, since: Date | null): Promise<number> {
  const [row] = await controlDb
    .select({ cents: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
        notInArray(ledgerEntries.txnKind, ["pot_topup", "pot_return"]),
        since ? gte(ledgerEntries.createdAt, since) : undefined,
      ),
    );
  return Number(row?.cents ?? 0);
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
 * Weekly spend for the overview chart. 53.25, 53.27.
 *
 * DD-2 B1: from `publishedLedger`, the same periods the ledger page shows, so
 * a week appears only inside a period of at least `floor` different people and
 * the current week never does. It used to count sessions, so one person's five
 * sessions published a week. Null is held back, never zero.
 */
export async function weeklySpend(sponsorId: string, now = new Date()): Promise<WeeklySpend[]> {
  const { publishedLedger } = await import("@/lib/data/sponsor-ledger");
  const view = await publishedLedger(sponsorId, now);
  return view.series.map((week) => ({
    weekStart: new Date(`${week.weekStart}T00:00:00Z`),
    spendCents: week.spendCents,
    sessions: null,
  }));
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
  /*
   * 🔴 Board 454 (CO8.1): THE NOTICE PROTECTS PEOPLE, SO IT NEEDS SOMEBODY TO PROTECT.
   *
   * A company activated minutes earlier, with nobody enrolled and nothing ever
   * paid from its pot, starts at 100% and could not set its agreed 10%: the cut
   * was scheduled a month out, and every session meanwhile would have been paid
   * in full from the pot. With nobody enrolled and no booking behind it, there
   * is nobody a lower percentage can surprise, so it applies now.
   */
  if (wanted > pot.coverageBps || !(await coverageHasAudience(input.sponsorId))) {
    await controlDb
      .update(sponsorPots)
      .set({
        coverageBps: wanted,
        pendingCoverageBps: null,
        pendingCoverageFrom: null,
        updatedAt: new Date(),
      })
      .where(eq(sponsorPots.id, pot.id));

    log.info(wanted > pot.coverageBps ? "sponsor coverage raised" : "sponsor coverage set before anyone joined", {
      bps: wanted,
    });
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
 * 🔴 Board 454: is there anybody a lower percentage could surprise? Somebody
 * enrolled (in any state but removed), or a session ever paid from the pot,
 * which is how a booking reaches this sponsor's books without naming anyone.
 */
export async function coverageHasAudience(sponsorId: string): Promise<boolean> {
  const [enrolled] = await controlDb
    .select({ id: enrolments.id })
    .from(enrolments)
    .where(and(eq(enrolments.sponsorId, sponsorId), sql`${enrolments.state} <> 'removed'`))
    .limit(1);
  if (enrolled) return true;
  /*
   * The pot's own ledger, not `sponsor_money_entries`: C244 keeps that table to
   * one reader (the company money view), and "has the pot ever paid for a
   * session" is a question the books answer without it.
   */
  const { potHasPaidForSession } = await import("@/lib/billing/ledger");
  return potHasPaidForSession(sponsorId);
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
