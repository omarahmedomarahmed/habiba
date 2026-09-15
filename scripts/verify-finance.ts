/**
 * Sprint 71 acceptance: the financial model.
 *
 *   npm run verify:finance
 *
 * ## 🔴 The property that matters most is a NEGATIVE one
 *
 * A forecast input must be structurally incapable of charging anybody. That is
 * not a promise to be careful, it is a fact about the import graph, and this is
 * where it is asserted: nothing under `lib/finance/` may reach a module that
 * writes money, and `model.ts` may not reach a database at all.
 *
 * Everything else here is about the same fear in a different costume: a
 * forecast is the easiest thing in a codebase to be confidently wrong about,
 * because nothing it says can be falsified until eighteen months later.
 */
import { readdirSync } from "node:fs";

import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

/** Every module the forecast is made of. */
function financeFiles(): string[] {
  return readdirSync("lib/finance")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `lib/finance/${f}`);
}

async function main() {
  const files = financeFiles();

  check(
    "the module exists and has the pieces the design names",
    files.length >= 5,
    files.map((f) => f.replace("lib/finance/", "")).join(", "),
  );

  /* ================================================================== */
  /*  It cannot charge anybody                                           */
  /* ================================================================== */

  /**
   * Modules that write money or price the product. A forecast reaching one of
   * these is the failure this whole separation exists to prevent.
   */
  const FORBIDDEN = [
    "lib/billing/",
    "lib/ledger",
    "@/lib/settings/write",
    "invoices",
    "sessionPayments",
    "sponsorPots",
    "subscriptions",
  ];

  const offences: string[] = [];
  for (const file of files) {
    const src = readSource(file);
    for (const bad of FORBIDDEN) {
      /* Imports only. A word in a sentence is not a dependency. */
      const importLines = src
        .split("\n")
        .filter((l) => /^\s*import\b/.test(l) || /from\s+["']/.test(l));
      if (importLines.some((l) => l.includes(bad))) offences.push(`${file} imports ${bad}`);
    }
  }

  check(
    "🔴 C360 nothing in lib/finance can import a module that writes money",
    offences.length === 0,
    offences.join(" · ") || `${files.length} modules, none of them reach billing`,
  );

  check(
    "🔴 CONTROL the same scan catches an import it should refuse",
    ['import { invoices } from "@/lib/db/schema";']
      .filter((l) => /from\s+["']/.test(l))
      .some((l) => l.includes("invoices")),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  /* ================================================================== */
  /*  The engine is pure                                                 */
  /* ================================================================== */

  const model = readSource("lib/finance/model.ts");

  check(
    "🔴 the engine has no clock, so the same assumptions give the same answer forever",
    !/new Date\(|Date\.now\(/.test(model),
    "a forecast that moves when you read it cannot be defended three months later",
  );

  check(
    "🔴 …no database",
    !/from "@\/lib\/db"|drizzle-orm/.test(model),
    "pure, so it can be tested without one and cannot be slow",
  );

  check(
    "🔴 …no network and no randomness",
    !/fetch\(|Math\.random\(/.test(model),
    "three ways a number stops being reproducible, all absent",
  );

  check(
    "🔴 CONTROL the purity scan catches each of the three",
    /new Date\(/.test("const now = new Date();") &&
      /Math\.random\(/.test("const x = Math.random();") &&
      /fetch\(/.test("await fetch(url);"),
    "watched catching all three shapes",
  );

  /* ================================================================== */
  /*  The arithmetic                                                     */
  /* ================================================================== */

  const { forecast } = await import("../lib/finance/model");
  const { BASE, BENCHMARK, FUNDED, REAL_SESSIONS, SCENARIOS } = await import(
    "../lib/finance/scenarios"
  );

  /*
   * ⚠️ This asserted `BENCHMARK.months === 3` and went red when the simulation
   * became six months long. It was testing that somebody had typed a 3, not that
   * the first scenario is a calibration.
   *
   * What makes it a calibration is that **it has no payroll**. It models a run,
   * not a company: no salaries, no office, no round, and a horizon shorter than
   * the forecasts it exists to be compared against. State it that way and the
   * next change to the simulation's length does not touch this file.
   */
  check(
    "four scenarios ship, and the first is a calibration rather than a forecast",
    SCENARIOS.length === 4 &&
      BENCHMARK.people.length === 0 &&
      BENCHMARK.money.fundingUsd.value === 0 &&
      BENCHMARK.months < BASE.months,
    `${SCENARIOS.map((s) => s.name.split(":")[0]).join(", ")} · the benchmark runs ${BENCHMARK.months} months with nobody on the payroll`,
  );

  /*
   * 🔴 THE CHECK THAT EXISTS BECAUSE THE TWO MODELS ONCE DISAGREED IN PUBLIC.
   *
   * `plans.ts` is the operating plan and this file is the abstract growth model.
   * They may differ in structure. They may not differ about what a session
   * costs a patient, because both put that figure on a screen a founder reads
   * and for two sprints one said $40 while the other said $20. Nothing on either
   * screen said why, and the runway figures they produced differed threefold.
   */
  const { BETA, EGP_PER_USD } = await import("../lib/finance/plans");
  check(
    "🔴 the forecast and the operating plan agree about the price of a session",
    Math.abs(BASE.unit.sessionPriceUsd.value - BETA.unit.sessionPriceUsd) < 0.005 &&
      Math.abs(BASE.unit.sessionPriceUsd.value * EGP_PER_USD - 1000) < 0.5,
    `$${BASE.unit.sessionPriceUsd.value} here and $${BETA.unit.sessionPriceUsd} there, both 1,000 EGP at ${EGP_PER_USD} to the dollar`,
  );

  check(
    "🔴 …and about the two metered fees and the cut, which come from settings either way",
    BASE.unit.platformFeeCents.value / 100 === BETA.unit.platformFeeUsd &&
      BASE.unit.aiFeeUsdPerSession.value === BETA.unit.aiFeeUsd &&
      BASE.unit.platformFeeBps.value / 10000 === BETA.unit.takeRate,
    `$${BETA.unit.platformFeeUsd} room, $${BETA.unit.aiFeeUsd} note, ${BETA.unit.takeRate * 100}% cut`,
  );

  /*
   * 🔴 AND THEY MUST APPLY THEM TO THE SAME PEOPLE, WHICH THE CHECK ABOVE
   * CANNOT SEE.
   *
   * The three constants above were equal on both sides for two sprints while
   * the two engines did completely different things with them. `model.ts`
   * folded the cut and the room fee into one number and charged the sum on paid
   * sessions only, which billed the room fee to subscribers, billed it on no
   * free session when it should bill on all of them, and took 15% from people
   * who had not paid. `beta.ts` had been corrected; nothing compared them.
   *
   * Same constants, different populations, and a green gate. So this asserts
   * the BEHAVIOUR: move the subscriber share and watch the metered fee line
   * move the opposite way, which is only true if the engine knows that a
   * subscriber pays neither per-session charge.
   */
  const allMetered = forecast({
    ...BASE,
    pricing: { ...BASE.pricing, payingShare: { ...BASE.pricing.payingShare, value: 0 } },
  });
  const allSubscribed = forecast({
    ...BASE,
    pricing: { ...BASE.pricing, payingShare: { ...BASE.pricing.payingShare, value: 1 } },
  });

  const meteredM12 = allMetered.months[11]!;
  const subscribedM12 = allSubscribed.months[11]!;

  check(
    "🔴 a subscriber pays NEITHER per-session charge, and the engine knows it",
    subscribedM12.aiFeeUsd === 0 && meteredM12.aiFeeUsd > 0,
    `with everybody metered the note fee is $${meteredM12.aiFeeUsd.toFixed(0)} a month; with everybody subscribed it is $0, which is the whole of what a plan buys`,
  );

  check(
    "🔴 …and the room fee rides on the SESSION, so it is billed on free ones too",
    meteredM12.sessionFeeUsd > 0 && subscribedM12.sessionFeeUsd > 0,
    "a subscriber still generates our 15% on what the patient paid, so the line is never zero",
  );

  /*
   * 🔴 CONTROL, and it is the one that separates the two charges. With NOBODY
   * paying for a session, a metered account still owes the room fee on every
   * session it ran, and a subscribed one owes nothing per session at all.
   */
  const nobodyPays = (share: number) =>
    forecast({
      ...BASE,
      pricing: { ...BASE.pricing, payingShare: { ...BASE.pricing.payingShare, value: share } },
      unit: { ...BASE.unit, sessionPriceUsd: { ...BASE.unit.sessionPriceUsd, value: 0 } },
    }).months[11]!.sessionFeeUsd;

  check(
    "🔴 CONTROL with nothing paid, metered still owes the room and a subscriber owes nothing",
    nobodyPays(0) > 0 && Math.abs(nobodyPays(1)) < 0.01,
    `$${nobodyPays(0).toFixed(0)} of room fees against $0. The cut is on what was paid; the room is on the session existing`,
  );

  /*
   * 🔴 AND ABOUT THE PAYROLL, which was the other half of the disagreement.
   *
   * This file used to put two founders on $4,000 plus burden and nobody else,
   * and reported that the company runs out of cash in month 3 and needs
   * $58,927. The plan put eight people on $3,500 in total and reported break
   * even in month 5 on the same $20,000. Both were on the same screen.
   */
  const basePayroll = BASE.people.reduce((sum, p) => sum + p.monthlyUsd * (1 + p.burden), 0);
  const planPayroll = BETA.people.reduce((sum, p) => sum + p.monthlyUsd, 0);
  check(
    "🔴 …and about what the team is paid, which is where the threefold disagreement was",
    Math.abs(basePayroll - planPayroll) < 0.5 && BASE.people.length === BETA.people.length,
    `$${basePayroll.toFixed(0)} a month across ${BASE.people.length} people, the same roles on both sides`,
  );

  /*
   * 🔴 AND THE ONE PERSON WHO IS PAID NOTHING IS A FOUNDER WHO IS ALREADY PAID.
   *
   * A second unpaid role in either model would be an unpaid worker the forecast
   * is quietly relying on, which is the cheapest way to make a plan close.
   */
  const unpaid = BASE.people.filter((p) => p.monthlyUsd === 0);
  check(
    "🔴 …and exactly one role costs nothing, because that salary is on another line",
    unpaid.length === 1 && /founder/i.test(unpaid[0]!.role),
    "one founder sells full time. It is the decision the plan turns on, and it is free only because they already draw $500",
  );

  check(
    "🔴 the horizon is thirty-six months, which is what was asked for",
    BASE.months === 36 && FUNDED.months === 36,
    `base ${BASE.months}, funded ${FUNDED.months}`,
  );

  const base = forecast(BASE);

  check(
    "every month is present and numbered from one",
    base.months.length === 36 && base.months[0]!.month === 1 && base.months[35]!.month === 36,
    `${base.months.length} months`,
  );

  /* 🔴 The books have to close, month by month, or the chart is decoration. */
  const broken = base.months.filter(
    (m) =>
      Math.abs(m.revenueUsd - (m.subscriptionUsd + m.sessionFeeUsd + m.aiFeeUsd)) > 0.05 ||
      Math.abs(
        m.grossProfitUsd - (m.revenueUsd - m.aiCostUsd - m.videoCostUsd - m.paymentCostUsd),
      ) > 0.05 ||
      Math.abs(m.netUsd - (m.grossProfitUsd - m.operatingCostUsd)) > 0.05,
  );

  check(
    "🔴 every month reconciles: revenue is its parts, and net is gross minus overhead",
    broken.length === 0,
    broken.length === 0 ? "36 months, all closing" : `months ${broken.map((m) => m.month).join(", ")}`,
  );

  /*
   * And the cash is the running sum, which is a different claim from the above.
   *
   * ⚠️ THE TOLERANCE HAS TO GROW WITH THE MONTH, and the first version's flat
   * five cents was passing by luck. `model.ts` carries cash unrounded and
   * publishes both `netUsd` and `cashUsd` rounded to the cent, so a check that
   * re-adds the PUBLISHED nets accumulates up to half a cent a month. At
   * thirty-six months that is eighteen cents, which is over any flat five-cent
   * line, and it went red the first time a scenario's rounding stopped
   * cancelling.
   *
   * Half a cent a month is the exact size of the rounding and nothing else, so
   * this still catches a real error: a real one is dollars, not cents.
   */
  let cash = BASE.money.openingCashUsd.value;
  const cashBroken: number[] = [];
  for (const m of base.months) {
    if (m.month === BASE.money.fundingMonth.value) cash += BASE.money.fundingUsd.value;
    cash += m.netUsd;
    if (Math.abs(cash - m.cashUsd) > 0.005 * m.month + 0.01) cashBroken.push(m.month);
  }

  check(
    "🔴 …and the cash line is the running sum of the net line plus the round",
    cashBroken.length === 0,
    cashBroken.length === 0
      ? "opening cash carried through 36 months, within the half a cent a month that rounding to the cent costs"
      : `months ${cashBroken.join(", ")}`,
  );

  /*
   * 🔴 CONTROL, because the tolerance above was just widened. A cash line that
   * drops a month's net entirely must still be caught, or the loosening turned
   * the check off.
   */
  let dropped = BASE.money.openingCashUsd.value;
  const droppedBroken: number[] = [];
  for (const m of base.months) {
    if (m.month !== 5) dropped += m.netUsd;
    if (Math.abs(dropped - m.cashUsd) > 0.005 * m.month + 0.01) droppedBroken.push(m.month);
  }
  check(
    "🔴 CONTROL the same scan catches a cash line that skipped one month's net",
    droppedBroken.length > 0,
    `${droppedBroken.length} months flagged when month 5 is dropped. A cent of tolerance does not hide a month`,
  );

  /* ================================================================== */
  /*  The things it must not do                                          */
  /* ================================================================== */

  const twice = forecast(BASE);
  check(
    "🔴 it is deterministic: the same assumptions twice give the same answer",
    JSON.stringify(twice) === JSON.stringify(base),
    "a forecast that differs between two readings of the same inputs is not one",
  );

  /*
   * 🔴 Growth must follow the money, not precede it. The first draft of the
   * funded scenario applied its post-round growth rate from month two and broke
   * even in month four, which is four months before the round that paid for the
   * salesperson who was meant to cause it.
   */
  const funded = forecast(FUNDED);
  const beforeRound = funded.months.slice(0, FUNDED.money.fundingMonth.value - 1);
  const afterRound = funded.months.slice(FUNDED.money.fundingMonth.value);
  const growthBefore =
    beforeRound.length > 1
      ? beforeRound[beforeRound.length - 1]!.therapists - beforeRound[0]!.therapists
      : 0;
  const growthAfter =
    afterRound.length > 1 ? afterRound[afterRound.length - 1]!.therapists - afterRound[0]!.therapists : 0;

  check(
    "🔴 C361 growth follows the money rather than preceding it",
    growthAfter / Math.max(1, afterRound.length) > growthBefore / Math.max(1, beforeRound.length),
    `${(growthBefore / Math.max(1, beforeRound.length)).toFixed(1)} a month before the round, ${(growthAfter / Math.max(1, afterRound.length)).toFixed(1)} after`,
  );

  /*
   * 🔴 The free first session costs money and the model must carry it. Turning
   * it off has to make the forecast BETTER, or the line is decorative.
   */
  const noFree = forecast({
    ...BASE,
    market: { ...BASE.market, freeSessionsPerNewTherapist: { ...BASE.market.freeSessionsPerNewTherapist, value: 0 } },
  });

  check(
    "🔴 the free first session is a real cost, not a comment",
    noFree.totals.revenueUsd > base.totals.revenueUsd,
    `giving it away costs ${(noFree.totals.revenueUsd - base.totals.revenueUsd).toFixed(0)} dollars over 36 months`,
  );

  /*
   * 🔴 AI is charged on EVERY session, not only the paid ones. The free session
   * still transcribes. If the model only charged paid sessions, removing the
   * free one would not change the AI cost at all.
   */
  check(
    "🔴 …and the model still pays for the AI on the session it gave away",
    Math.abs(noFree.totals.aiCostUsd - base.totals.aiCostUsd) < 0.05,
    "the same sessions run either way; only the revenue differs",
  );

  /*
   * 🔴 C363 THE LOW POINT IS THE WHOLE CURVE, NOT THE FIRST CROSSING.
   *
   * "Runs out in month three" and "needs thirty-five thousand dollars" are
   * different facts, and a model that reports only the first lets somebody plan
   * against a tenth of the real number.
   *
   * ⚠️ This used to run against `BASE`, and it went red the day BASE stopped
   * going negative. That was good news being reported as a failure: putting the
   * founders on the salary they actually take made the base case solvent, and
   * the check had quietly depended on it not being.
   *
   * A property about what happens when cash DOES go negative needs a scenario
   * where it does, so this makes one rather than hoping the shipped plan stays
   * broke. Thinner opening cash, everything else identical.
   */
  const thin = forecast({
    ...BASE,
    money: { ...BASE.money, openingCashUsd: { ...BASE.money.openingCashUsd, value: 2_000 } },
  });
  const lowest = Math.min(...thin.months.map((m) => m.cashUsd));
  check(
    "🔴 C363 the deficit is the deepest point on the curve, not the first month below zero",
    lowest < 0 &&
      Math.abs(thin.deepestDeficitUsd - -lowest) < 0.02 &&
      thin.deepestDeficitMonth !== thin.runsOutInMonth,
    `on $2,000 of opening cash: crosses zero m${thin.runsOutInMonth}, bottoms out m${thin.deepestDeficitMonth} at ${thin.deepestDeficitUsd.toFixed(0)} dollars down. Planning against the first number raises a fraction of what is needed`,
  );

  /*
   * 🔴 THE FINDING THIS SCENARIO ACTUALLY PRODUCES, AND IT CHANGED THE MOMENT
   * THE FEE ARITHMETIC WAS CORRECTED.
   *
   * Growing on SOLO THERAPISTS ALONE does not pay for this payroll. At four a
   * month against $3,500 of salaries, the base case dips below zero before it
   * recovers, even though the operating plan breaks even in month 5 on the same
   * money and the same prices.
   *
   * The difference is the segments. `plans.ts` sells to companies and clinics as
   * well, and a clinic is two or three clinicians on one sale. This engine has
   * one growth lever and it is therapists, so what it says is worth saying
   * plainly: **the solo-only path does not close, and the company and clinic
   * segments are not an upside on the plan, they are the plan.**
   *
   * ⚠️ An earlier version of this check asserted the base case was solvent. It
   * was, on arithmetic that billed the room fee to subscribers and took 15%
   * from people who had not paid. Correcting that removed revenue that was
   * never there, and a check written against the flattering number would have
   * been the thing arguing to keep it.
   */
  check(
    "🔴 the solo-only growth path does NOT pay for this payroll, and the model says so",
    base.deepestDeficitUsd > 0 && base.breakEvenMonth !== null,
    `low point $${base.deepestDeficitUsd.toFixed(0)} down in m${base.deepestDeficitMonth}, break even m${base.breakEvenMonth}. The operating plan reaches it in m5 because it sells to companies and clinics too`,
  );

  /*
   * 🔴 CONTROL. A scenario that never goes negative must report zero rather
   * than the smallest positive balance, or the field is measuring "lowest cash"
   * and calling it a deficit.
   */
  const solvent = forecast({
    ...BASE,
    money: { ...BASE.money, openingCashUsd: { ...BASE.money.openingCashUsd, value: 500_000 } },
  });
  check(
    "🔴 CONTROL a scenario that stays solvent reports no deficit at all",
    solvent.deepestDeficitUsd === 0 && solvent.deepestDeficitMonth === null,
    "zero, not the smallest positive balance: the field is a shortfall and not a minimum",
  );

  /* ================================================================== */
  /*  What it is honest about                                            */
  /* ================================================================== */

  const { inputsOf, provenanceSplit } = await import("../lib/finance/assumptions");

  const split = provenanceSplit(BASE);
  check(
    "every input carries a provenance, and the split is countable",
    split.measured > 0 && split.assumed > 0,
    `${split.measured} measured, ${split.assumed} assumed`,
  );

  const unnoted = inputsOf(BASE).filter(({ input }) => !input.note || input.note.length < 10);
  check(
    "🔴 every input says WHY it is what it is, in a sentence",
    unnoted.length === 0,
    unnoted.length === 0
      ? `${inputsOf(BASE).length} inputs, all annotated`
      : unnoted.map((u) => u.path).join(", "),
  );

  const measuredWithoutDate = inputsOf(BASE).filter(
    ({ input }) => input.from === "measured" && (!input.measuredOn || !input.samples),
  );
  check(
    "🔴 …and a measured one carries the date and the sample size",
    measuredWithoutDate.length === 0,
    measuredWithoutDate.length === 0
      ? "measured on thirty-five sessions and measured on thirty-five thousand are different claims"
      : measuredWithoutDate.map((m) => m.path).join(", "),
  );

  /*
   * 🔴 Churn, acquisition and payment fees may NEVER be marked measured, because
   * nothing in this product can measure them. If one ever is, somebody has
   * mistaken a guess for a finding, which is the exact failure the provenance
   * system exists to catch.
   */
  const mustBeAssumed = ["market.therapistChurnMonthly", "unit.paymentPercent", "unit.paymentFixedUsd"];
  const wronglyMeasured = inputsOf(BASE).filter(
    ({ path, input }) => mustBeAssumed.includes(path) && input.from === "measured",
  );

  check(
    "🔴 C362 churn and payment fees are never marked measured, because nothing here can measure them",
    wronglyMeasured.length === 0,
    wronglyMeasured.length === 0
      ? "Stripe runs in test mode and charges nothing; three months cannot establish churn"
      : wronglyMeasured.map((w) => w.path).join(", "),
  );

  /* ================================================================== */
  /*  The bridge, and the flag                                           */
  /* ================================================================== */

  const bench = forecast(BENCHMARK);
  const real = forecast(REAL_SESSIONS);

  check(
    "🔴 the two-term bridge: fifty-minute sessions cost more than three-minute ones, and not 16x more",
    real.totals.aiCostUsd > bench.totals.aiCostUsd &&
      real.totals.aiCostUsd < bench.totals.aiCostUsd * 16,
    `$${bench.totals.aiCostUsd.toFixed(2)} at three minutes, $${real.totals.aiCostUsd.toFixed(2)} at fifty, a factor of ${(real.totals.aiCostUsd / Math.max(0.01, bench.totals.aiCostUsd)).toFixed(1)} rather than 16.7`,
  );

  const fullyBooked =
    66 * (BASE.unit.aiFixedUsdPerSession.value + BASE.unit.aiPerMinuteUsd.value * 50);

  check(
    "🔴 the $70 flag is several times what a fully booked therapist can spend",
    BASE.flags.aiPerTherapistMonthlyUsd.value / fullyBooked > 3,
    `a fully booked therapist costs $${fullyBooked.toFixed(2)} a month, so the flag sits ${(BASE.flags.aiPerTherapistMonthlyUsd.value / fullyBooked).toFixed(1)}x above it. An anomaly detector, not a cost control`,
  );

  /* ================================================================== */
  /*  It is on a screen, and the right one                               */
  /* ================================================================== */

  const page = readSource("app/(admin)/admin/financial-model/page.tsx");

  check(
    "🔴 the page is super_admin only, not staff",
    /requireRole\("super_admin"\)/.test(page) && !/requireStaff/.test(page),
    "salaries and runway are not a queue the rota works",
  );

  const nav = readSource("app/(admin)/layout.tsx");
  check(
    "🔴 …and it is LINKED, not reachable only by typing the URL",
    /\/admin\/financial-model/.test(nav),
    "verify:reachable's whole point: a page nobody can reach is a built feature nobody uses",
  );

  check(
    "🔴 the screen names what it cannot know, before it shows a forecast",
    /couldNotMeasure/.test(page) && /provenanceSplit/.test(page),
    "a reader who sees the chart first has already formed a view",
  );

  /*
   * 🔴 The screen has to SAY the size of the shortfall, not only hold it. A
   * field on a projection nobody renders is a field that does not exist.
   */
  const screen = readSource("components/admin/financial-model.tsx");
  check(
    "🔴 …and it shows how much the plan is short by, not only the month it notices",
    /deepestDeficitUsd/.test(screen) && /deepestDeficitMonth/.test(screen),
    "a reader who is told only the month plans against the wrong number",
  );

  /* ================================================================== */
  /*  What the screen can do to the database, and what it cannot         */
  /* ================================================================== */

  const actions = readSource("app/(admin)/admin/financial-model/actions.ts");

  const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]!);

  /*
   * 🔴 TWO ACTIONS, AND A THIRD WOULD BE THE FAILURE.
   *
   * This is the write surface of a screen whose whole argument is that it cannot
   * charge anybody. Counting the exports is how that argument stays true after
   * somebody adds a convenience next spring: a new action here fails this check
   * and has to be justified rather than merged.
   */
  check(
    "🔴 the screen can do exactly two things to the database, and both are audited",
    exported.length === 2 &&
      exported.every((fn) => {
        const body = actions.slice(actions.indexOf(`function ${fn}`));
        return /requireRole\("super_admin"\)/.test(body.slice(0, 600)) && /await audit\(/.test(body.slice(0, 2500));
      }),
    `${exported.join(", ")}. A third write on this screen is a price waiting to move`,
  );

  check(
    "🔴 …and neither of them can reach a table that decides what somebody is charged",
    !/invoices|session_payments|platformSettings|platform_settings|stripe/i.test(actions),
    "saving a forecast writes one row to finance_scenarios; measuring writes one to finance_benchmarks",
  );

  finish("sprint 71");
}

main();
