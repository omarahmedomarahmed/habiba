/**
 * 🔴 W2-S10 / FIX-PLAN D1 — THE COMPANY'S MONEY LEDGER, AS ARITHMETIC.
 *
 * The founder's decision: a company sees every pot-funded session's money entry
 * (price, coverage, covered amount, the employee's share) with analytics,
 * filters, sorting and a CSV, and never a name, a therapist or a specialty.
 * The rows come from `sponsor_money_entries`, which carries none of those and no
 * date finer than the week; this file is what is done with them, pure, so every
 * rule here is a test rather than a paragraph.
 *
 * ## 🔴 The reporting floor is on EVERY aggregate
 *
 * `sponsor.activityFloor` (C229) governs each figure computed across entries:
 * a month below it is rolled into the next, as `applyActivityFloor` does for
 * weeks; an average, a total or a coverage bucket over fewer entries than the
 * floor is null, which is "not enough to report", never zero. Top-ups are the
 * company's own acts and name nobody, so they are shown as they are.
 */

export type LedgerEntry = {
  kind: "session" | "refund";
  /** The Monday of the week it was paid, `YYYY-MM-DD`. The finest date there is. */
  weekStart: string;
  priceCents: number;
  coverageBps: number;
  coveredCents: number;
  employeeCents: number;
  /** Random at insert. The order within a batch, so row order carries no time. */
  shuffle: number;
};

export type LedgerPublishing = "weekly" | "live";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Monday (UTC) of the week `at` falls in, as `YYYY-MM-DD`. */
export function weekStartOf(at: Date): string {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const isoDay = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
  return new Date(day.getTime() - (isoDay - 1) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The newest week a company may see. Weekly: the last week that has ENDED, so
 * a week's entries arrive together, shuffled, the Monday after. Live: this
 * week, as each is paid (still dated by the week).
 */
export function lastPublishedWeek(mode: LedgerPublishing, now: Date): string {
  const thisWeek = weekStartOf(now);
  if (mode === "live") return thisWeek;
  return new Date(Date.parse(`${thisWeek}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
}

/* ------------------------------------------------------ filters and sorting -- */

export const LEDGER_SORTS = ["week", "price", "coverage", "covered", "employee"] as const;
export type LedgerSort = (typeof LEDGER_SORTS)[number];

export type LedgerQuery = {
  /** `YYYY-MM`, inclusive, by the month the entry's week starts in. */
  from: string | null;
  to: string | null;
  /** Basis points, one value, or null for every coverage. */
  coverage: number | null;
  /** Price bounds in cents, inclusive. */
  minCents: number | null;
  maxCents: number | null;
  sort: LedgerSort;
  dir: "asc" | "desc";
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function cents(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const dollars = Number(value);
  return Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : null;
}

/** From a URL's search params. Anything malformed is ignored, never an error. */
export function parseLedgerQuery(params: Record<string, string | undefined>): LedgerQuery {
  const coverage = params.coverage?.trim() ? Number(params.coverage) : NaN;
  const sort = LEDGER_SORTS.find((key) => key === params.sort) ?? "week";
  return {
    from: params.from && MONTH.test(params.from) ? params.from : null,
    to: params.to && MONTH.test(params.to) ? params.to : null,
    coverage:
      Number.isInteger(coverage) && coverage >= 0 && coverage <= 100 ? coverage * 100 : null,
    minCents: cents(params.min),
    maxCents: cents(params.max),
    sort,
    dir: params.dir === "asc" ? "asc" : "desc",
  };
}

export function filterLedger(entries: LedgerEntry[], query: LedgerQuery): LedgerEntry[] {
  return entries.filter((entry) => {
    const month = entry.weekStart.slice(0, 7);
    if (query.from && month < query.from) return false;
    if (query.to && month > query.to) return false;
    if (query.coverage !== null && entry.coverageBps !== query.coverage) return false;
    if (query.minCents !== null && entry.priceCents < query.minCents) return false;
    if (query.maxCents !== null && entry.priceCents > query.maxCents) return false;
    return true;
  });
}

/**
 * 🔴 Sorted by what the company asked, and ties broken by the SHUFFLE, never by
 * insertion. Two entries in one week with the same price would otherwise come
 * out in the order they were paid, which is the timing a batch exists to hide.
 */
export function sortLedger(entries: LedgerEntry[], query: LedgerQuery): LedgerEntry[] {
  const key = (entry: LedgerEntry): number | string => {
    switch (query.sort) {
      case "price":
        return entry.priceCents;
      case "coverage":
        return entry.coverageBps;
      case "covered":
        return entry.coveredCents;
      case "employee":
        return entry.employeeCents;
      default:
        return entry.weekStart;
    }
  };
  const sign = query.dir === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka < kb) return -sign;
    if (ka > kb) return sign;
    return a.shuffle - b.shuffle;
  });
}

/* --------------------------------------------------------------- analytics -- */

/** A session counts one, a refund takes one back; spend likewise. */
function sessionsIn(entries: LedgerEntry[]): number {
  return entries.reduce((n, entry) => n + (entry.kind === "refund" ? -1 : 1), 0);
}

function sum(entries: LedgerEntry[], pick: (entry: LedgerEntry) => number): number {
  return entries.reduce((n, entry) => n + (entry.kind === "refund" ? -pick(entry) : pick(entry)), 0);
}

export type MonthFigure = {
  /** `YYYY-MM`. */
  month: string;
  /** Null is SUPPRESSED, not zero: rolled forward into the next reported month. */
  spendCents: number | null;
  sessions: number | null;
};

export type LedgerAnalytics = {
  months: MonthFigure[];
  sessions: number | null;
  spendCents: number | null;
  averagePriceCents: number | null;
  employeeShareCents: number | null;
  coverageMix: { coverageBps: number; sessions: number | null }[];
  topUps: { count: number; totalCents: number };
  /** Average covered spend a month over the last three reported months. */
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
  const { entries, floor } = input;

  /*
   * Months in order, each rolled forward until it clears the floor, exactly
   * as `applyActivityFloor` does for weeks: a dropped month could be recovered
   * by subtracting the shown ones from a total, a rolled one cannot.
   */
  const byMonth = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const month = entry.weekStart.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), entry]);
  }
  const months: MonthFigure[] = [];
  let carriedSpend = 0;
  let carriedSessions = 0;
  for (const month of [...byMonth.keys()].sort()) {
    const rows = byMonth.get(month)!;
    carriedSpend += sum(rows, (entry) => entry.coveredCents);
    carriedSessions += sessionsIn(rows);
    if (carriedSessions >= floor) {
      months.push({ month, spendCents: carriedSpend, sessions: carriedSessions });
      carriedSpend = 0;
      carriedSessions = 0;
    } else {
      months.push({ month, spendCents: null, sessions: null });
    }
  }

  const total = sessionsIn(entries);
  const reportable = total >= floor;

  const buckets = new Map<number, LedgerEntry[]>();
  for (const entry of entries) {
    buckets.set(entry.coverageBps, [...(buckets.get(entry.coverageBps) ?? []), entry]);
  }
  const coverageMix = [...buckets.keys()]
    .sort((a, b) => b - a)
    .map((coverageBps) => {
      const n = sessionsIn(buckets.get(coverageBps)!);
      return { coverageBps, sessions: n >= floor ? n : null };
    });

  const reported = months.filter((m) => m.spendCents !== null).slice(-3);
  const burnCents =
    reported.length > 0
      ? Math.round(reported.reduce((n, m) => n + (m.spendCents ?? 0), 0) / reported.length)
      : null;
  const runwayMonths =
    burnCents && burnCents > 0 && input.balanceCents !== null
      ? Math.max(0, Math.floor(input.balanceCents / burnCents))
      : null;

  return {
    months,
    sessions: reportable ? total : null,
    spendCents: reportable ? sum(entries, (entry) => entry.coveredCents) : null,
    averagePriceCents: reportable
      ? Math.round(sum(entries, (entry) => entry.priceCents) / Math.max(1, total))
      : null,
    employeeShareCents: reportable ? sum(entries, (entry) => entry.employeeCents) : null,
    coverageMix,
    topUps: {
      count: input.topUps.length,
      totalCents: input.topUps.reduce((n, t) => n + t.amountCents, 0),
    },
    burnCents,
    runwayMonths,
  };
}

/* --------------------------------------------------------------------- CSV -- */

/**
 * The export's rows, header first. Amounts are NUMBERS in dollars, so a refund's
 * negative is a number a spreadsheet sums rather than text it escapes; every
 * cell still goes through `csvCell` (W1-19) on its way out.
 */
export function ledgerCsvRows(
  entries: LedgerEntry[],
  /** In the reader's language: week, kind, price, coverage %, covered, employee share. */
  header: string[],
  kindLabel: (kind: LedgerEntry["kind"]) => string,
): (string | number)[][] {
  return [
    header,
    ...entries.map((entry) => {
      const sign = entry.kind === "refund" ? -1 : 1;
      return [
        entry.weekStart,
        kindLabel(entry.kind),
        entry.priceCents / 100,
        entry.coverageBps / 100,
        (sign * entry.coveredCents) / 100,
        (sign * entry.employeeCents) / 100,
      ];
    }),
  ];
}
