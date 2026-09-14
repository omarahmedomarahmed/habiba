/**
 * Sprint 72 acceptance: the operating plan.
 *
 *   npm run verify:plan
 *
 * ## 🔴 WHAT A CHECK CAN AND CANNOT SAY ABOUT A PLAN
 *
 * It cannot say whether an Egyptian therapist will pay a thousand pounds a
 * month. Nothing in a repository can. What it CAN say is that the arithmetic
 * describes the offer somebody actually intends to run, and every check below is
 * of that kind: the cohort really is billed off its own age, the cliff really
 * lands where the offer says it lands, the welcome credit really leaves the bank
 * rather than being a discount with a different name.
 *
 * The one thing it asserts about the guesses is that they are LABELLED, because
 * a plan whose reader cannot tell a measurement from a hope is worse than no
 * plan.
 */
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

async function main() {
  const { runPlan } = await import("../lib/finance/beta");
  const { BETA, RUNWAY, GRANDFATHERED, HALF_PRICE_FOR_ALL, PLANS, PLAN_SLUGS, EGP_PER_USD } =
    await import("../lib/finance/plans");

  /* ================================================================== */
  /*  It is the plan that was described                                  */
  /* ================================================================== */

  check(
    "the plans ship, and the slugs line up with them",
    PLANS.length === PLAN_SLUGS.length && PLANS.length >= 5,
    PLAN_SLUGS.join(", "),
  );

  check(
    "🔴 the beta is three months, on twenty thousand dollars, with four people on the payroll",
    BETA.months === 3 &&
      BETA.openingCashUsd === 20_000 &&
      BETA.people.length === 4 &&
      BETA.people.every((p) => p.monthlyUsd === 500),
    `${BETA.people.length} people at $${BETA.people[0]?.monthlyUsd} a month, $${BETA.openingCashUsd} in the bank`,
  );

  const targets = Object.fromEntries(
    BETA.segments.map((s) => [s.key, s.arrivals.slice(0, 3).reduce((a, b) => a + b, 0)]),
  );
  check(
    "🔴 the acquisition targets are the ones that were set: 3 companies, 6 clinics, 9 therapists",
    targets.company === 3 && targets.clinic === 6 && targets.therapist === 9,
    `${targets.company} companies · ${targets.clinic} clinics · ${targets.therapist} therapists in three months`,
  );

  check(
    "🔴 the offer is free, half, half, then full",
    BETA.promo.schedule.length === 3 &&
      BETA.promo.schedule[0] === 0 &&
      BETA.promo.schedule[1] === 0.5 &&
      BETA.promo.schedule[2] === 0.5 &&
      BETA.promo.after === 1,
    `[${BETA.promo.schedule.join(", ")}] then ${BETA.promo.after}`,
  );

  const company = BETA.segments.find((s) => s.key === "company")!;
  check(
    "🔴 a company gets two hundred dollars of welcome credit and nobody else gets any",
    company.welcomeCreditUsd === 200 &&
      BETA.segments.filter((s) => s.key !== "company").every((s) => s.welcomeCreditUsd === 0),
    "the pot credit is the company offer, and it is not a discount",
  );

  /* ================================================================== */
  /*  The cohort machinery does what it exists to do                     */
  /* ================================================================== */

  /*
   * 🔴 THE CHECK THE WHOLE ENGINE EXISTS FOR.
   *
   * An aggregate model bills everybody the calendar's price. This one bills each
   * cohort its own. Proved by moving ONE cohort's arrival month and watching the
   * month its cliff lands move with it: under an aggregate model it would not.
   */
  const late = runPlan({
    ...BETA,
    months: 9,
    segments: BETA.segments.map((s) =>
      s.key === "therapist" ? { ...s, arrivals: [0, 0, 9], steadyPerMonth: 0 } : { ...s, arrivals: [0, 0, 0], steadyPerMonth: 0 },
    ),
  });
  const early = runPlan({
    ...BETA,
    months: 9,
    segments: BETA.segments.map((s) =>
      s.key === "therapist" ? { ...s, arrivals: [9, 0, 0], steadyPerMonth: 0 } : { ...s, arrivals: [0, 0, 0], steadyPerMonth: 0 },
    ),
  });

  /* The month each one first bills at full price: age 3, so join month + 3. */
  const firstFull = (r: ReturnType<typeof runPlan>) =>
    r.months.find((m) => m.discountGivenUsd === 0 && m.subscriptionUsd > 0)?.month ?? null;

  check(
    "🔴 a cohort is priced off ITS OWN age, not the calendar",
    firstFull(early) === 4 && firstFull(late) === 6,
    `joining in month 1 pays full from month ${firstFull(early)}; joining in month 3, from month ${firstFull(late)}`,
  );

  check(
    "🔴 CONTROL …and the two really are different, so the check is watching something",
    firstFull(early) !== firstFull(late),
    "an aggregate model would give both the same month, which is the defect this engine exists to avoid",
  );

  /*
   * 🔴 THE CLIFF IS REAL AND IT IS WHERE THE OFFER PUTS IT. The month full price
   * first lands is the month the most people leave.
   */
  const worst = early.months.reduce((a, b) => (b.left > a.left ? b : a), early.months[0]!);
  check(
    "🔴 the cliff lands in the month the discount ends, not before and not after",
    worst.month === 4,
    `most departures in month ${worst.month}, which is the first month at full price`,
  );

  /* ================================================================== */
  /*  The money behaves like money                                       */
  /* ================================================================== */

  const beta = runPlan(BETA);

  for (const m of beta.months) {
    const parts = m.subscriptionUsd + m.sessionFeeUsd + m.aiFeeUsd;
    if (Math.abs(parts - m.revenueUsd) > 0.05) {
      check("every month's revenue is the sum of its parts", false, `month ${m.month}`);
      break;
    }
  }
  check(
    "every month's revenue is the sum of its parts",
    beta.months.every(
      (m) => Math.abs(m.subscriptionUsd + m.sessionFeeUsd + m.aiFeeUsd - m.revenueUsd) < 0.05,
    ),
    `${beta.months.length} months, all closing`,
  );

  let cash = BETA.openingCashUsd;
  const cashTracks = beta.months.every((m) => {
    cash += m.netUsd;
    return Math.abs(cash - m.cashUsd) < 0.05;
  });
  check(
    "🔴 the cash line is the opening balance plus the running sum of net",
    cashTracks,
    "no month invents or loses money between the net line and the balance",
  );

  /*
   * 🔴 THE WELCOME CREDIT IS A COST, NOT A DISCOUNT, AND THE DIFFERENCE IS CASH.
   *
   * Turning it off has to make the company better off in cash terms. If it did
   * not, the model would be treating it as revenue foregone, which is what a
   * discount is and what this deliberately is not.
   */
  const noCredit = runPlan({
    ...BETA,
    segments: BETA.segments.map((s) => ({ ...s, welcomeCreditUsd: 0 })),
  });
  check(
    "🔴 the welcome credit is real money leaving, not revenue we chose not to bill",
    noCredit.months[2]!.cashUsd > beta.months[2]!.cashUsd &&
      beta.totals.creditBurnUsd > 0,
    `giving it away costs ${beta.totals.creditBurnUsd.toFixed(0)} dollars of cash over the quarter`,
  );

  /*
   * 🔴 …AND THE DISCOUNT IS THE OPPOSITE: revenue never billed.
   *
   * ⚠️ The first version of this check ran the plan again at full price and
   * asserted the AI cost was unchanged. It is not, and the check was wrong
   * rather than the model: removing the discount also removes the promotional
   * churn rate, so a different number of accounts survive and a different
   * number of sessions happen. That is two effects measured as one, which is §6
   * exactly.
   *
   * The actual property is an identity inside a single run: what was given away
   * is precisely the gap between list price and billed price, and it appears in
   * no cost line because it was never money.
   */
  check(
    "🔴 the discount is revenue never billed, and it is exactly the gap between list and billed",
    beta.months.every(
      (m) => Math.abs(m.subscriptionAtFullPriceUsd - m.subscriptionUsd - m.discountGivenUsd) < 0.005,
    ) && beta.totals.discountGivenUsd > 0,
    `${beta.totals.discountGivenUsd.toFixed(0)} dollars of list price never billed over the quarter, and no cost line carries it`,
  );

  /*
   * 🔴 CONTROL, and it is the one that separates a discount from a cost. Cash
   * out is `revenue - costs`, so if the discount had leaked into a cost line,
   * removing the OFFER while holding churn fixed would change the cost total.
   * It must not.
   */
  const fullPrice = runPlan({
    ...BETA,
    promo: { ...BETA.promo, schedule: [], after: 1, afterBeta: { schedule: [], after: 1 } },
    segments: BETA.segments.map((s) => ({
      ...s,
      churnInPromo: s.churnSteady,
      churnAtFullPrice: s.churnSteady,
    })),
  });
  const held = runPlan({
    ...BETA,
    segments: BETA.segments.map((s) => ({
      ...s,
      churnInPromo: s.churnSteady,
      churnAtFullPrice: s.churnSteady,
    })),
  });
  check(
    "🔴 CONTROL with churn held fixed, charging full price raises revenue and moves no cost",
    fullPrice.months[2]!.revenueUsd > held.months[2]!.revenueUsd &&
      Math.abs(fullPrice.months[2]!.aiCostUsd - held.months[2]!.aiCostUsd) < 0.05 &&
      Math.abs(fullPrice.months[2]!.videoCostUsd - held.months[2]!.videoCostUsd) < 0.05,
    "the same sessions run either way; only what was billed for them differs",
  );

  /*
   * 🔴 THE RAMP. An account that signed this month is not at full volume this
   * month. Removing the ramp has to RAISE early sessions, or it is decorative.
   */
  const noRamp = runPlan({
    ...BETA,
    segments: BETA.segments.map((s) => ({ ...s, rampMonths: 1 })),
  });
  check(
    "🔴 a new account ramps to full volume rather than arriving at it",
    noRamp.months[0]!.sessions > beta.months[0]!.sessions * 1.2,
    `month one is ${beta.months[0]!.sessions.toFixed(0)} sessions with the ramp and ${noRamp.months[0]!.sessions.toFixed(0)} without it`,
  );

  /* ================================================================== */
  /*  It is deterministic and it is pure                                 */
  /* ================================================================== */

  check(
    "🔴 the same plan twice gives the same answer",
    JSON.stringify(runPlan(BETA)) === JSON.stringify(beta),
    "a plan that differs between two readings of the same inputs is not one",
  );

  const engine = readSource("lib/finance/beta.ts");
  const IMPURE = [
    { name: "a clock", re: /new Date\(|Date\.now\(/ },
    { name: "a database", re: /\bdb\b|drizzle|@\/lib\/db/ },
    { name: "the network", re: /\bfetch\(|axios/ },
    { name: "randomness", re: /Math\.random/ },
  ];
  const impure = IMPURE.filter((i) => i.re.test(engine));
  check(
    "🔴 the engine has no clock, no database, no network and no randomness",
    impure.length === 0,
    impure.map((i) => i.name).join(", ") || "four ways a number stops being reproducible, all absent",
  );

  check(
    "🔴 CONTROL the purity scan catches each of the four",
    IMPURE.every((i) => i.re.test("new Date() db fetch( Math.random()")),
    "watched catching all four shapes",
  );

  /* ================================================================== */
  /*  It cannot charge anybody, same as the forecast                     */
  /* ================================================================== */

  const plans = readSource("lib/finance/plans.ts");
  check(
    "🔴 C360 the plan cannot reach anything that bills somebody",
    !/lib\/billing|lib\/ledger|invoices|sessionPayments|platformSettings/.test(
      [...engine.split("\n"), ...plans.split("\n")].filter((l) => /^\s*import\b|from\s+["']/.test(l)).join("\n"),
    ),
    "it reads the measured AI terms and nothing else from outside itself",
  );

  /* ================================================================== */
  /*  Every guess is labelled as one                                     */
  /* ================================================================== */

  /*
   * 🔴 THE HONESTY CHECK, AND IT IS THE POINT OF THE FILE.
   *
   * `plans.ts` divides every number into measured, decided and guess. A number
   * without one of those beside it is a number a reader will take for a fact.
   * Counted rather than eyeballed, because the file is long enough that one
   * unlabelled constant would never be noticed.
   *
   * 🔴 AND THE LABELS ARE DATA.
   *
   * ⚠️ The first version of this read `plans.ts` raw and counted comment
   * markers, and `verify:sprint37l2` caught it: C205 forbids reading TypeScript
   * without stripping comments, and the deeper rule is the one
   * `evals/prose.json` already learned once — a record only a comment holds is a
   * record no check can verify. `PROVENANCE` is now a list, this reads the list,
   * and the comments beside each value stay where they are explaining why.
   */
  const { PROVENANCE, provenanceCounts } = await import("../lib/finance/plans");
  const counts = provenanceCounts();

  check(
    "🔴 every kind of number is labelled, and the guesses outnumber the measurements",
    counts.guess >= 12 && counts.decided >= 6 && counts.measured >= 1 && counts.guess > counts.measured,
    `${counts.measured} measured · ${counts.decided} decided · ${counts.guess} guessed. A plan that claimed otherwise at this stage would be lying`,
  );

  /*
   * 🔴 AND EVERY LABEL CARRIES A SENTENCE. "guess" on its own is a shrug; "guess,
   * because a Cairo session runs 300 to 800 pounds" is something a reader can
   * argue with, which is the entire point of labelling them.
   */
  const unexplained = PROVENANCE.filter((r) => !r.why || r.why.length < 15);
  check(
    "🔴 …and every one says WHY, in a sentence somebody can argue with",
    unexplained.length === 0,
    unexplained.map((r) => r.path).join(", ") || `${PROVENANCE.length} inputs, all explained`,
  );

  /*
   * 🔴 AND THE ONE NUMBER THAT IS NOT A GUESS IS THE ONE THAT WAS MEASURED.
   * The AI terms come from `scenarios.ts`, which reads them from the benchmark,
   * rather than being retyped here where they could drift.
   */
  const { AI_FIXED_USD, AI_PER_MINUTE_USD } = await import("../lib/finance/scenarios");
  check(
    "🔴 the AI cost is imported from the measurement, never retyped",
    BETA.unit.aiFixedUsd === AI_FIXED_USD &&
      BETA.unit.aiPerMinuteUsd === AI_PER_MINUTE_USD &&
      /import \{ AI_FIXED_USD, AI_PER_MINUTE_USD \}/.test(plans),
    "one definition, so re-measuring re-prices every plan at once",
  );

  /* ================================================================== */
  /*  The findings the plan rests on                                     */
  /* ================================================================== */

  const runway = runPlan(RUNWAY);
  check(
    "🔴 the angel cheque alone reaches break even, and the cash never goes negative",
    runway.breakEvenMonth !== null && runway.runsOutInMonth === null,
    `break even month ${runway.breakEvenMonth}, low point ${Math.min(...runway.months.map((m) => m.cashUsd)).toFixed(0)} dollars`,
  );

  /*
   * 🔴 THE COMPARISON THAT DECIDES THE PRICING POLICY MUST BE FAIR.
   *
   * The first draft gave the half-price scenario better arrivals AND better
   * churn, then reported that half price won. That is the assumption restated,
   * not a finding. The two must differ in the pricing policy alone.
   */
  const g = JSON.stringify(GRANDFATHERED.segments.map((s) => [s.key, s.arrivals, s.steadyPerMonth]));
  const h = JSON.stringify(HALF_PRICE_FOR_ALL.segments.map((s) => [s.key, s.arrivals, s.steadyPerMonth]));
  check(
    "🔴 the two pricing options are compared on identical arrivals and identical spend",
    g === h &&
      JSON.stringify(GRANDFATHERED.people) === JSON.stringify(HALF_PRICE_FOR_ALL.people) &&
      JSON.stringify(GRANDFATHERED.spend) === JSON.stringify(HALF_PRICE_FOR_ALL.spend),
    "they differ in what a customer pays after the beta, and in nothing else",
  );

  check(
    "🔴 …and the screen shows it, with the plan above the abstract model",
    (() => {
      const page = readSource("app/(admin)/admin/financial-model/page.tsx");
      return (
        /<PlanTables/.test(page) && page.indexOf("<PlanTables") < page.indexOf("<FinancialModel")
      );
    })(),
    "the plan the company will run comes before the generic growth model",
  );

  check(
    "the pounds are converted at one stated rate rather than per line",
    EGP_PER_USD > 0 && /EGP_PER_USD/.test(plans),
    `${EGP_PER_USD} EGP to the dollar, in one place, so a move re-prices everything at once`,
  );

  finish("sprint 72");
}

main();
