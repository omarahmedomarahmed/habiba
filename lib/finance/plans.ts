/**
 * The plan, as it will actually be operated. Egypt, an angel cheque, three
 * months of beta, and thirty-three months after it.
 *
 * ## 🔴 EVERY NUMBER HERE IS ONE OF THREE THINGS, AND THEY ARE NOT THE SAME
 *
 * **MEASURED** — someone measured it. In this file that is exactly two numbers,
 * the AI cost terms, from three runs against the live OpenAI API on 2026-09-14.
 *
 * **DECIDED** — a choice, not a forecast. The offer, the salaries, the hiring
 * plan, the acquisition targets. These are not predictions that might be wrong;
 * they are things somebody will make true or will not. If a target is missed
 * that is an execution fact, not a modelling error.
 *
 * **GUESSED** — every market number: what an Egyptian therapist will pay, how
 * many of a call centre's staff will use a benefit, how many leave when the
 * discount ends. **These are the numbers the beta exists to replace.** Each one
 * carries a `GUESS` comment saying what it rests on and how wrong it could be.
 *
 * A reader who cannot tell these apart will read a spreadsheet as evidence, and
 * that is the single most expensive mistake available at this stage.
 *
 * ## 🔴 THE PRICES ARE NOT THE ONES IN `platform_settings`, AND THAT IS ON PURPOSE
 *
 * The product currently ships $99 and $179 monthly tiers and a $3 AI fee. In
 * Egypt at roughly 50 EGP to the dollar, $99 is about 4,950 EGP a month, which
 * is more than many Egyptian therapists net from a week of sessions. Selling it
 * is not a hard conversation, it is an impossible one.
 *
 * So this plan prices in EGP and converts. Nothing here writes to
 * `platform_settings`: these are forecast inputs, they are editable on
 * `/admin/financial-model`, and `verify:finance` asserts that this module cannot
 * reach anything that bills anybody.
 */
import type { Plan } from "./beta";
import { AI_FIXED_USD, AI_PER_MINUTE_USD } from "./scenarios";

/**
 * 🔴 GUESS, and everything denominated in pounds moves with it.
 *
 * The pound has run 47 to 52 through 2025. At 50 a round number of pounds is a
 * round number of dollars, which keeps the tables readable. A 20% move here
 * moves every revenue line by 20% and no cost line except the local salaries,
 * which is worth knowing before anybody quotes a dollar figure abroad.
 */
export const EGP_PER_USD = 50;

const egp = (pounds: number) => pounds / EGP_PER_USD;

/* ============================================================ the unit ==== */

const UNIT = {
  /**
   * 🔴 DECIDED, and raised from 500 EGP after the founders set the benchmark.
   *
   * **1,000 EGP, or $20.** This is the number the sponsor screens do their
   * arithmetic against: $200 of welcome credit is 100 sessions at 10% coverage
   * or 10 sessions at 100%, and an HR manager moving the coverage slider should
   * see exactly that.
   *
   * ⚠️ It sits at the TOP of the Cairo range, not the middle. Private therapy
   * here runs roughly 300 to 1,000 EGP, so this assumes the therapists on this
   * platform are at the senior end. It doubles every session-fee line against
   * the previous draft, which is a large move to make on a benchmark rather than
   * a measurement. The beta measures the real distribution.
   */
  sessionPriceUsd: egp(1000),

  /**
   * 🔴 DECIDED, and changed from the shipped settings.
   *
   * The product charges $1 a session plus 15%. On a $10 session that is $2.50,
   * or a quarter of what the patient paid, which no therapist accepts twice.
   * This plan takes 15% and drops the flat fee: $1.50 on a 500 EGP session,
   * which is inside what payment processors and marketplaces charge here.
   */
  takeRate: 0.15,
  platformFeeUsd: 0,

  /**
   * 🔴 DECIDED. 50 EGP for the AI on a session, against a MEASURED cost of
   * $0.2167 at fifty minutes. A 4.6x markup on a line the therapist can see the
   * value of, and 5% of a 1,000 EGP session.
   */
  aiFeeUsd: egp(50),

  /**
   * 🔴 GUESS. Seven in ten patients agree to recording.
   *
   * C209: the AI fee only exists where the patient said yes, so this multiplies
   * the whole AI revenue line. It is also the single easiest thing for the beta
   * to measure properly, and it is measured by counting, not by asking.
   */
  consentRate: 0.7,

  /** DECIDED. A therapy hour is fifty minutes everywhere. */
  sessionMinutes: 50,

  /** 🔴 MEASURED, 2026-09-14, against the live API. See `evals/physics.json`. */
  aiFixedUsd: AI_FIXED_USD,
  aiPerMinuteUsd: AI_PER_MINUTE_USD,

  /**
   * 🔴 GUESS. Daily bills per participant-minute and a session has two people,
   * so a fifty-minute session bills a hundred minutes. Never measured here: the
   * invoice is not in our database.
   */
  videoPerParticipantMinuteUsd: 0.004,

  /**
   * 🔴 GUESS, and pessimistic on purpose. Stripe's Egypt rates are not the US
   * 2.9% + 30c, and local rails (Fawry, InstaPay, wallets) charge differently
   * again. The simulation runs Stripe in test mode and is charged nothing, so
   * this can never be measured by it. Budget 3%.
   */
  paymentPercent: 0.03,
  paymentFixedUsd: 0.1,
};

/* ========================================================= the segments === */

/**
 * 🔴 A LARGE EGYPTIAN CALL CENTRE. All three numbers below are guesses and the
 * product of them is the whole company revenue line.
 *
 * Staff: 1,000. Cairo's outsourcing floors run from a few hundred to several
 * thousand; 1,000 is an ordinary one.
 *
 * Enrolment: 5% sign up. Employee assistance programmes worldwide report
 * single-digit first-year utilisation and this is a population that has never
 * been offered this before, in a country where therapy still carries stigma.
 * 5% of 1,000 is 50 people.
 *
 * Activity: 40% of those enrolled have a session in a given month, 1.5 sessions
 * each. So 50 x 0.4 x 1.5 = **30 sessions a month per company**, worth 15,000
 * EGP of therapy, on which we earn 15% plus the AI fee.
 *
 * Expressed below as 1 "clinician" with 20 "patients" at 1.5 sessions, which
 * multiplies to the same 30 and keeps the segment shape uniform.
 */
const COMPANY = {
  key: "company" as const,
  label: "Company or university",
  /** 🔴 DECIDED. Two in month one, one in month two, none in month three. */
  arrivals: [2, 1, 0],
  /** 🔴 GUESS. One a month once there is a case study to sell with. */
  steadyPerMonth: 1,
  /** DECIDED. They fund a pot; there is no seat fee in the beta. */
  monthlyUsd: 0,
  cliniciansEach: 1,
  patientsPerClinician: 20,
  sessionsPerPatient: 1.5,
  /** 🔴 GUESS. Three months to get a thousand-person floor from posters to habit. */
  rampMonths: 3,
  /** 🔴 GUESS. A funded pot is not cancelled mid-quarter. */
  churnInPromo: 0,
  /**
   * 🔴 GUESS, and the most consequential one in the file. A third of companies
   * do not renew once the welcome credit is gone and they see a real invoice.
   */
  churnAtFullPrice: 0.33,
  churnSteady: 0.03,
  /** 🔴 DECIDED. $200 of welcome credit, which is their first ~20 sessions. */
  welcomeCreditUsd: 200,
};

/**
 * 🔴 A CLINIC. Four clinicians, ten patients each, two and a half sessions a
 * month, so 100 sessions a month per clinic.
 *
 * 3,000 EGP a month for up to five clinicians is 600 EGP a head, roughly one
 * session's fee per clinician per month. That is the price test the beta runs.
 */
const CLINIC = {
  key: "clinic" as const,
  label: "Clinic",
  /** 🔴 DECIDED. Six clinics in three months, weighted late as the pitch improves. */
  arrivals: [1, 2, 3],
  /** 🔴 GUESS. Two a month once referenceable. */
  steadyPerMonth: 2,
  monthlyUsd: egp(3000),
  /** 🔴 GUESS. Four practising clinicians in a typical small Cairo clinic. */
  cliniciansEach: 4,
  patientsPerClinician: 10,
  sessionsPerPatient: 2.5,
  /** 🔴 GUESS. Three months to get four clinicians recording routinely. */
  rampMonths: 3,
  churnInPromo: 0.02,
  /** 🔴 GUESS. A quarter walk when the half-price months end. */
  churnAtFullPrice: 0.25,
  churnSteady: 0.04,
  welcomeCreditUsd: 0,
};

/**
 * 🔴 A SOLO THERAPIST. 1,000 EGP a month is two sessions' fee against maybe
 * forty sessions of work, so the product has to be worth 5% of their month.
 * Eight patients at 2.5 sessions is twenty sessions a month, which is a
 * part-time private caseload rather than a full book.
 */
const THERAPIST = {
  key: "therapist" as const,
  label: "Solo therapist",
  /** 🔴 DECIDED. Nine over the quarter, inside the 8 to 10 target. */
  arrivals: [2, 3, 4],
  /** 🔴 GUESS. Four a month, from referrals and the influencer posts. */
  steadyPerMonth: 4,
  /**
   * 🔴 DECIDED: **$100 a month**, the unlimited tier the product already ships.
   *
   * The pitch that makes it defensible is arithmetic the therapist can check
   * themselves. Pay as you go costs **$4 a session**, so $100 is **exactly 25
   * sessions**. Below 25 a month, pay as you go is cheaper and they should use
   * it. Above it, unlimited is, and the note writing comes free. Nobody has to
   * be talked into a number they can work out.
   *
   * 🔴 And the promise underneath is arithmetic too, not marketing: at a $20
   * session, **ten sessions earns them $200 against a $100 bill.** A therapist
   * who works at all pays for this out of what they earned through it, which is
   * what `payouts.netFeeFromHeldEarnings` already implements rather than
   * something we would have to build.
   */
  monthlyUsd: 100,
  cliniciansEach: 1,
  patientsPerClinician: 8,
  sessionsPerPatient: 2.5,
  /** 🔴 GUESS. One person changing their own habit. Two months. */
  rampMonths: 2,
  churnInPromo: 0.03,
  /**
   * 🔴 GUESS, and the number this whole beta is built to find out. Forty per
   * cent of solo therapists leave the month the free ride ends. Free-trial
   * conversion for unproven small-business software is commonly worse than
   * this, and pricing a plan on a kinder number is how a runway disappears.
   */
  churnAtFullPrice: 0.4,
  churnSteady: 0.06,
  welcomeCreditUsd: 0,
};

/**
 * 🔴 AFTER THE ROUND, THE SAME THREE SEGMENTS ARRIVE FASTER.
 *
 * A round buys reach, so arrivals rise in every scenario that has one. They rise
 * by the SAME amount in both post-round scenarios, which is the only way the
 * comparison between them means anything.
 *
 * The first draft of this file gave the half-price scenario both better arrivals
 * AND better churn, and then reported that half price won. That is not a finding,
 * it is the assumption restated: any option handed two advantages beats one
 * handed none. The two scenarios below now differ in exactly one thing, the
 * price a customer pays after the beta, and the churn that follows from it.
 */
const POST_ROUND = [
  { ...COMPANY, steadyPerMonth: 1.5 },
  { ...CLINIC, steadyPerMonth: 3 },
  { ...THERAPIST, steadyPerMonth: 6 },
];

/* ============================================================ the offers == */

/**
 * 🔴 THE BETA OFFER, DECIDED: month one free, months two and three at half
 * price, full price from month four.
 *
 * `[0, 0.5, 0.5]` is read off the customer's own age, so somebody joining in
 * month 3 is still free in month 3 and still half price in month 5. The cliff
 * arrives for each cohort on its own schedule, which is exactly what makes it
 * hard to see in a spreadsheet and easy to see here.
 */
const BETA_OFFER = { schedule: [0, 0.5, 0.5], after: 1 };

/* ============================================================== the plans = */

const FOUNDERS = [
  /** 🔴 DECIDED. $500 each, which is what you said you need to live on. */
  { role: "Founder, product and engineering", startMonth: 1, monthlyUsd: 500 },
  { role: "Founder, clinical and operations", startMonth: 1, monthlyUsd: 500 },
];

const SALES = [
  /** 🔴 DECIDED. One hunting companies, one hunting clinics and therapists. */
  { role: "Sales, companies and universities", startMonth: 1, monthlyUsd: 500 },
  { role: "Sales, clinics and therapists", startMonth: 1, monthlyUsd: 500 },
  /**
   * 🔴 DECIDED. A marketing person from month one, same rate as sales.
   *
   * ⚠️ Their salary is NOT in CAC. CAC counts the people who sell and the money
   * that markets, and `runPlan` picks sales roles out by name. A marketer's pay
   * is an operating cost; the budget they spend is the acquisition cost. Folding
   * the two together is how a CAC figure quietly doubles and nobody can say why.
   */
  { role: "Marketing", startMonth: 1, monthlyUsd: 500 },
];

/**
 * 🔴 TWO SUPPORT STAFF, AND THEY ARE NOT OPTIONAL. 73.4.
 *
 * The Egyptian rail is a bank transfer and a person who checks it. Somebody is
 * sitting on a spinner waiting to join a therapy session, and the queue has to
 * be worked by the minute or the product does not function. That is a staffing
 * decision the payment design forces, not a nice-to-have, and a plan that
 * modelled the rail without modelling the people would be describing a product
 * nobody can operate.
 *
 * The founders work the same queue alongside them, and cover marketing and sales
 * too. That does not appear as a cost because they are already on the payroll;
 * it appears as the reason there are five people rather than nine.
 */
const SUPPORT = [
  { role: "Support, the transfer queue", startMonth: 1, monthlyUsd: 500 },
  { role: "Support, the transfer queue and onboarding", startMonth: 1, monthlyUsd: 500 },
];

/**
 * 🔴 THE MARKETING BUDGET, AND WHERE EACH LINE COMES FROM.
 *
 * Videos: three of them, produced once, in month one. A competent 60 to 90
 * second explainer in Cairo runs 5,000 to 15,000 EGP. Budgeted at 10,000 each.
 *
 * Ads: 15,000 EGP a month across Meta and TikTok. Egyptian CPMs are low, so
 * this buys real reach; it does not buy a brand.
 *
 * Influencers: three therapists with an audience. The subscription is free to
 * them, which costs us nothing in cash and shows in the discount line. The cash
 * is the fee: 5,000 EGP a month each is micro-influencer rate here.
 *
 * Referral: their followers get a free month, which again is forgone revenue
 * rather than cash, so it appears in the discount line and not here.
 */
/**
 * 🔴 ONE MARKETING BUDGET OF $1,000 A MONTH, held by the marketing hire.
 *
 * The founders set it as a single number covering production, cast, ad spend and
 * the influencer sponsorships, rather than three lines that each need their own
 * argument. Split here only so the run can see where it went; the total is the
 * decision and the split is the marketer's to change.
 *
 * The three videos are a one-off on top, in month one, because production is not
 * a monthly cost and burying it in the monthly figure would understate month one
 * and overstate every month after.
 */
const MARKETING: { label: string; monthlyUsd: number; startMonth: number; endMonth?: number; everyMonth: boolean }[] = [
  { label: "Three videos, produced and cast", monthlyUsd: egp(30_000), startMonth: 1, everyMonth: false },
  { label: "Ad spend", monthlyUsd: 600, startMonth: 1, everyMonth: true },
  { label: "Influencer therapists, three of them", monthlyUsd: 400, startMonth: 1, everyMonth: true },
];

/**
 * 🔴 EVERYTHING ELSE, and it is small because there is no office.
 *
 * Hosting is Vercel and Neon on paid tiers plus the video minutes; tools are
 * accounting, a domain, a password manager. Company formation is one-off and
 * Egyptian company registration plus a lawyer is not free.
 */
const OVERHEAD: { label: string; monthlyUsd: number; startMonth: number; endMonth?: number; everyMonth: boolean }[] = [
  { label: "Hosting and infrastructure", monthlyUsd: 120, startMonth: 1, everyMonth: true },
  { label: "Tools, accounting, insurance", monthlyUsd: 150, startMonth: 1, everyMonth: true },
  { label: "Company formation and legal", monthlyUsd: 1200, startMonth: 1, everyMonth: false },
];

/**
 * 🔴 SCENARIO A — THE BETA, AS PLANNED. Three months, the angel's $20,000, the
 * full offer, two salespeople, everything on.
 *
 * This is the one to argue about. Everything after it is a consequence.
 */
export const BETA: Plan = {
  name: "The beta: three months on the angel cheque",
  months: 3,
  egpPerUsd: EGP_PER_USD,
  /** 🔴 DECIDED. The angel's cheque, in the bank before month one. */
  openingCashUsd: 20_000,
  raiseUsd: 0,
  raiseMonth: 99,
  unit: UNIT,
  segments: [COMPANY, CLINIC, THERAPIST],
  /**
   * 🔴 THE OFFER ENDS WITH THE BETA, and what replaces it is thinner on purpose.
   *
   * Beta cohorts (joined months 1-3): free, half, half, then full.
   * Everybody after: **one free month, then full price.** No half-price months.
   *
   * That is the founders' decision and it is the right shape: the beta's job was
   * to buy evidence, and evidence bought once does not need buying again. It
   * also makes months 4 to 6 the honest test, because two different cohorts hit
   * full price in them from two different schedules and the model has to keep
   * them apart. An aggregate model could not.
   */
  promo: { ...BETA_OFFER, lastMonth: 3, afterBeta: { schedule: [0], after: 1 } },
  people: [...FOUNDERS, ...SALES, ...SUPPORT],
  spend: [...MARKETING, ...OVERHEAD],
};

/**
 * 🔴 SCENARIO B — THE BETA PLUS THE CLIFF. Six months, same plan, no new money.
 *
 * The beta's own three months hide the thing that matters: nobody pays full
 * price inside them. The first cohort's first full-price invoice lands in month
 * 4, and this scenario exists to show what happens when it does, and how much
 * of the $20,000 is left at that point.
 *
 * 🔴 RUN THIS ONE BEFORE TALKING TO THE ANGEL. It is the honest version.
 */
export const BETA_THEN_CLIFF: Plan = {
  ...BETA,
  name: "The beta, then the cliff: six months, no new money",
  months: 6,
};

/**
 * 🔴 SCENARIO C — CAN THE ANGEL CHEQUE ALONE DO IT? Eighteen months, no round.
 *
 * The same plan, the same offer, the same two salespeople, run out far enough to
 * answer the only question that decides whether you have to raise: **does
 * $20,000 reach the month revenue covers costs, or does it not?**
 *
 * Nothing changes from the beta. Sales keep hitting their steady rate, the
 * discount cliff arrives for every cohort in turn, nobody gets a pay rise. It is
 * the beta continued rather than a new plan, which is what makes it a fair test.
 *
 * 🔴 **This is the scenario to take to the angel**, because it is the one that
 * says what their money buys rather than what a later round might.
 */
export const RUNWAY: Plan = {
  ...BETA,
  name: "Can the $20k alone do it? Eighteen months, no round",
  months: 18,
};

/**
 * 🔴 SCENARIO D — RAISE, AND GRANDFATHER THE EARLY ADOPTERS.
 *
 * Thirty-six months. A round lands in month 6. Everybody who joined in the beta
 * keeps half price for ever; everybody after pays full price with a free first
 * month and no discount after it.
 *
 * This is the kinder of your two options for the early adopters and the more
 * expensive one for you: the first cohort is your loudest reference and never
 * pays list.
 */
export const GRANDFATHERED: Plan = {
  ...BETA,
  name: "Raise at month 6, early adopters keep half price for ever",
  months: 36,
  segments: POST_ROUND,
  raiseUsd: 150_000,
  raiseMonth: 6,
  promo: {
    schedule: [0, 0.5, 0.5],
    /** 🔴 The grandfather clause: beta cohorts stay at half price. */
    after: 0.5,
    lastMonth: 3,
    /** Everybody after the beta: one free month, then full price. */
    afterBeta: { schedule: [0], after: 1 },
  },
  people: [
    /*
     * 🔴 The founders stay on $500 until the round LANDS, then go to $1,500.
     *
     * The first draft of this scenario paid them $1,500 from month one, against
     * money that arrives in month six, and the cash went below zero in month
     * five as a direct result. Paying yourself out of a cheque you have not
     * received is the commonest way a plan lies, and the model caught it.
     */
    ...FOUNDERS,
    ...FOUNDERS.map((p) => ({ ...p, monthlyUsd: 1000, startMonth: 7 })),
    ...SALES,
    ...SUPPORT,
    { role: "Sales, third", startMonth: 7, monthlyUsd: 700 },
    { role: "Support and onboarding", startMonth: 7, monthlyUsd: 500 },
    { role: "Engineer", startMonth: 9, monthlyUsd: 1800 },
  ],
  spend: [
    ...MARKETING,
    { label: "Ad spend, after the round", monthlyUsd: egp(60_000), startMonth: 7, everyMonth: true },
    ...OVERHEAD,
    { label: "Office, Cairo", monthlyUsd: egp(25_000), startMonth: 9, everyMonth: true },
  ],
};

/**
 * 🔴 SCENARIO E — RAISE, KEEP HALF PRICE FOR EVERYBODY, DROP THE FREE MONTH.
 *
 * Your other option. Half price is the list price from month 4 on, for
 * everyone, and nobody gets a free first month any more. Cheaper per customer,
 * far more customers, and the question it answers is whether volume at half
 * price beats margin at full price. The model says which, and it says so on an
 * assumed churn number, so read it as a direction and not as a decision.
 */
export const HALF_PRICE_FOR_ALL: Plan = {
  ...GRANDFATHERED,
  name: "Raise at month 6, half price for everybody, no free month",
  promo: {
    schedule: [0, 0.5, 0.5],
    after: 0.5,
    lastMonth: 3,
    afterBeta: { schedule: [], after: 0.5 },
  },
  /*
   * 🔴 IDENTICAL ARRIVALS TO THE SCENARIO ABOVE. The ONLY difference is that
   * nobody ever faces a price rise, so there is no cliff to fall off.
   *
   * That single change is the whole comparison. If half price still wins after
   * this, it wins on retention, which is a thing the beta can measure. The
   * assumption doing the work is that a customer who never sees a rise churns at
   * the steady rate instead of the cliff rate, and that is a GUESS.
   */
  segments: POST_ROUND.map((seg) => ({ ...seg, churnAtFullPrice: seg.churnSteady })),
};

/* ========================================================= the provenance = */

/**
 * 🔴 WHERE EVERY NUMBER CAME FROM, AS DATA RATHER THAN AS COMMENTS.
 *
 * ⚠️ The first version of this file put these labels in comments beside each
 * value, and `verify:plan` counted them by matching the comment text. C205 says
 * a verifier must strip comments before scanning source, and the C205 gate
 * caught this one doing the opposite. Two things were wrong with it, and the
 * second is the real one:
 *
 *   1. The check read raw source to see its own labels.
 *   2. **A record only a comment holds is a record no check can verify** — the
 *      exact rule `evals/prose.json` already had to learn once, about the
 *      dictionary keys sprint 65 removed.
 *
 * So the labels live here, as a list. The comments beside each value stay,
 * because they explain WHY; this says WHAT KIND, and a check can read it, and so
 * can the screen.
 *
 * `guess` is not a hedge. It is the work list for the beta: every row below
 * marked `guess` is a question three months of real customers will answer, and
 * the ones marked `decided` will not change unless somebody changes their mind.
 */
export type Provenance = "measured" | "decided" | "guess";

export const PROVENANCE: { path: string; kind: Provenance; why: string }[] = [
  { path: "egpPerUsd", kind: "guess", why: "The pound ran 47 to 52 through 2025. Every revenue line moves with it" },

  { path: "unit.aiFixedUsd", kind: "measured", why: "Live OpenAI API, 2026-09-14, four durations, three runs" },
  { path: "unit.aiPerMinuteUsd", kind: "measured", why: "Same run. evals/physics.json has every row" },

  { path: "unit.sessionPriceUsd", kind: "decided", why: "1,000 EGP, the founders' benchmark. ⚠️ Top of the Cairo range, not the middle" },
  { path: "unit.takeRate", kind: "decided", why: "15% and no flat fee, so $3 on a 1,000 EGP session" },
  { path: "unit.platformFeeUsd", kind: "decided", why: "Zero, for the same reason" },
  { path: "unit.aiFeeUsd", kind: "decided", why: "50 EGP against a measured cost of $0.2167. A 4.6x markup, and 5% of the session" },
  { path: "unit.consentRate", kind: "guess", why: "70%. The one guess the simulation can replace by counting" },
  { path: "unit.sessionMinutes", kind: "decided", why: "A therapy hour is fifty minutes" },
  { path: "unit.videoPerParticipantMinuteUsd", kind: "guess", why: "Daily, per participant-minute. The invoice is not in our database" },
  { path: "unit.paymentPercent", kind: "guess", why: "3%. Stripe runs in test mode here and is charged nothing" },
  { path: "unit.paymentFixedUsd", kind: "guess", why: "Same caveat. Local rails price differently again" },

  { path: "company.arrivals", kind: "decided", why: "Two, one, none. What the first salesperson is paid to do" },
  { path: "company.patientsPerClinician", kind: "guess", why: "5% of a 1,000-person call centre enrol, 40% of those active monthly" },
  { path: "company.welcomeCreditUsd", kind: "decided", why: "$200 of pot credit, which is their first twenty sessions" },
  { path: "company.churnAtFullPrice", kind: "guess", why: "A third do not renew when the credit runs out and a real invoice arrives" },
  { path: "company.rampMonths", kind: "guess", why: "Three months from posters on a wall to a habit" },

  { path: "clinic.arrivals", kind: "decided", why: "Six over the quarter. The second salesperson's target" },
  { path: "clinic.monthlyUsd", kind: "guess", why: "3,000 EGP for up to five clinicians, or 600 a head" },
  { path: "clinic.cliniciansEach", kind: "guess", why: "Four practising clinicians in a small Cairo clinic" },
  { path: "clinic.churnAtFullPrice", kind: "guess", why: "A quarter walk when the half-price months end" },

  { path: "therapist.arrivals", kind: "decided", why: "Nine over the quarter, inside the 8 to 10 target" },
  { path: "therapist.monthlyUsd", kind: "decided", why: "$100 unlimited, which is exactly 25 PAYG sessions at $4. The therapist can check it" },
  { path: "payg.perSessionUsd", kind: "decided", why: "$4 a session, 20% of a $20 session, and the alternative to the $100 plan" },
  { path: "therapist.patientsPerClinician", kind: "guess", why: "Eight patients, a part-time private caseload" },
  { path: "therapist.churnAtFullPrice", kind: "guess", why: "🔴 40%. The number the whole beta exists to find out" },

  { path: "promo.schedule", kind: "decided", why: "Free, half, half, then full. The beta offer" },
  { path: "promo.afterBeta", kind: "decided", why: "Months 4 on: one free month then full price. The beta buys evidence once" },
  { path: "people", kind: "decided", why: "Two founders, two sales, one marketer, two support. $500 each" },
  { path: "support", kind: "decided", why: "🔴 Forced by the rail: a bank transfer needs a person, by the minute" },
  { path: "spend.videos", kind: "guess", why: "10,000 EGP each for a 60 to 90 second explainer in Cairo" },
  { path: "spend.ads", kind: "decided", why: "Part of the $1,000 a month the marketing hire spends" },
  { path: "spend.influencers", kind: "decided", why: "The rest of the $1,000. Three therapists with an audience" },
  { path: "openingCashUsd", kind: "decided", why: "The angel's cheque" },
];

/** How many of each kind, for a screen that wants to say so before a chart. */
export function provenanceCounts(): Record<Provenance, number> {
  const out: Record<Provenance, number> = { measured: 0, decided: 0, guess: 0 };
  for (const row of PROVENANCE) out[row.kind]++;
  return out;
}

/* ========================================================== the variables = */

/**
 * 🔴 THE TWO NUMBERS NOBODY KNOWS, AS THREE NAMED CASES EACH. 73.5.
 *
 * The founders asked for the MEDIUM case to be the one reported, and for the
 * good and bad cases to exist beside it rather than instead of it. That is the
 * right instinct and it is worth saying why:
 *
 * A single number invites a reader to treat it as a forecast. Three numbers with
 * names on them invite the only useful question, which is **which of these do
 * you think we are?** The beta answers that by counting, and until it does, the
 * honest position is that we do not know and have said so in three places.
 *
 * 🔴 `medium` IS THE DEFAULT AND THE OTHERS ARE NOT SHIPPED AS PLANS. A reader
 * who can click "good" gets the good one, and every deck ever assembled from a
 * model with an optimistic toggle has used it.
 */
export type Case = "good" | "medium" | "bad";

/**
 * Churn the month full price lands, as a multiplier on each segment's own rate.
 *
 * A company and a solo therapist do not leave at the same rate, so this scales
 * what each already has rather than flattening all three to one number. The
 * founders named the ends: 10% is the good case and 50% the bad one, against a
 * medium of the plan's own 25 to 40%.
 */
export const CHURN_CASES: Record<Case, { multiplier: number; why: string }> = {
  good: { multiplier: 0.3, why: "Roughly one in ten leaves. Everybody stayed for the product, not the discount" },
  medium: { multiplier: 1, why: "🔴 THE REPORTED CASE. A quarter to two fifths leave when the price arrives" },
  bad: { multiplier: 1.4, why: "Half leave. The free month bought sign-ups and nothing else" },
};

/**
 * What the two salespeople close in a month, once the first easy wins are gone.
 *
 * Expressed as accounts per month across both of them, because that is the unit
 * a salesperson is actually managed in and the unit the beta will report.
 */
export const GROWTH_CASES: Record<Case, { multiplier: number; why: string }> = {
  good: { multiplier: 1.5, why: "Referrals compound and the case studies do the selling" },
  medium: { multiplier: 1, why: "🔴 THE REPORTED CASE. Each rep holds two to four accounts a month" },
  bad: { multiplier: 0.6, why: "It gets harder after the first free month, and nobody refers anybody" },
};

/**
 * Apply a case to a plan. Pure, so a screen can run all three side by side.
 *
 * 🔴 It multiplies rather than replaces, for the same reason the cliff slider
 * does: the three segments keep their relationship to each other, and a single
 * flat rate would quietly assert that a call centre and a solo therapist behave
 * the same way.
 */
export function withCase(plan: Plan, churn: Case, growth: Case): Plan {
  const c = CHURN_CASES[churn].multiplier;
  const g = GROWTH_CASES[growth].multiplier;
  return {
    ...plan,
    name: `${plan.name} · churn ${churn}, growth ${growth}`,
    segments: plan.segments.map((seg) => ({
      ...seg,
      churnAtFullPrice: Math.min(0.95, seg.churnAtFullPrice * c),
      steadyPerMonth: seg.steadyPerMonth * g,
      /* The named arrivals are TARGETS somebody is paid to hit, so they do not scale. */
    })),
  };
}

export const PLANS = [BETA, BETA_THEN_CLIFF, RUNWAY, GRANDFATHERED, HALF_PRICE_FOR_ALL];
export const PLAN_SLUGS = ["beta", "beta-cliff", "runway", "grandfathered", "half-price"] as const;
