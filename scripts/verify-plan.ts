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
  const { BETA, BETA_THEN_CLIFF, RUNWAY, PLANS, PLAN_SLUGS, EGP_PER_USD } = await import(
    "../lib/finance/plans"
  );

  /* ================================================================== */
  /*  It is the plan that was described                                  */
  /* ================================================================== */

  check(
    "the plans ship, and the slugs line up with them",
    PLANS.length === PLAN_SLUGS.length && PLANS.length === 3,
    PLAN_SLUGS.join(", "),
  );

  /*
   * 🔴 AND THERE IS NO SCENARIO FOR WHAT HAPPENS AFTER THE OFFER, because
   * nothing happens after the offer.
   *
   * Two scenarios used to model a choice at the end of the promotion: keep the
   * beta cohort on a permanent discount, or move everybody to half price. Both
   * are gone. The offer is three months long, it ends, and everybody pays list
   * price from then on. A plan that still carried the comparison would be
   * offering a decision nobody is going to make, and the first person to read it
   * would assume the decision was still open.
   */
  check(
    "🔴 nothing is modelled after the offer ends, because nothing happens after it ends",
    PLAN_SLUGS.every((slug) => !/grandfather|half.?price/i.test(slug)) &&
      BETA.promo.after === 1 &&
      BETA_THEN_CLIFF.promo.after === 1 &&
      RUNWAY.promo.after === 1,
    "three months of offer, then the list price, in every plan that ships",
  );

  /*
   * 🔴 EVERYBODY DRAWS THE SAME $500, AND EXACTLY ONE PERSON DRAWS NOTHING.
   *
   * ⚠️ This asserted seven people all at $500 and went red when the selling
   * founder was added. The property is not the headcount, which will move: it is
   * that there is one pay rate in this company, and that the only $0 line belongs
   * to somebody whose salary is already on the payroll under another name. A
   * second $0 role would be an unpaid worker the plan is quietly relying on.
   */
  const unpaid = BETA.people.filter((p) => p.monthlyUsd === 0);
  check(
    "🔴 the beta is three months on twenty thousand dollars, and everybody paid is paid the same",
    BETA.months === 3 &&
      BETA.openingCashUsd === 20_000 &&
      BETA.people.filter((p) => p.monthlyUsd > 0).every((p) => p.monthlyUsd === 500) &&
      unpaid.length === 1 &&
      /founder/i.test(unpaid[0]!.role),
    `${BETA.people.length} people, ${BETA.people.length - unpaid.length} at $500 a month, $${BETA.openingCashUsd} in the bank`,
  );

  /*
   * 🔴 THE ACQUISITION TARGETS ARE WHAT THREE SELLERS CAN CARRY.
   *
   * ⚠️ This asserted the literal 3 / 6 / 9 and went red the moment the third
   * seller raised them. Restating the new literals would only move the same
   * defect forward a sprint. The property that makes any set of targets
   * defensible is the load per seller: a target nobody can physically hit is a
   * forecast, not a plan, and it is the first number to inflate when a model is
   * being made to close.
   */
  const targets = Object.fromEntries(
    BETA.segments.map((s) => [s.key, s.arrivals.slice(0, 3).reduce((a, b) => a + b, 0)]),
  );
  const sellers = BETA.people.filter((p) => /sales|selling/i.test(p.role)).length;
  const perSellerPerMonth =
    Object.values(targets).reduce((a, b) => a + b, 0) / sellers / BETA.months;

  check(
    "🔴 the acquisition targets are a load three sellers can actually carry",
    sellers === 3 && perSellerPerMonth <= 4,
    `${targets.company} companies · ${targets.clinic} clinics · ${targets.therapist} therapists in three months, which is ${perSellerPerMonth.toFixed(1)} accounts a month each across ${sellers} sellers`,
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
  /*
   * 🔴 THE CREDIT IS THE COMPANY OFFER AND NOBODY ELSE GETS ANY.
   *
   * ⚠️ This asserted the literal $200 and went red when it was halved to $100.
   * The amount is a commercial decision that will move again; what must not move
   * is WHO gets it. A therapist or a clinic with welcome credit would be a
   * discount wearing a pot's clothes, and it would land in the ledger as cash
   * out rather than as revenue foregone.
   */
  check(
    "🔴 the welcome credit goes to companies and to nobody else",
    company.welcomeCreditUsd > 0 &&
      BETA.segments.filter((s) => s.key !== "company").every((s) => s.welcomeCreditUsd === 0),
    `$${company.welcomeCreditUsd} to a company, $0 to everyone else`,
  );

  /*
   * 🔴 AND A CLINIC IS TWO OR THREE CLINICIANS, NEVER FOUR.
   *
   * A small Cairo practice is two people who share a waiting room, sometimes
   * three. Four is a different kind of business with a manager and a lease, and
   * modelling it inflates both seat revenue and session volume per account.
   */
  const clinicSeg = BETA.segments.find((s) => s.key === "clinic")!;
  check(
    "🔴 a clinic is two or three clinicians, never four",
    clinicSeg.cliniciansEach >= 2 && clinicSeg.cliniciansEach <= 3,
    `${clinicSeg.cliniciansEach} on average, which is the midpoint of two and three`,
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

  /*
   * 🔴 THE MARKETER'S SALARY IS NOT ACQUISITION COST, AND THE CHECK SAYS SO.
   *
   * CAC counts the people who SELL and the money that MARKETS. A marketer's pay
   * is an operating cost; the budget they spend is the acquisition cost. Folding
   * the two together doubles a CAC figure and nobody can say why. Proved by
   * raising the marketer's pay and watching CAC not move.
   */
  const richerMarketer = runPlan({
    ...BETA,
    people: BETA.people.map((p) => (/marketing/i.test(p.role) ? { ...p, monthlyUsd: 5000 } : p)),
  });
  check(
    "🔴 a marketer's salary is an operating cost, not acquisition cost",
    Math.abs(richerMarketer.blendedCacUsd - runPlan(BETA).blendedCacUsd) < 0.01 &&
      richerMarketer.months[0]!.peopleUsd > runPlan(BETA).months[0]!.peopleUsd,
    "paying the marketer ten times more moves the payroll and leaves CAC exactly where it was",
  );

  /*
   * 🔴 73.4 — THE RAIL FORCES TWO SUPPORT STAFF, AND THE PLAN MUST CARRY THEM.
   *
   * A bank transfer is a person checking it, by the minute, or somebody sits on
   * a spinner waiting to join a therapy session. A plan that modelled the rail
   * without the people would describe a product nobody can operate.
   */
  check(
    "🔴 the payment rail's two support staff are on the payroll from month one",
    BETA.people.filter((p) => /support/i.test(p.role)).length === 2 &&
      BETA.people.filter((p) => /support/i.test(p.role)).every((p) => p.startMonth === 1),
    "the queue is worked from the first transfer, not from the first complaint",
  );

  /*
   * 🔴 THE PLAN HAS TO BE WORTH BUYING FOR THE THERAPIST THIS MODEL DESCRIBES.
   *
   * Pay as you go is $4 a session, so a plan at price P is worth buying above
   * `P / 4` sessions a month. That number must sit AT OR BELOW the caseload the
   * same file forecasts, or we are projecting subscription revenue from people
   * for whom the subscription is the worse deal and who would be right to
   * refuse it.
   *
   * ⚠️ This check used to assert the literal 25, and it passed for two sprints
   * while the model's own typical therapist did 20 sessions a month. It was
   * testing that somebody had typed $100, not that $100 was defensible. The
   * property is the comparison, and stating it this way is what caught it.
   */
  const therapist = BETA.segments.find((s) => s.key === "therapist")!;
  const paygSession =
    BETA.unit.platformFeeUsd + BETA.unit.aiFeeUsd; /* $1 room + $3 note. */
  const worthBuyingAbove = therapist.monthlyUsd / paygSession;
  const typicalCaseload = therapist.patientsPerClinician * therapist.sessionsPerPatient;

  check(
    "🔴 the plan is worth buying at or below the caseload this model forecasts",
    Number.isInteger(worthBuyingAbove) && worthBuyingAbove <= typicalCaseload,
    `$${therapist.monthlyUsd} is ${worthBuyingAbove} sessions at $${paygSession}, against a typical ${typicalCaseload} a month`,
  );

  /*
   * 🔴 AND IT MUST NOT BE CHEAP ENOUGH TO LOSE MONEY ON A BUSY THERAPIST.
   *
   * A flat plan stops paying for itself past `price / marginal cost` sessions.
   * A 50-minute session costs us the measured model time plus video, about
   * $0.62. A therapist doing six sessions a day, five days a week, reaches
   * roughly 120 a month, and that is a heavy full-time load.
   *
   * So the ceiling has to be **above** what one clinician can physically do, or
   * the plan loses money on exactly our best customers. At $60 it is 97, which
   * is reachable. That is why the plan is not $60.
   */
  const marginalCostUsd =
    BETA.unit.aiFixedUsd +
    BETA.unit.aiPerMinuteUsd * BETA.unit.sessionMinutes +
    BETA.unit.sessionMinutes * 2 * BETA.unit.videoPerParticipantMinuteUsd;
  const losesMoneyPast = therapist.monthlyUsd / marginalCostUsd;

  check(
    "🔴 …and not so cheap that one busy clinician can outrun it",
    losesMoneyPast > 120,
    `unprofitable past ${losesMoneyPast.toFixed(0)} sessions a month, against about 120 for a heavy full-time load`,
  );

  /*
   * 🔴 AND THE PROMISE IS TRUE **NET**, which is what their screen shows.
   *
   * ⚠️ This asserted the GROSS figure and said "ten sessions earns $200 against
   * a $100 bill". Their earnings screen shows what is left after our 15%, which
   * is $170, not $200. A promise stated in a number the customer cannot find on
   * any screen is a promise that gets quoted back at us.
   */
  const netPerSession = BETA.unit.sessionPriceUsd * (1 - BETA.unit.takeRate);
  check(
    "🔴 a typical month's earnings cover the subscription, after our cut",
    typicalCaseload * netPerSession > therapist.monthlyUsd,
    `${typicalCaseload} sessions nets them $${(typicalCaseload * netPerSession).toFixed(0)} after our cut, against a $${therapist.monthlyUsd} bill`,
  );

  /*
   * 🔴 THE CLINIC SEAT IS THE SOLO PRICE LESS TEN PER CENT, which is a RULE
   * rather than a second number. Change the solo plan and this follows, and a
   * clinic can never cost more per head than two solo practices.
   */
  const clinic = BETA.segments.find((s) => s.key === "clinic")!;
  const perSeat = clinic.monthlyUsd / clinic.cliniciansEach;
  check(
    "🔴 a clinic seat is ten per cent under the solo plan, never over it",
    Math.abs(perSeat - therapist.monthlyUsd * 0.9) < 0.01,
    `$${perSeat.toFixed(0)} a seat against $${therapist.monthlyUsd} solo`,
  );

  /*
   * 🔴 THE OFFER ENDS WITH THE BETA. Months 4 on get one free month and no
   * half-price months, and the two cohorts must be kept apart.
   */
  check(
    "🔴 a post-beta joiner gets one free month and then full price",
    BETA.promo.afterBeta.schedule.length === 1 &&
      BETA.promo.afterBeta.schedule[0] === 0 &&
      BETA.promo.afterBeta.after === 1,
    "the beta bought evidence once; it does not need buying again",
  );

  const runway = runPlan(RUNWAY);
  check(
    "🔴 the angel cheque alone reaches break even, and the cash never goes negative",
    runway.breakEvenMonth !== null && runway.runsOutInMonth === null,
    `break even month ${runway.breakEvenMonth}, low point ${Math.min(...runway.months.map((m) => m.cashUsd)).toFixed(0)} dollars`,
  );

  /* ================================================================== */
  /*  The target the whole six months is aimed at                        */
  /* ================================================================== */

  /*
   * 🔴 BREAK EVEN BEFORE MONTH 6, AND IT IS A TARGET RATHER THAN AN OUTPUT.
   *
   * The six-month scenario exists to answer one question: does the company pay
   * for itself before the money runs out. `BETA_THEN_CLIFF` runs the beta offer
   * out to month 6 and is the scenario the simulation walks, so the target lives
   * on it.
   *
   * What makes it reachable is the third seller: one founder sells full time
   * from month one, which costs nothing on the payroll and raises arrivals on
   * every segment by half. Take that seller out and this check goes red, which
   * is the property worth holding — it is the assumption doing the work, and
   * nothing else in the file would say so out loud.
   */
  const six = runPlan(BETA_THEN_CLIFF);
  check(
    "🔴 the six months break even before month 6, which is what the third seller buys",
    six.breakEvenMonth !== null && six.breakEvenMonth < 6,
    `first profitable month ${six.breakEvenMonth}, ending with $${six.months.at(-1)!.cashUsd.toFixed(0)} in the bank`,
  );

  /*
   * 🔴 CONTROL, and it is the honest one: take the founder off the sales bench
   * and the target is missed. If this did not move, the third seller would be
   * decoration and the break-even above would be coming from somewhere else.
   */
  const twoSellers = runPlan({
    ...BETA_THEN_CLIFF,
    segments: BETA_THEN_CLIFF.segments.map((s) => ({
      ...s,
      arrivals: s.arrivals.map((n) => n / 1.5),
      steadyPerMonth: s.steadyPerMonth / 1.5,
    })),
  });
  check(
    "🔴 CONTROL …and with two sellers instead of three it is missed",
    twoSellers.breakEvenMonth === null || twoSellers.breakEvenMonth >= 6,
    `two sellers reach break even in month ${twoSellers.breakEvenMonth ?? "never, inside six"}`,
  );

  /*
   * 🔴 AND THE FOUNDER WHO SELLS IS ON THE PAYROLL ONCE, NOT TWICE. They draw
   * their $500 as a founder; the sales line beside their name is $0. A model
   * that paid them again would be quietly buying the growth it reports.
   */
  const sellingFounder = BETA_THEN_CLIFF.people.find((p) => /founder.*sell/i.test(p.role));
  check(
    "🔴 the selling founder costs nothing extra, because they are already paid",
    sellingFounder !== undefined && sellingFounder.monthlyUsd === 0,
    "one salary, two jobs, and the second job is the reason the plan closes",
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
