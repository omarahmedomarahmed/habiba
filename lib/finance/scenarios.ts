/**
 * The four shipped scenarios, and what separates them.
 *
 * ## 🔴 Scenario one is not a forecast
 *
 * `benchmark` is the simulation, as it ran: three-minute sessions, twenty-two
 * people, three months. It exists to be **compared against reality**, which is
 * the only way the other three earn any credibility. Read it as a calibration.
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
    sessionPriceUsd: assumed(40, "What a patient pays their therapist. Varies by market and by therapist"),
    recordingConsentRate: assumed(
      0.7,
      "C209: the AI fee rides on the patient saying yes. The simulation measures this and the figure should be replaced by it",
    ),
    aiFeeUsdPerSession: measured(3, "platform_settings.pricing payg aiRateCents", MEASURED_ON, 1),
    paymentPercent: assumed(
      0.029,
      "Stripe. 🔴 The simulation runs in test mode and is charged nothing, so this can never be measured by it",
    ),
    paymentFixedUsd: assumed(0.3, "Stripe, per charge. Same caveat"),
  };
}

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
  name: "Benchmark: the simulation as it ran",
  months: 3,
  unit: {
    ...unitEconomics(3),
    sessionMinutes: measured(3, "24 of the 35 sessions. The other 11 ran 8", MEASURED_ON, 35),
    recordingConsentRate: assumed(1, "Every simulated patient consents, so this is not a measurement of consent"),
  },
  market: {
    startingTherapists: measured(5, "T1 to T4 plus C1-A", MEASURED_ON, 5),
    therapistsAddedPerMonth: assumed(0, "The cast is fixed"),
    therapistChurnMonthly: assumed(0, "Three months and nobody left. That is not a churn measurement"),
    patientsPerTherapist: measured(1.2, "6 patients across 5 therapists", MEASURED_ON, 6),
    sessionsPerPatientPerMonth: measured(1.9, "35 sessions, 6 patients, 3 months", MEASURED_ON, 35),
    freeSessionsPerNewTherapist: measured(1, "The first completed session is free, per therapist", MEASURED_ON, 5),
  },
  pricing: {
    blendedSubscriptionUsd: assumed(27, "One therapist on the $80 plan out of three paying"),
    payingShare: assumed(0.6, "Three of five"),
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
  name: "The same quarter, with real fifty-minute sessions",
  unit: { ...unitEconomics(50) },
};

/* ============================================================== scenario 3 == */

/** Two people, working from home, growing steadily, nobody funding it. */
export const BASE: Assumptions = {
  name: "Base: two of us, from home, growing steadily",
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
  people: [
    { role: "Founder, product and engineering", startMonth: 1, monthlyUsd: 4000, burden: 0.15 },
    { role: "Founder, clinical and operations", startMonth: 1, monthlyUsd: 4000, burden: 0.15 },
  ],
  costs: [
    {
      label: "Hosting and infrastructure",
      monthlyUsd: 120,
      startMonth: 1,
      perTherapistUsd: 1.5,
    },
    { label: "Tools, accounting, insurance", monthlyUsd: 350, startMonth: 1 },
    /* 🔴 No office. The founder works from home, and a line that does not exist
       is worth more than a zero: it disappears from the screen entirely. */
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
  people: [
    ...BASE.people,
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
