/**
 * 🔴 W2-S10 / F7: THE COMPANY'S MONEY LEDGER, AS PERIODS, NEVER AS SESSIONS.
 *
 * The first build published one row per pot-funded session, with its price and
 * the employee's share, in batches of at least `activityFloor` ENTRIES. An
 * independent review broke it twice over: five entries can be one person, and
 * a row with a price and a share is one person's session whatever week it is
 * dated. So a company now sees, per period (a week, or several weeks merged),
 * the total its pot spent and the number of sessions, and only for a period in
 * which at least `floor` DISTINCT PEOPLE were funded. A period short of that is
 * merged into the next; what is still short at the end is "held back for
 * privacy" and shown only as part of a reconciliation line. Never a price,
 * never an employee share, never a row per session.
 *
 * The rows come from `sponsor_money_entries`, which carries no name, therapist,
 * session or date finer than the week. Its `person_tag` is a keyed digest used
 * here ONLY to count distinct people; it never leaves this module's inputs.
 *
 * ## 🔴 The floor has a hard minimum of five
 *
 * `SPONSOR_FLOOR_MIN` is enforced in the settings parser AND here, so a stored
 * value of 2 (from before F7) still reads as 5 on every company screen.
 */

export type LedgerEntry = {
  kind: "session" | "refund";
  /** The Monday of the week it was paid, `YYYY-MM-DD`. The finest date there is. */
  weekStart: string;
  coverageBps: number;
  coveredCents: number;
  /**
   * 🔴 F7: a keyed digest of the person, for COUNTING distinct people only.
   * Null on rows written before 0186: every null in a period counts as ONE
   * person between them, the safe direction (fewer people, more held back).
   */
  personTag: string | null;
};

export type LedgerPublishing = "weekly" | "live";

/** 🔴 F7: the reporting floor can never be set below this. People, not entries. */
export const SPONSOR_FLOOR_MIN = 5;

/** The floor actually applied: the setting, never below `SPONSOR_FLOOR_MIN`. */
export function privacyFloor(setting: number): number {
  return Math.max(SPONSOR_FLOOR_MIN, Number.isFinite(setting) ? Math.floor(setting) : SPONSOR_FLOOR_MIN);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Monday (UTC) of the week `at` falls in, as `YYYY-MM-DD`. */
export function weekStartOf(at: Date): string {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const isoDay = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
  return new Date(day.getTime() - (isoDay - 1) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The newest week a company may see: the last week that has ENDED.
 *
 * DD-2 B1: the current week is never shown, whatever `ledgerPublishing` says.
 * An incomplete week at a small company is a person seen booking. `live` is
 * kept as a stored value so old settings still parse, and reads as weekly.
 */
export function lastCompleteWeek(now: Date): string {
  const thisWeek = weekStartOf(now);
  return new Date(Date.parse(`${thisWeek}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
}

/** Kept for its callers; the mode no longer opens the current week. */
export function lastPublishedWeek(_mode: LedgerPublishing, now: Date): string {
  return lastCompleteWeek(now);
}

/** The Monday after `week` (`YYYY-MM-DD`), as an instant. */
export function weekAfter(week: string): Date {
  return new Date(Date.parse(`${week}T00:00:00Z`) + 7 * DAY_MS);
}

/** How many different people these entries are. Untagged rows count as one between them. */
export function distinctPeople(entries: LedgerEntry[]): number {
  const tags = new Set<string>();
  let untagged = false;
  for (const entry of entries) {
    if (entry.personTag) tags.add(entry.personTag);
    else untagged = true;
  }
  return tags.size + (untagged ? 1 : 0);
}

/** A session counts one, a refund takes one back; spend likewise. */
function sessionsIn(entries: LedgerEntry[]): number {
  return entries.reduce((n, entry) => n + (entry.kind === "refund" ? -1 : 1), 0);
}

function spendIn(entries: LedgerEntry[]): number {
  return entries.reduce((n, e) => n + (e.kind === "refund" ? -e.coveredCents : e.coveredCents), 0);
}

/**
 * 🔴 ONE REPORTED PERIOD. The whole shape a company's ledger is made of: two
 * dates and two totals. No price, no share, no person count, no row per session.
 */
export type LedgerPeriod = {
  /** `YYYY-MM-DD`, the first week (or `YYYY-MM`, the first month) in the period. */
  from: string;
  /** The last week (or month) in it; equal to `from` for a single one. */
  to: string;
  sessions: number;
  spendCents: number;
};

export type HeldBack = { sessions: number; spendCents: number };

export type LedgerUnit = "week" | "month";

/**
 * 🔴 F7: GATHER WEEKS INTO PERIODS OF AT LEAST `floor` PEOPLE.
 *
 * Oldest first, each week is added to the open period; the period is reported
 * once the DISTINCT people in it reach the floor (`privacyFloor`). A short
 * period is merged forward rather than dropped (a dropped one could be
 * recovered by subtracting the shown ones from a total). What is still short
 * at the end is returned as `heldBack`, a total for the reconciliation line.
 *
 * 🔴 Review fix: THE MONTH VIEW IS BUILT FROM THE PUBLISHED WEEKS, NEVER FROM
 * THE ENTRIES. Each view used to merge up to the floor on its own, so a month
 * could clear the floor while its last weeks were still held back, and "the
 * month minus the weeks shown inside it" printed those held-back weeks alone,
 * which can be one person. Now a month is the sum of whole weekly periods that
 * are already published (`monthsFromWeeks`), and the held-back figure is the
 * same one total in both views. So any difference between two published
 * figures, in either view, is a sum of whole published weekly periods, each of
 * which already cleared the floor, and never a group below it.
 */
export function ledgerPeriods(
  entries: LedgerEntry[],
  floorSetting: number,
  unit: LedgerUnit = "week",
): { periods: LedgerPeriod[]; heldBack: HeldBack | null } {
  const floor = privacyFloor(floorSetting);
  const byKey = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    byKey.set(entry.weekStart, [...(byKey.get(entry.weekStart) ?? []), entry]);
  }
  const periods: LedgerPeriod[] = [];
  let open: LedgerEntry[] = [];
  let first: string | null = null;
  for (const key of [...byKey.keys()].sort()) {
    first ??= key;
    open.push(...byKey.get(key)!);
    if (distinctPeople(open) < floor) continue;
    periods.push({ from: first, to: key, sessions: sessionsIn(open), spendCents: spendIn(open) });
    open = [];
    first = null;
  }
  const heldBack = open.length > 0 ? { sessions: sessionsIn(open), spendCents: spendIn(open) } : null;
  return { periods: unit === "month" ? monthsFromWeeks(periods) : periods, heldBack };
}

/**
 * 🔴 Review fix: THE MONTHS, AS SUMS OF WHOLE PUBLISHED WEEKLY PERIODS.
 *
 * A weekly period belongs to the month its LAST week starts in, so a period
 * that runs across a month end is counted once, in the later month, whose
 * `from` then names the earlier month honestly. Nothing here reads an entry:
 * a month can only ever say what the weekly view already says, added up.
 */
export function monthsFromWeeks(weeks: LedgerPeriod[]): LedgerPeriod[] {
  const months: LedgerPeriod[] = [];
  for (const week of [...weeks].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))) {
    const month = week.to.slice(0, 7);
    const last = months.at(-1);
    if (last && last.to === month) {
      last.sessions += week.sessions;
      last.spendCents += week.spendCents;
    } else {
      months.push({ from: week.from.slice(0, 7), to: month, sessions: week.sessions, spendCents: week.spendCents });
    }
  }
  return months;
}

/* ------------------------------------------------------ filters and sorting -- */

export const LEDGER_SORTS = ["week", "sessions", "spend"] as const;
export type LedgerSort = (typeof LEDGER_SORTS)[number];

export type LedgerQuery = {
  /** `YYYY-MM`, inclusive, by the months a period starts and ends in. */
  from: string | null;
  to: string | null;
  by: LedgerUnit;
  sort: LedgerSort;
  dir: "asc" | "desc";
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** From a URL's search params. Anything malformed is ignored, never an error. */
export function parseLedgerQuery(params: Record<string, string | undefined>): LedgerQuery {
  return {
    from: params.from && MONTH.test(params.from) ? params.from : null,
    to: params.to && MONTH.test(params.to) ? params.to : null,
    by: params.by === "month" ? "month" : "week",
    sort: LEDGER_SORTS.find((key) => key === params.sort) ?? "week",
    dir: params.dir === "asc" ? "asc" : "desc",
  };
}

/**
 * Filters pick whole PERIODS, each already over the floor, so no filter can
 * narrow the view to a small group: there is nothing smaller than a period.
 */
export function filterPeriods(periods: LedgerPeriod[], query: LedgerQuery): LedgerPeriod[] {
  return periods.filter((period) => {
    if (query.from && period.from.slice(0, 7) < query.from) return false;
    if (query.to && period.to.slice(0, 7) > query.to) return false;
    return true;
  });
}

export function sortPeriods(periods: LedgerPeriod[], query: LedgerQuery): LedgerPeriod[] {
  const key = (p: LedgerPeriod): number | string =>
    query.sort === "sessions" ? p.sessions : query.sort === "spend" ? p.spendCents : p.from;
  const sign = query.dir === "asc" ? 1 : -1;
  return [...periods].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka < kb) return -sign;
    if (ka > kb) return sign;
    return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
  });
}

/* --------------------------------------------------------------- analytics -- */

export type LedgerAnalytics = {
  /** Totals across the REPORTED periods only. Null when no period is reported. */
  sessions: number | null;
  spendCents: number | null;
  coverageMix: { coverageBps: number; sessions: number | null }[];
  topUps: { count: number; totalCents: number };
  /** Average spend a month over the last three reported months. */
  burnCents: number | null;
  /** Whole months the published balance lasts at that burn. */
  runwayMonths: number | null;
};

export function ledgerAnalytics(input: {
  entries: LedgerEntry[];
  floor: number;
  /** The published balance (C377), or null while it is suppressed. */
  balanceCents: number | null;
  topUps: { amountCents: number }[];
}): LedgerAnalytics {
  const floor = privacyFloor(input.floor);
  const { periods } = ledgerPeriods(input.entries, floor, "week");
  /* Review fix: the burn reads the same published weeks, summed by month. */
  const months = monthsFromWeeks(periods);
  const reported = periods.length > 0;
  /* DD-2 B1: the coverage mix counts only weeks already published, never held-back ones. */
  const publishedThrough = periods.at(-1)?.to ?? null;
  const published = input.entries.filter(
    (entry) => publishedThrough !== null && entry.weekStart <= publishedThrough,
  );

  /* A coverage bucket is a count over people too, so it has the same floor. */
  const buckets = new Map<number, LedgerEntry[]>();
  for (const entry of published) {
    buckets.set(entry.coverageBps, [...(buckets.get(entry.coverageBps) ?? []), entry]);
  }
  const coverageMix = [...buckets.keys()]
    .sort((a, b) => b - a)
    .map((coverageBps) => {
      const rows = buckets.get(coverageBps)!;
      return { coverageBps, sessions: distinctPeople(rows) >= floor ? sessionsIn(rows) : null };
    });

  const recent = months.slice(-3);
  const burnCents =
    recent.length > 0 ? Math.round(recent.reduce((n, m) => n + m.spendCents, 0) / recent.length) : null;
  const runwayMonths =
    burnCents && burnCents > 0 && input.balanceCents !== null
      ? Math.max(0, Math.floor(input.balanceCents / burnCents))
      : null;

  return {
    sessions: reported ? periods.reduce((n, p) => n + p.sessions, 0) : null,
    spendCents: reported ? periods.reduce((n, p) => n + p.spendCents, 0) : null,
    coverageMix,
    topUps: {
      count: input.topUps.length,
      totalCents: input.topUps.reduce((n, t) => n + t.amountCents, 0),
    },
    burnCents,
    runwayMonths,
  };
}

/* ------------------------------------------------- the one company view -- */

/**
 * DD-2 B1: WHAT EVERY COMPANY SURFACE MAY SHOW, FROM ONE FUNCTION.
 *
 * The overview chart, its totals, the balance, the ledger page and its CSV all
 * read this. Entries are cut at the last complete week, weeks are published
 * only as periods of at least `floor` DIFFERENT people, and the chart marks
 * every other week as held back (null, never zero). So one heavy user cannot
 * be picked out of any of them.
 */
export type CompanyView = {
  /** The last complete week; nothing newer is read. */
  through: string;
  floor: number;
  weeks: LedgerPeriod[];
  months: LedgerPeriod[];
  heldBack: HeldBack | null;
  /** The last week of the last published period, or null when none is. */
  publishedThrough: string | null;
  /** The overview chart: a week's spend only where a period closes, else null. */
  series: { weekStart: string; spendCents: number | null }[];
  stats: LedgerAnalytics;
};

export function companyView(input: {
  entries: LedgerEntry[];
  floor: number;
  now: Date;
  balanceCents?: number | null;
  topUps?: { amountCents: number }[];
}): CompanyView {
  const floor = privacyFloor(input.floor);
  const through = lastCompleteWeek(input.now);
  const entries = input.entries.filter((entry) => entry.weekStart <= through);
  const { periods, heldBack } = ledgerPeriods(entries, floor, "week");
  const closing = new Map(periods.map((period) => [period.to, period.spendCents]));
  const series = [...new Set(entries.map((entry) => entry.weekStart))]
    .sort()
    .map((weekStart) => ({ weekStart, spendCents: closing.get(weekStart) ?? null }));
  return {
    through,
    floor,
    weeks: periods,
    months: monthsFromWeeks(periods),
    heldBack,
    publishedThrough: periods.at(-1)?.to ?? null,
    series,
    stats: ledgerAnalytics({
      entries,
      floor,
      balanceCents: input.balanceCents ?? null,
      topUps: input.topUps ?? [],
    }),
  };
}

/**
 * 🔴 F7: THE OVERVIEW AND THE LEDGER ADD UP, VISIBLY.
 *
 * The overview prints the published pot totals (every pot-funded session); the
 * ledger prints only periods that clear the people floor. The difference is
 * what is not broken down: held back for privacy, paid this week and not yet
 * published, or refunded. Both figures are already on the company's screens,
 * so the line adds no information; it makes the two agree in front of them.
 * Null when there is nothing to reconcile or the overview is behind (its total
 * is published in floor-sized steps).
 */
export function reconcile(
  overview: { sessions: number; spentCents: number } | null,
  reported: { sessions: number | null; spendCents: number | null },
): HeldBack | null {
  if (!overview) return null;
  const sessions = overview.sessions - (reported.sessions ?? 0);
  const spendCents = overview.spentCents - (reported.spendCents ?? 0);
  if (sessions < 0 || spendCents < 0 || (sessions === 0 && spendCents === 0)) return null;
  return { sessions, spendCents };
}

/* --------------------------------------------------------------------- CSV -- */

/**
 * The export's rows, header first: a period, its sessions and its spend, never
 * a price or an employee share. Amounts are NUMBERS in the major unit; every
 * cell still goes through `csvCell` (W1-19) on its way out.
 */
export function ledgerCsvRows(
  periods: LedgerPeriod[],
  /** In the reader's language: period, sessions, spent. */
  header: string[],
): (string | number)[][] {
  return [
    header,
    ...periods.map((p) => [p.from === p.to ? p.from : `${p.from}/${p.to}`, p.sessions, p.spendCents / 100]),
  ];
}
