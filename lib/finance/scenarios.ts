/**
 * The four shipped scenarios, and what separates them.
 *
 * ## 🔴 THIS FILE AND `plans.ts` MUST AGREE ABOUT EVERY DECISION
 *
 * There are two models in this repository and they answer different questions.
 * `plans.ts` is the **operating plan**: Egypt, the $20,000, the offer, the
 * people actually being hired, and a cohort priced off its own age. This file is
 * the **abstract growth model**: pick a growth rate in clinicians and see what
 * falls out over three years.
 *
 * Different questions are fine. **Different prices are not.** For two sprints
 * this file modelled a $40 session and founders on $4,000 while the plan
 * modelled $20 and $500, and the two reported runway figures that differed by a
 * factor of three with nothing on either screen saying why. A reader comparing
 * them would have concluded one of them was broken, and they would have been
 * right.
 *
 * So every DECISION below is the same decision `plans.ts` makes, and the note on
 * each one says so by name. What is allowed to differ is structure: how growth
 * arrives, what a cohort is, how long the horizon runs. If a price here stops
 * matching the plan, that is a defect rather than a scenario.
 *
 * ## 🔴 Scenario one is not a forecast
 *
 * `benchmark` is the six-month simulation: 62 sessions in two duration clusters,
 * twenty-one people. It exists to be **compared against reality**, which is the
 * only way the other three earn any credibility. Read it as a calibration.
 *
 * ⚠️ And read it as the simulation's **design**, not its result, until the run
 * has happened. Every input in it is `assumed` on purpose: an earlier version
 * marked the cast size and session count `measured` with a date on them, which
 * described a run nobody had done. **Measure and freeze** on
 * `/admin/financial-model` is what replaces them with counts, and the provenance
 * bar at the top of that page is how a reader tells which state it is in.
 *
 * Everything after it is a forecast, and every forecast is only as good as the
 * measured half of its inputs. The `from` tag on each one says which half it is
 * in, and `/admin/financial-model` prints the split at the top rather than
 * letting a reader assume.
 *
 * ## The AI numbers below were measured, not estimated
 *
 * On 2026-09-14, against the live OpenAI API, using the product's own
 * `noteFromTranscript` and `classifyRisk` and a faithful reconstruction of the
 * in-session copilot, at four transcript lengths from three minutes to fifty.
 * $0.37 of API spend across three runs. `evals/physics.json` has every row.
 *
 * Four things it corrected, all of which had been estimates:
 *
 * | | Estimated | Measured |
 * |---|---|---|
 * | Note output tokens | 800, growing | **659, and it SHRINKS slightly with length** |
 * | Risk output tokens | 300 | **5.** A benign transcript returns `{"findings":[]}` |
 * | Copilot input | grew with the session | **629 tokens, FLAT.** It reads fourteen segments and no more |
 * | Diarisation | folded into the note | **its own call, 243 tokens a minute, batched at 120 lines** |
 *
 * The copilot one matters most for the shape: every earlier estimate had it
 * scaling with session length, and `CONTEXT_SEGMENTS = 14` means it never did.
 *
 * 🔴 The DIARISATION one matters most for the honesty of the number. The first
 * benchmark measured the note, the risk pass and the copilot and stopped, while
 * the documents claimed the figure covered diarisation too. It did not, and
 * diarisation is almost pure slope, so the call that was missing was the one
 * that grows with exactly the long sessions the business case rests on.
 */
import { assumed, measured, type Assumptions } from "./assumptions";

const MEASURED_ON = "2026-09-14";
/** Four durations x four kinds. Small, and every point is a real API call. */
const SAMPLES = 16;

/**
 * 🔴 The two-term cost model, measured.
 *
 * fixed  = $0.01317 a session
 * perMin = $0.00407 a minute
 *
 * Which gives $0.0254 at three minutes, $0.0457 at eight, $0.2167 at fifty, and
 * $0.4230 if you take the three-minute figure and multiply it by 50/3. That last
 * one is **95% too high** and is the number this whole decomposition exists to
 * stop anybody quoting.
 *
 * The line is exact on all three points, which is what a two-term model looks
 * like when the terms are the right two.
 */
export const AI_FIXED_USD = 0.01317;
export const AI_PER_MINUTE_USD = 0.00407;
/** The day the two above were measured against the live API. */
export const AI_MEASURED_ON = MEASURED_ON;

/** Shared across every scenario, because they are facts rather than choices. */
function unitEconomics(sessionMinutes: number) {
  return {
    sessionMinutes: assumed(sessionMinutes, "How long a session runs. The lever between scenarios"),
    aiFixedUsdPerSession: measured(
      AI_FIXED_USD,
      "Note prompt, note output, risk prompt, four copilot turns, diarisation overhead, profile share. Once per session whatever its length",
      MEASURED_ON,
      SAMPLES,
    ),
    aiPerMinuteUsd: measured(
      AI_PER_MINUTE_USD,
      "Transcription at $0.003 a minute, 198 tokens a minute into each of the note and risk prompts, and 243 a minute into the diarist",
      MEASURED_ON,
      SAMPLES,
    ),
    videoPerParticipantMinuteUsd: assumed(
      0.004,
      "Daily, per participant-minute. Two participants, so a session bills twice its length. NOT measured: the invoice is not in our database",
    ),
    platformFeeCents: measured(100, "platform_settings.session.platformFeeCents", MEASURED_ON, 1),
    platformFeeBps: measured(1500, "platform_settings.session.platformFeeBps", MEASURED_ON, 1),
    sessionPriceUsd: assumed(
      SESSION_PRICE_USD,
      "1,000 EGP at 50 to the dollar. 🔴 The same benchmark `plans.ts` runs on, and the most load-bearing guess in either model: at 500 EGP the plan runs out of cash",
    ),
    recordingConsentRate: assumed(
      0.7,
      "C209: the AI fee rides on the patient saying yes. The simulation measures this and the figure should be replaced by it. Same guess as `plans.ts`",
    ),
    aiFeeUsdPerSession: measured(3, "platform_settings.pricing payg aiRateCents", MEASURED_ON, 1),
    /*
     * 🔴 EGYPT, NOT STRIPE'S US CARD RATE, AND THE PLAN AGREES.
     *
     * This was 2.9% + 30c, which is Stripe's published US pricing and is what a
     * model reaches for by reflex. Nothing in this business is on it: Egypt has
     * no gateway for us, money arrives by bank transfer, and where a card is
     * eventually taken the local rails price differently again. 3% and a dime is
     * `plans.ts`'s pessimistic guess and this uses the same one.
     */
    paymentPercent: assumed(
      0.03,
      "🔴 Egyptian rails, not Stripe's US 2.9%. Pessimistic on purpose, and the same guess `plans.ts` makes. Test mode is charged nothing, so no run here can ever measure it",
    ),
    paymentFixedUsd: assumed(0.1, "Per charge, on the same Egyptian guess. Same caveat"),
  };
}

/**
 * 🔴 ONE PRICE, READ BY BOTH MODELS, SO THEY CANNOT DRIFT APART AGAIN.
 *
 * 1,000 EGP at 50 pounds to the dollar. `plans.ts` computes the same figure from
 * `EGP_PER_USD`, and `verify:finance` asserts the two are equal rather than
 * trusting anybody to remember.
 */
export const SESSION_PRICE_USD = 20;

const flags = {
  aiPerTherapistMonthlyUsd: assumed(
    70,
    "🔴 MEASURED: a fully booked therapist, 66 fifty-minute sessions a month, costs $14.31. So $70 is nearly FIVE times a therapist who cannot physically work harder. This is an anomaly detector, not a cost control: it fires for a clinic sharing one login, a runaway loop, or a bug",
  ),
};

/* ============================================================== scenario 1 == */

/**
 * 🔴 NOT A FORECAST. The simulation, as it ran, so the model can be checked
 * against something that actually happened.
 */
export const BENCHMARK: Assumptions = {
  name: "Benchmark: the six-month simulation",
  months: 6,
  unit: {
    ...unitEconomics(3),
    sessionMinutes: assumed(3, "42 of the 62 sessions. The other 20 run 8, which is the split the cost model is fitted from"),
    recordingConsentRate: assumed(1, "Every simulated patient consents, so this is not a measurement of consent"),
  },
  /*
   * 🔴 EVERY LINE HERE IS `assumed`, AND THAT IS THE CORRECTION.
   *
   * The previous version marked the cast size and the session count `measured`
   * with a date and a sample count on them. Nothing had been measured: those
   * were the numbers `01-THE-CAST.md` asks the run to PRODUCE. A design read
   * back as a measurement is the §6 defect in its purest form, and it was
   * sitting inside the module built to prevent it.
   *
   * They become measurements when somebody presses **Measure and freeze** on
   * `/admin/financial-model`, which writes one row to `finance_benchmarks` from
   * real rows and never updates it.
   */
  market: {
    startingTherapists: assumed(7, "T1 to T6 plus C1-A, the seven clinicians the cast asks for"),
    therapistsAddedPerMonth: assumed(0, "The cast is fixed: they arrive in waves, not at a rate"),
    therapistChurnMonthly: assumed(0, "One scripted cancellation in six months is one observation, and an observation is not a rate"),
    patientsPerTherapist: assumed(1, "7 patients across 7 clinicians. A simulation's ratio, not a market's"),
    sessionsPerPatientPerMonth: assumed(1.5, "62 sessions, 7 patients, 6 months"),
    freeSessionsPerNewTherapist: assumed(1, "The first completed session is free to the patient, per therapist"),
  },
  pricing: {
    blendedSubscriptionUsd: assumed(40, "Half of them subscribed and under the offer for most of the run"),
    payingShare: assumed(0.6, "Four of seven end the run on a plan; the rest are metered"),
  },
  people: [],
  costs: [],
  money: {
    openingCashUsd: assumed(0, "The simulation holds no cash: it measures unit cost, not a balance sheet"),
    fundingUsd: assumed(0, "Nothing is raised inside a three-month measurement run"),
    fundingMonth: assumed(99, "Past the horizon, which is how this model says never"),
    allocation: [],
  },
  flags,
};

/* ============================================================== scenario 2 == */

/**
 * 🔴 THE BRIDGE, AND THE REASON THE SIMULATION SPLIT ITS DURATIONS.
 *
 * The same business, the same cast, the same volumes, with **fifty-minute
 * sessions**. Nothing here is a growth assumption: it answers one question and
 * one only, *what would that quarter have looked like if the sessions had been
 * real?*
 *
 * It is derived from scenario one through the two-term model rather than by
 * multiplication, which is the whole argument in `physics.ts`.
 */
export const REAL_SESSIONS: Assumptions = {
  ...BENCHMARK,
  name: "The same six months, with real fifty-minute sessions",
  unit: { ...unitEconomics(50) },
};

/* ============================================================== scenario 3 == */

/**
 * The team the operating plan actually hires, held for three years with no
 * round.
 *
 * 🔴 THE SALARY LINE WAS THE OTHER HALF OF THE DISAGREEMENT.
 *
 * This scenario used to put two founders on **$4,000 a month plus 15% burden**
 * and nobody else, which is $9,200 of payroll and a market salary in a market
 * nobody is being paid by yet. `plans.ts` puts eight people on $3,500 in total,
 * because $500 each is what the founders said they need to live on and the rail
 * forces two support staff whether anybody likes it or not.
 *
 * The consequence was not cosmetic. At $9,200 of payroll this file reported
 * "cash runs out in month 3, needs $58,927", while the plan reported break-even
 * in month 5 on the same $20,000. **Two screens in one product, disagreeing by a
 * factor of three about whether the company survives**, and neither saying why.
 *
 * The salaries below are the plan's. The structure stays this file's own.
 */
export const BASE: Assumptions = {
  name: "Base: the plan's team, three years, no round",
  months: 36,
  unit: unitEconomics(50),
  market: {
    startingTherapists: assumed(5, "Where the simulation left off"),
    therapistsAddedPerMonth: assumed(4, "Word of mouth and one channel. No paid acquisition"),
    therapistChurnMonthly: assumed(
      0.04,
      "🔴 Not measurable by a three-month run with 22 people. Four percent a month is a working guess for a tool clinicians use weekly",
    ),
    patientsPerTherapist: assumed(12, "A part-time caseload on this platform, not their whole practice"),
    sessionsPerPatientPerMonth: assumed(2, "Fortnightly, which is the middle of the simulation's cadence ladder"),
    freeSessionsPerNewTherapist: assumed(1, "The first completed session is free"),
  },
  pricing: {
    blendedSubscriptionUsd: assumed(80, "The practice tier, from platform_settings"),
    payingShare: assumed(0.55, "The rest stay on pay as you go"),
  },
  /*
   * 🔴 Eight people, $3,500 of payroll, and no employer burden, because at this
   * size they are contractors. Identical to `plans.ts`, role for role.
   *
   * The fifth line is the one worth reading twice: **one of the two founders
   * sells full time and costs nothing extra**, because their $500 is already on
   * the first line. It is the decision the operating plan turns on, it is why
   * the plan breaks even in month 5, and it is the assumption most likely to be
   * wrong. A founder selling is a founder not building, and neither model has a
   * line for what stops being built.
   */
  people: [
    { role: "Founder, product and engineering", startMonth: 1, monthlyUsd: 500, burden: 0 },
    { role: "Founder, clinical and operations", startMonth: 1, monthlyUsd: 500, burden: 0 },
    { role: "Sales, companies and universities", startMonth: 1, monthlyUsd: 500, burden: 0 },
    { role: "Sales, clinics and therapists", startMonth: 1, monthlyUsd: 500, burden: 0 },
    { role: "Founder, selling full time", startMonth: 1, monthlyUsd: 0, burden: 0 },
    { role: "Marketing", startMonth: 1, monthlyUsd: 500, burden: 0 },
    { role: "Support, the transfer queue", startMonth: 1, monthlyUsd: 500, burden: 0 },
    { role: "Support, the transfer queue", startMonth: 1, monthlyUsd: 500, burden: 0 },
  ],
  costs: [
    {
      label: "Hosting and infrastructure",
      monthlyUsd: 120,
      startMonth: 1,
      perTherapistUsd: 1.5,
    },
    { label: "Tools, accounting, insurance", monthlyUsd: 150, startMonth: 1 },
    /*
     * 🔴 Marketing is a cost line here and an acquisition cost in `plans.ts`,
     * which is the same $1,000 counted the same way. The marketer's SALARY is
     * above, in payroll, and is deliberately not part of it: CAC counts who
     * sells and what markets, and folding a marketer's pay into it is how a CAC
     * figure quietly doubles and nobody can say why.
     */
    { label: "Marketing: ads, influencers, production", monthlyUsd: 1000, startMonth: 1 },
    { label: "Company formation and legal", monthlyUsd: 1200, startMonth: 1, endMonth: 1 },
    /* 🔴 No office. Working from home, and a line that does not exist is worth
       more than a zero: it disappears from the screen entirely. */
  ],
  money: {
    openingCashUsd: assumed(20_000, "What the two founders have put in, and the only money this scenario ever sees"),
    fundingUsd: assumed(0, "Nothing raised: this is the scenario that asks whether the thing works unfunded"),
    fundingMonth: assumed(99, "Past the horizon, which is how this model says never"),
    allocation: [],
  },
  flags,
};

/* ============================================================== scenario 4 == */

/** A round, more people, an office from the month it is signed for. */
export const FUNDED: Assumptions = {
  ...BASE,
  name: "Funded: a round at month 6, hiring against it",
  market: {
    ...BASE.market,
    therapistsAddedPerMonth: assumed(4, "Word of mouth, as in the base case, until the money arrives"),
    /*
     * 🔴 The growth follows the money rather than preceding it. The first draft
     * of this scenario applied the post-round rate from month two and broke even
     * in month four, which is to say four months before the round that paid for
     * the salesperson who was supposed to cause it.
     */
    growthSteps: [
      { fromMonth: 7, perMonth: 10 },
      { fromMonth: 10, perMonth: 14 },
      { fromMonth: 18, perMonth: 18 },
    ],
    therapistChurnMonthly: assumed(0.045, "Slightly worse, because bought growth churns harder than referred growth"),
  },
  /*
   * 🔴 THE ROUND IS WHAT PAYS THE FOUNDERS PROPERLY, and the model says so on
   * its own line rather than quietly.
   *
   * `Hire` has a start month and no end month, so the two $500 lines inherited
   * from `BASE` keep running and this adds the difference on top from the month
   * the money lands: two founders from $500 to $4,000 is $7,000 a month more.
   * Written as a top-up rather than a replacement because that is what the data
   * shape can express honestly, and a reader can see both halves.
   *
   * ⚠️ It is also a real claim about what a round is for. Living on $500 in
   * Cairo is a founder subsidising the company, and a plan that assumed it
   * forever would be forecasting on a subsidy nobody agreed to renew.
   */
  people: [
    ...BASE.people,
    { role: "Founders, salary raised to market when the round lands", startMonth: 7, monthlyUsd: 7000, burden: 0.15 },
    { role: "Engineer", startMonth: 7, monthlyUsd: 5500, burden: 0.15 },
    { role: "Clinical lead", startMonth: 8, monthlyUsd: 5000, burden: 0.15 },
    { role: "Growth", startMonth: 7, monthlyUsd: 4500, burden: 0.15 },
    { role: "Support, Cairo", startMonth: 10, monthlyUsd: 1200, burden: 0.15 },
    { role: "Engineer, second", startMonth: 16, monthlyUsd: 5500, burden: 0.15 },
  ],
  costs: [
    ...BASE.costs,
    /* 🔴 The office starts in month 9 and not before. Every cost line carries a
       start month for exactly this, so "later" is a number rather than a note. */
    { label: "Office, Cairo", monthlyUsd: 1800, startMonth: 9 },
    { label: "Paid acquisition", monthlyUsd: 6000, startMonth: 7 },
  ],
  money: {
    openingCashUsd: assumed(20_000, "What the two founders have put in, before any round lands"),
    fundingUsd: assumed(750_000, "A pre-seed round, at the size the region's pre-seeds actually clear"),
    fundingMonth: assumed(6, "The month the money is in the account, not the month the term sheet is signed"),
    allocation: [
      { label: "People", share: 0.6 },
      { label: "Acquisition", share: 0.25 },
      { label: "Infrastructure and AI", share: 0.1 },
      { label: "Legal, entity, licensing", share: 0.05 },
    ],
  },
  flags,
};

export const SCENARIOS = [BENCHMARK, REAL_SESSIONS, BASE, FUNDED] as const;

export const SCENARIO_BY_SLUG: Record<string, Assumptions> = {
  benchmark: BENCHMARK,
  "real-sessions": REAL_SESSIONS,
  base: BASE,
  funded: FUNDED,
};
