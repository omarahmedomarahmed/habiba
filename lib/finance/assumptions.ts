/**
 * Every number the forecast runs on, and where each one came from.
 *
 * ## 🔴 The field that makes this defensible
 *
 * `from`. Three values, and the whole model is built around the distinction:
 *
 * | | |
 * |---|---|
 * | `measured` | Computed from rows. Carries the date and the sample size |
 * | `assumed` | Typed by a person. Nothing measured it and nothing can, here |
 * | `derived` | Computed from the other two by `model.ts` |
 *
 * A forecast that cannot tell you which of its numbers came from reality is a
 * spreadsheet with a logo on it. Three months and twenty-two people can measure
 * what a session costs; they cannot measure churn, and the screen has to say so
 * beside the number rather than in a footnote nobody reads.
 *
 * ## What this file is NOT allowed to be
 *
 * A second place prices are defined. `platformFeeCents` here is a **reading of**
 * `platform_settings`, taken by `benchmark.ts`. If an operator types a different
 * one, that is a scenario, and the screen says it differs from what the product
 * actually charges. Nothing in `lib/finance/` may write a price, and
 * `verify:finance` asserts the import graph.
 */

export type Provenance = "measured" | "assumed" | "derived";

/** One number, with its provenance attached rather than remembered. */
export type Input<T = number> = {
  value: T;
  from: Provenance;
  /** Why this number is what it is. Shown under it on the screen. */
  note: string;
  /** For `measured`: when, and out of how many rows. */
  measuredOn?: string;
  samples?: number;
};

export const measured = (value: number, note: string, measuredOn: string, samples: number): Input => ({
  value,
  from: "measured",
  note,
  measuredOn,
  samples,
});

export const assumed = (value: number, note: string): Input => ({ value, from: "assumed", note });

/* ------------------------------------------------------------- the groups -- */

/**
 * What one session costs and earns. **This is the half the simulation can
 * validate**, and the half every other number leans on.
 */
export type UnitEconomics = {
  /** Length of a real session, in minutes. The lever between scenarios. */
  sessionMinutes: Input;
  /**
   * 🔴 The two-term cost model, measured against the live API on 2026-09-14.
   * `lib/finance/physics.ts` explains why one term is not enough.
   */
  aiFixedUsdPerSession: Input;
  aiPerMinuteUsd: Input;
  /** Daily video, per participant-minute. Two participants per session. */
  videoPerParticipantMinuteUsd: Input;
  /** Our fee on a session a patient pays for. From `platform_settings`. */
  platformFeeCents: Input;
  platformFeeBps: Input;
  /** What a patient pays their therapist, which our percentage is taken of. */
  sessionPriceUsd: Input;
  /**
   * 🔴 C209 — the AI fee rides on the patient's consent, so revenue from it
   * scales with the rate at which consent is given. Measured by the run.
   */
  recordingConsentRate: Input;
  aiFeeUsdPerSession: Input;
  /** Stripe's own cut. **Test mode charges none, so this can never be measured here.** */
  paymentPercent: Input;
  paymentFixedUsd: Input;
};

/**
 * 🔴 Growth that can change, because a constant one is a lie in any scenario
 * with a funding round in it.
 *
 * The funded scenario hires a salesperson in month 7 and starts paid
 * acquisition in the same month. A single `therapistsAddedPerMonth` applied the
 * post-money growth rate from month two, which broke even four months before
 * the money that bought the growth arrived. Same shape as `CostLine`: a number
 * and the month it starts.
 */
export type GrowthStep = { fromMonth: number; perMonth: number };

/** How many people there are, and how fast that changes. All assumed. */
export type Market = {
  startingTherapists: Input;
  /** The steady rate. Overridden from `fromMonth` by any step below it. */
  therapistsAddedPerMonth: Input;
  /** Ramps, applied from their month onward. Latest applicable step wins. */
  growthSteps?: GrowthStep[];
  /** Monthly, as a fraction. 0.05 is five in a hundred leaving each month. */
  therapistChurnMonthly: Input;
  patientsPerTherapist: Input;
  sessionsPerPatientPerMonth: Input;
  /** The first completed session with each therapist is free. A real cost. */
  freeSessionsPerNewTherapist: Input;
};

/** What we charge, read from the product rather than invented. */
export type Pricing = {
  /** Blended monthly subscription across the tier mix, in dollars. */
  blendedSubscriptionUsd: Input;
  /** What share of therapists pay a monthly fee at all. */
  payingShare: Input;
};

/** One person, from the month they start. */
export type Hire = {
  role: string;
  startMonth: number;
  monthlyUsd: number;
  /** Employer taxes and benefits, as a fraction on top of salary. */
  burden: number;
};

/** One recurring cost, from a month, optionally to a month. */
export type CostLine = {
  label: string;
  monthlyUsd: number;
  startMonth: number;
  endMonth?: number;
  /**
   * 🔴 Growth costs grow. `perTherapist` scales the line with headcount of
   * clinicians rather than holding it flat, which is what hosting actually does.
   */
  perTherapistUsd?: number;
};

export type Money = {
  openingCashUsd: Input;
  /** A round: how much, which month, and what it is earmarked for. */
  fundingUsd: Input;
  fundingMonth: Input;
  /**
   * 🔴 Allocation is presentational, not arithmetic. The money is fungible and
   * the runway is the runway; this splits it for the slide, and the model says
   * so rather than pretending an earmark changes the cash.
   */
  allocation: { label: string; share: number }[];
};

export type Flags = {
  /** Flag a therapist whose model spend passes this in any calendar month. */
  aiPerTherapistMonthlyUsd: Input;
};

export type Assumptions = {
  name: string;
  /** 36 by default. The founder asked for three years. */
  months: number;
  unit: UnitEconomics;
  market: Market;
  pricing: Pricing;
  people: Hire[];
  costs: CostLine[];
  money: Money;
  flags: Flags;
};

/* ---------------------------------------------------------------- reading -- */

/** Every `Input` in an assumption set, flattened, for the provenance summary. */
export function inputsOf(a: Assumptions): { path: string; input: Input }[] {
  const out: { path: string; input: Input }[] = [];
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === "object" && "from" in value && "value" in value) {
        out.push({ path: `${prefix}${key}`, input: value as Input });
      }
    }
  };
  walk(a.unit as unknown as Record<string, unknown>, "unit.");
  walk(a.market as unknown as Record<string, unknown>, "market.");
  walk(a.pricing as unknown as Record<string, unknown>, "pricing.");
  walk(a.money as unknown as Record<string, unknown>, "money.");
  walk(a.flags as unknown as Record<string, unknown>, "flags.");
  return out;
}

/** How much of this forecast rests on something somebody measured. */
export function provenanceSplit(a: Assumptions): Record<Provenance, number> {
  const split: Record<Provenance, number> = { measured: 0, assumed: 0, derived: 0 };
  for (const { input } of inputsOf(a)) split[input.from]++;
  return split;
}
