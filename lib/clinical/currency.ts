/**
 * How old a clinical fact is allowed to be before it stops being news.
 * PLAN.md 33.3.
 *
 * ## 🔴 Ideation eight months ago is not ideation now
 *
 * That sentence is the whole sprint in one line, and it is the failure mode of
 * every "patient profile" feature ever built: a fact is extracted once, stored
 * as a string, and read forever afterwards as if it were true today. The
 * clinician opens a chart and sees "suicidal ideation" with no date on it, and
 * either treats a resolved episode as live — which is a wasted session and a
 * patient who feels un-listened-to — or learns to ignore the panel, which is
 * worse, because the day it *is* live they will ignore that too.
 *
 * So currency is computed, per domain, and shown beside every fact.
 *
 * ## Why this is pure and lives outside `lib/data`
 *
 * It takes a date and a domain and returns a label. No database, no request, no
 * clock of its own: `now` is a parameter, which is C84's rule (a value read
 * from the runtime is a value nobody can test) and makes the whole table below
 * assertable in a unit test rather than at four in the morning in March.
 */

/** How long a fact in this domain stays "current", in days. */
const HALF_LIFE_DAYS: Record<string, number | null> = {
  /*
   * 🔴 Thirty days for risk, and the number is deliberately short.
   *
   * A risk fact that has not been observed in a month is not evidence of
   * safety; it is evidence of nothing, and the honest display is "last
   * observed in March" rather than a red flag that has been on the chart since
   * March. The clinician asks again. That is the correct clinical behaviour
   * and the correct software behaviour at once.
   */
  risk: 30,
  /** Medication changes between appointments, constantly, without telling us. */
  medication: 90,
  /** Sleep, appetite, work, mood: the things a session is actually about. */
  presentation: 60,
  function: 90,
  goal: 90,
  social: 365,
  /*
   * A diagnosis does not expire on a timer.
   *
   * It is resolved by a clinician, superseded by another diagnosis, or it
   * stands. Ageing it out would quietly hide a standing diagnosis from a
   * clinician who has not seen this patient for a year, which is exactly the
   * person who most needs to see it.
   */
  diagnosis: null,
  history: null,
};

/** The default for a domain nobody has thought about yet. */
const DEFAULT_HALF_LIFE_DAYS = 180;

export function halfLifeDays(domain: string): number | null {
  return domain in HALF_LIFE_DAYS ? HALF_LIFE_DAYS[domain]! : DEFAULT_HALF_LIFE_DAYS;
}

export type Currency = {
  /** Days between when the fact was true and now. Negative is impossible. */
  ageDays: number;
  /** True when a reader may treat this as describing the present. */
  current: boolean;
  /** What the chart says beside it, in the reader's language. */
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 🔴 Measured from `effectiveAt`, not from when the row was written.
 *
 * A session in November describing ideation "last spring" produces a fact that
 * is eight months old the moment it is recorded. Ageing from `created_at`
 * would show it as today's news because today is when somebody typed it, which
 * is precisely the mistake this sprint exists to stop.
 *
 * `lastObservedAt` deliberately does NOT refresh currency either: mentioning an
 * old episode again does not make it recent. It refreshes the *record*, and the
 * fact stays as old as the thing it describes.
 */
export function currencyOf(
  fact: { domain: string; effectiveAt: Date | string },
  now: Date,
  locale = "en",
): Currency {
  const effective = fact.effectiveAt instanceof Date ? fact.effectiveAt : new Date(fact.effectiveAt);
  const ageDays = Math.max(0, Math.floor((now.getTime() - effective.getTime()) / DAY_MS));
  const limit = halfLifeDays(fact.domain);
  const current = limit === null || ageDays <= limit;

  return { ageDays, current, label: ageLabel(ageDays, current, locale) };
}

/**
 * The words, with the locale as a PARAMETER (C150).
 *
 * This renders on a clinician's chart and in the patient-facing record extract,
 * which are two contexts with two languages, so asking the runtime which one is
 * the bug that sprint already paid for.
 */
export function ageLabel(ageDays: number, current: boolean, locale = "en"): string {
  const arabic = locale === "ar";

  if (ageDays === 0) return arabic ? "اليوم" : "today";
  if (ageDays === 1) return arabic ? "أمس" : "yesterday";
  if (ageDays < 14) return arabic ? `منذ ${ageDays} يومًا` : `${ageDays} days ago`;

  if (ageDays < 60) {
    const weeks = Math.round(ageDays / 7);
    return arabic ? `منذ ${weeks} أسابيع` : `${weeks} weeks ago`;
  }

  const months = Math.round(ageDays / 30);
  if (months < 24) {
    const stale = current ? "" : arabic ? " (غير محدَّث)" : " (not current)";
    return arabic ? `منذ ${months} أشهر${stale}` : `${months} months ago${stale}`;
  }

  const years = Math.floor(ageDays / 365);
  const stale = current ? "" : arabic ? " (غير محدَّث)" : " (not current)";
  return arabic ? `منذ ${years} سنوات${stale}` : `over ${years} years ago${stale}`;
}

/**
 * 🔴 What a source is worth against another source. PLAN.md 33.2.
 *
 * Lower wins, and the number is CHECKed against `source_type` in the database
 * so a row cannot claim a rank its source does not have.
 *
 * ## The order, and where it differs from the plan
 *
 * PLAN.md 33.1 lists "clinician · document · AI · patient". This puts the
 * **patient above the model**. The reasoning is in §2 under C164; the short
 * version is that the commonest conflict this product will ever see is a
 * person saying "I stopped taking that in June" against an inference drawn
 * from a transcript that predates June, and resolving that in the model's
 * favour would be wrong every time. A model's output is the only source in the
 * list with no human behind it, and 33.2 already says it is never confirmed.
 */
export const SOURCE_PRIORITY = {
  clinician: 1,
  document: 2,
  patient: 3,
  ai: 4,
} as const;

export type FactSourceName = keyof typeof SOURCE_PRIORITY;

export function priorityOf(source: FactSourceName): number {
  return SOURCE_PRIORITY[source];
}

/** Can `challenger` overwrite `incumbent`, or only be recorded beside it? */
export function maySupersede(challenger: FactSourceName, incumbent: FactSourceName): boolean {
  return priorityOf(challenger) <= priorityOf(incumbent);
}
