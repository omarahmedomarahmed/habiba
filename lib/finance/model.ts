/**
 * The forecast. One pure function, thirty-six months.
 *
 * ## 🔴 Why one function and not a set of formulas
 *
 * "Everything is linked to everything" is the whole point of a financial model
 * and it is the thing a spreadsheet does badly. Changing patients-per-therapist
 * here moves therapists, sessions, AI cost, video cost, payment fees, revenue,
 * gross margin, the burn, the runway and the month the cash runs out. If those
 * were separate formulas, half of them would be updated and half would not, and
 * nothing would say which.
 *
 * So there is one function, it takes every assumption, and it returns every
 * month. Nothing partial, nothing cached, nothing that can be stale relative to
 * anything else.
 *
 * ## 🔴 It is PURE, and that is enforced
 *
 * No `Date`, no database, no `fetch`, no randomness. The same assumptions give
 * the same projection forever, which is what lets a number be defended three
 * months after it was quoted. `verify:finance` asserts the absence of all four.
 *
 * ## What it refuses to pretend
 *
 * That an earmark changes cash. Money raised is fungible; `allocation` is for
 * the slide and the model says so. And that it can forecast what it cannot:
 * churn, conversion and payment fees are `assumed` and carry that label into
 * every number derived from them.
 */
import type { Assumptions } from "./assumptions";

export type MonthRow = {
  /** 1-based. Month 1 is the first month of the forecast. */
  month: number;
  therapists: number;
  patients: number;
  sessions: number;
  /** Sessions whose patient turned recording on, which is what the AI fee rides on. */
  recordedSessions: number;

  /* ------------------------------------------------------------ revenue -- */
  subscriptionUsd: number;
  sessionFeeUsd: number;
  aiFeeUsd: number;
  revenueUsd: number;

  /* -------------------------------------------------------------- costs -- */
  aiCostUsd: number;
  videoCostUsd: number;
  paymentCostUsd: number;
  /** Revenue minus the costs that scale with a session. */
  grossProfitUsd: number;
  grossMarginPct: number;

  peopleUsd: number;
  otherCostUsd: number;
  operatingCostUsd: number;

  /* ------------------------------------------------------------- result -- */
  netUsd: number;
  cashUsd: number;
  headcount: number;

  /** Per-therapist model spend this month, for the flag. */
  aiPerTherapistUsd: number;
  flagged: boolean;
};

export type Projection = {
  name: string;
  months: MonthRow[];
  /** First month the cash goes below zero, or null if it never does. */
  runsOutInMonth: number | null;
  /** First month `netUsd` is positive, or null. */
  breakEvenMonth: number | null;
  /** Months of runway from today at the final month's burn. */
  runwayMonths: number | null;
  /**
   * How far below zero the cash ever goes, as a positive amount of money
   * somebody has to find. Zero when it never does.
   *
   * 🔴 This, not `runsOutInMonth`, is the size of the problem. A scenario can
   * cross zero in month 3 and bottom out in month 13.
   */
  deepestDeficitUsd: number;
  /** The month of that low point, or null if the cash never goes negative. */
  deepestDeficitMonth: number | null;
  totals: {
    revenueUsd: number;
    aiCostUsd: number;
    grossProfitUsd: number;
    netUsd: number;
  };
  /** Contribution of one therapist in the final month, after what they cost. */
  finalTherapistContributionUsd: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function forecast(a: Assumptions): Projection {
  const rows: MonthRow[] = [];

  const v = <T extends { value: number }>(i: T) => i.value;

  let therapists = v(a.market.startingTherapists);
  let cash = v(a.money.openingCashUsd);

  const sessionMinutes = v(a.unit.sessionMinutes);
  const aiPerSession =
    v(a.unit.aiFixedUsdPerSession) + v(a.unit.aiPerMinuteUsd) * sessionMinutes;

  for (let month = 1; month <= a.months; month++) {
    /* ------------------------------------------------------- the people -- */

    /*
     * Churn first, then arrivals. The other order quietly churns people who
     * joined this month, which flatters growth by a whole month's intake.
     */
    /*
     * 🔴 The growth rate for THIS month, which is not necessarily the steady
     * one. A round at month six that buys a salesperson at month seven must not
     * grow the business from month two, and a single constant did exactly that:
     * the funded scenario broke even four months before the money arrived.
     */
    const step = (a.market.growthSteps ?? [])
      .filter((g) => g.fromMonth <= month)
      .sort((x, y) => y.fromMonth - x.fromMonth)[0];
    const addedThisMonth = step ? step.perMonth : v(a.market.therapistsAddedPerMonth);

    if (month > 1) {
      therapists = therapists * (1 - v(a.market.therapistChurnMonthly));
      therapists += addedThisMonth;
    }

    const newThisMonth = month === 1 ? 0 : addedThisMonth;
    const patients = therapists * v(a.market.patientsPerTherapist);
    const sessions = patients * v(a.market.sessionsPerPatientPerMonth);
    const recorded = sessions * v(a.unit.recordingConsentRate);

    /*
     * 🔴 The free first session is a real acquisition cost, not a rounding
     * error: every new therapist gets one, and at 15% of a $20 session that is
     * $3 of revenue we chose not to take. Modelled as sessions that happen and
     * earn nothing rather than as a discount, because that is what it is.
     */
    const freeSessions = newThisMonth * v(a.market.freeSessionsPerNewTherapist);
    const payingSessions = Math.max(0, sessions - freeSessions);

    /* ------------------------------------------------------- the revenue -- */

    /*
     * 🔴 WHO PAYS WHAT, AND THE FIRST VERSION GOT ALL THREE WRONG AT ONCE.
     *
     * There are two separate charges and they land on different populations:
     *
     *   - the 15% CUT is on what the patient PAID, so paid sessions only, and
     *     it applies whether the therapist is on a plan or metered
     *   - the $1 room fee and the $3 note fee are METERED charges. They are on
     *     the session existing at all, so a free session, a radar session and
     *     an in-person session all bill the $1. **A subscriber pays neither.**
     *
     * ⚠️ What was here before folded the cut and the room fee into one
     * `feePerSession` and charged the sum on `payingSessions`, which was wrong
     * in three directions: it billed the room fee to subscribers, it billed the
     * room fee on no free sessions when it should bill on all of them, and it
     * charged the take rate to people who had not paid. `lib/finance/beta.ts`
     * was corrected at :409 and says so; this engine never got the fix, and
     * `verify:finance` did not catch it because it compared the two engines'
     * CONSTANTS rather than what they do with them.
     */
    const subscriberShare = v(a.pricing.payingShare);
    const subscriptionUsd =
      therapists * subscriberShare * v(a.pricing.blendedSubscriptionUsd);

    /** Our cut, on what a patient actually paid, from subscriber and metered alike. */
    const takeUsd =
      payingSessions * ((v(a.unit.sessionPriceUsd) * v(a.unit.platformFeeBps)) / 10_000);

    /** Every session a METERED account runs bills the room, paid or not. */
    const meteredSessions = sessions * (1 - subscriberShare);
    const roomFeeUsd = meteredSessions * (v(a.unit.platformFeeCents) / 100);

    /*
     * C209: the note fee only where the patient said yes, and only from a
     * metered account. `recorded` is every consented session; the subscriber
     * half of it is already paid for by the subscription.
     */
    const aiFeeUsd =
      recorded * (1 - subscriberShare) * v(a.unit.aiFeeUsdPerSession);

    const sessionFeeUsd = takeUsd + roomFeeUsd;
    const revenueUsd = subscriptionUsd + sessionFeeUsd + aiFeeUsd;

    /* --------------------------------------------------------- the costs -- */

    /*
     * 🔴 AI is charged on EVERY session, not only the paid ones. The free first
     * session still transcribes, still writes a note, still runs the risk pass.
     * Charging the model cost only where revenue lands is the single easiest
     * way to make a margin look better than it is.
     */
    const aiCostUsd = sessions * aiPerSession;

    /*
     * 🔴 Video is per PARTICIPANT-minute, so a session bills twice its length.
     * It belongs here and not in hosting: it scales with sessions, and a fixed
     * monthly line for it understates marginal cost exactly as volume grows.
     */
    const videoCostUsd = sessions * sessionMinutes * 2 * v(a.unit.videoPerParticipantMinuteUsd);

    /*
     * Payment processing, on the money that moves by card. Never measured by
     * the simulation, which runs Stripe in test mode and is charged nothing.
     */
    const cardVolume = payingSessions * v(a.unit.sessionPriceUsd) + subscriptionUsd;
    const paymentCostUsd =
      cardVolume * v(a.unit.paymentPercent) +
      (payingSessions + therapists * v(a.pricing.payingShare)) * v(a.unit.paymentFixedUsd);

    const grossProfitUsd = revenueUsd - aiCostUsd - videoCostUsd - paymentCostUsd;

    /* ------------------------------------------------------ the overhead -- */

    const activeHires = a.people.filter((h) => h.startMonth <= month);
    const peopleUsd = activeHires.reduce((sum, h) => sum + h.monthlyUsd * (1 + h.burden), 0);

    const otherCostUsd = a.costs
      .filter((c) => c.startMonth <= month && (c.endMonth === undefined || month <= c.endMonth))
      .reduce((sum, c) => sum + c.monthlyUsd + (c.perTherapistUsd ?? 0) * therapists, 0);

    const operatingCostUsd = peopleUsd + otherCostUsd;
    const netUsd = grossProfitUsd - operatingCostUsd;

    /* ----------------------------------------------------------- the cash -- */

    if (month === v(a.money.fundingMonth)) cash += v(a.money.fundingUsd);
    cash += netUsd;

    const aiPerTherapistUsd = therapists > 0 ? aiCostUsd / therapists : 0;

    rows.push({
      month,
      therapists: round2(therapists),
      patients: round2(patients),
      sessions: round2(sessions),
      recordedSessions: round2(recorded),
      subscriptionUsd: round2(subscriptionUsd),
      sessionFeeUsd: round2(sessionFeeUsd),
      aiFeeUsd: round2(aiFeeUsd),
      revenueUsd: round2(revenueUsd),
      aiCostUsd: round2(aiCostUsd),
      videoCostUsd: round2(videoCostUsd),
      paymentCostUsd: round2(paymentCostUsd),
      grossProfitUsd: round2(grossProfitUsd),
      grossMarginPct: revenueUsd > 0 ? round2((grossProfitUsd / revenueUsd) * 100) : 0,
      peopleUsd: round2(peopleUsd),
      otherCostUsd: round2(otherCostUsd),
      operatingCostUsd: round2(operatingCostUsd),
      netUsd: round2(netUsd),
      cashUsd: round2(cash),
      headcount: activeHires.length,
      aiPerTherapistUsd: round2(aiPerTherapistUsd),
      flagged: aiPerTherapistUsd > v(a.flags.aiPerTherapistMonthlyUsd),
    });
  }

  const runsOut = rows.find((r) => r.cashUsd < 0)?.month ?? null;
  const breakEven = rows.find((r) => r.netUsd > 0)?.month ?? null;

  /*
   * Runway from the LAST month's burn, which is the conservative reading: a
   * growing company's burn grows, so dividing today's cash by today's burn
   * flatters it. Null when the company is profitable, because runway is not a
   * meaningful number then and printing a large one implies it is.
   */
  const last = rows[rows.length - 1];
  const runwayMonths =
    last && last.netUsd < 0 ? round2(Math.max(0, last.cashUsd) / -last.netUsd) : null;

  /*
   * 🔴 THE NUMBER "IT RUNS OUT IN MONTH THREE" IS ACTUALLY ASKING FOR.
   *
   * Knowing the month you run out tells you there is a problem and nothing
   * about its size. The deepest the cash ever goes is what somebody has to put
   * in, and it is almost never the first negative month: the base scenario
   * crosses zero in month 3 and bottoms out in month 13, thirty-five thousand
   * dollars down. Plan against the first number and you raise a tenth of what
   * you need.
   *
   * Reported as a positive amount of MONEY REQUIRED, not as a negative balance,
   * because a minus sign in front of a cash figure is read as a loss and this
   * is a funding requirement.
   */
  const lowest = rows.reduce(
    (worst, r) => (r.cashUsd < worst.cashUsd ? r : worst),
    rows[0] ?? { cashUsd: 0, month: 0 },
  );
  const deepestDeficitUsd = lowest.cashUsd < 0 ? round2(-lowest.cashUsd) : 0;
  const deepestDeficitMonth = lowest.cashUsd < 0 ? lowest.month : null;

  const sum = (f: (r: MonthRow) => number) => round2(rows.reduce((s, r) => s + f(r), 0));

  return {
    name: a.name,
    months: rows,
    runsOutInMonth: runsOut,
    breakEvenMonth: breakEven,
    runwayMonths,
    deepestDeficitUsd,
    deepestDeficitMonth,
    totals: {
      revenueUsd: sum((r) => r.revenueUsd),
      aiCostUsd: sum((r) => r.aiCostUsd),
      grossProfitUsd: sum((r) => r.grossProfitUsd),
      netUsd: sum((r) => r.netUsd),
    },
    finalTherapistContributionUsd:
      last && last.therapists > 0 ? round2(last.grossProfitUsd / last.therapists) : 0,
  };
}
