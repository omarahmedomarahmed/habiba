/*
 * 🔴 76.53 — the COMPANY'S OWN RESULT, measured. super_admin only, never clinical.
 */
import "server-only";

import { sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";

import { capitalByMonth, otherCostsByMonth } from "./capital";
import { payrollByMonth, type PayrollMonth } from "./payroll";

/**
 * What every month actually cost and actually earned, counted out of rows.
 *
 * ## 🔴 THIS IS THE OTHER HALF OF `/admin/financial-model`, AND THE DANGEROUS ONE
 *
 * The forecast is thirty-six months of arithmetic over assumptions, and the
 * screen it sits on spends its first card telling you which inputs were measured
 * and which were guessed, because a forecast read as a fact is the oldest way a
 * company lies to itself.
 *
 * This table has the opposite failure mode, and it is worse, because it looks
 * like an accounting system and is not one. Everything on it is measured, so
 * nothing on it carries a badge saying "assumed" — and a reader will therefore
 * take the columns that are missing as zero rather than as unmeasured. So:
 *
 * 🔴 `NOT_MEASURED_HERE` is exported, is printed on the page beside the table
 * rather than under it, and every entry says what would have to happen for the
 * number to exist. A cost that is absent because nothing bills it is a different
 * thing from a cost that is absent because nobody wired it up, and the page has
 * to be able to tell a founder which.
 *
 * ## The sign convention, once, because getting it backwards is silent
 *
 * `lib/billing/ledger.ts`: a positive amount is a debit. Assets and expenses go
 * up with a positive number; liabilities and revenue go up with a NEGATIVE one.
 * So revenue is read as `-SUM(amount_cents)` and expense as `SUM(amount_cents)`,
 * and a sign error would show a profitable month as a loss of the same size.
 * `verify:actuals` asserts both directions against a known posting.
 *
 * ## Why it never joins
 *
 * Every figure below is its own aggregate over its own table, keyed by month.
 * One session with three model calls and two payments, joined, is one session
 * counted six times, and the total that comes out is wrong in a way that reads
 * as a busy month. Same rule as `/admin/usage/sessions`, and the same reason.
 */

/**
 * 🔴 WHAT THIS PAGE CANNOT SEE, stated on the page.
 *
 * Each entry names the cost and what would have to be true for it to appear.
 * "Nothing bills it" and "nobody wired it up" are both here, and they are
 * labelled, because they call for opposite responses.
 */
export const NOT_MEASURED_HERE = [
  {
    what: "Video, bank charges, hosting, software, an accountant",
    why: "nothing in the product buys any of them, so nothing posts them. They reach this page only for the months somebody typed them into Other costs below, and a month with no figure is a month nobody typed rather than a month with no costs.",
    fix: "type each month's figure in, the way salaries are typed",
  },
  {
    what: "Card fees",
    why: "there is no card rail in Egypt. Stripe is in test mode and charges nothing, so the zero in this column is real for this market and will stop being real the day cards open.",
    fix: "nothing, until cards open",
  },
  {
    what: "What a founder's time is worth",
    why: "two of the seven on the payroll are founders drawing the same $500 as everybody else. A wage bill that pays a founder a support salary understates what this company costs to run, and it flatters every month on this page by the difference.",
    fix: "nothing here. A real limit of this table, written down rather than corrected",
  },
  {
    what: "Tax on a profit",
    why: "there has not been one. VAT collected is held and shown separately because it was never ours; tax on a result has never been owed.",
    fix: "nothing, until a year closes in profit",
  },
] as const;

export type ActualMonth = {
  /** `YYYY-MM`. */
  month: string;
  /** 1-based position in the range, so it reads beside the forecast's month 1. */
  index: number;

  /* ------------------------------------------------------------- activity -- */
  sessions: number;
  therapists: number;
  patients: number;
  /** Sessions with a transcript, which is what the AI cost rides on. */
  recordedSessions: number;

  /* -------------------------------------------------------------- earned -- */
  /**
   * Our cut of a session. `platform_revenue` against a session payment, and
   * also against a `session`, which is what `postFeeNettedFromHeld` writes when
   * the fee comes out of a clinician's held earnings rather than off a card.
   * Both are the same money for the same reason, and leaving the second out
   * would make the session revenue column disagree with the sessions column
   * beside it for every clinician on the netting path.
   */
  sessionRevenueCents: number;
  /** Subscriptions and seats. `platform_revenue` against an invoice. */
  subscriptionRevenueCents: number;
  /** Everything else that landed in `platform_revenue`. */
  otherRevenueCents: number;
  revenueCents: number;

  /* --------------------------------------------------------------- spent -- */
  /** OpenAI, in microcents, because 91% of calls round to zero in whole cents. */
  aiCostMicrocents: number;
  /** Wages, from the payroll table. */
  payrollCents: number;
  headcount: number;
  /** `platform_expense`: whatever the product itself posted as a cost. */
  otherSpendCents: number;
  /** `fx_difference`: what a frozen rate cost when the money actually moved. */
  fxCents: number;
  /** Video, bank charges, hosting and the rest, typed in the way salaries are. */
  typedCostsCents: number;
  spendCents: number;

  /* -------------------------------------------------------------- result -- */
  netCents: number;
  /** Cash that moved this month, from the `cash` account. */
  cashMovedCents: number;
  /** What trading did to the balance, accumulated. **Not the bank balance.** */
  cashCents: number;

  /* ------------------------------------------------------------ the bank -- */
  /** Every contribution that had arrived by the end of this month. */
  capitalInCents: number;
  /** 🔴 Capital in, plus what trading did. What is actually in the account. */
  bankBalanceCents: number;
  /** VAT, clinicians' earnings and pot balances, accumulated. In the bank, not ours. */
  heldForOthersCents: number;
  /** 🔴 Bank balance minus held. The only figure that is safe to spend. */
  oursCents: number;

  /* ----------------------------------------------- money that is not ours -- */
  /** VAT collected and not yet remitted. Ours to hold, never ours to spend. */
  vatCollectedCents: number;
  /** What clinicians earned this month and we owe them. */
  owedToCliniciansCents: number;
  /** Net change in employer pot balances. Money a company has put in, unspent. */
  potMovementCents: number;
};

export type Actuals = {
  months: ActualMonth[];
  totals: {
    sessions: number;
    revenueCents: number;
    aiCostMicrocents: number;
    payrollCents: number;
    otherSpendCents: number;
    typedCostsCents: number;
    spendCents: number;
    netCents: number;
    capitalInCents: number;
  };
  /** The first month anything happened, or null when nothing has. */
  from: string | null;
  /** Months where more went out than came in. */
  lossMonths: number;
  /** The first month the net was positive, or null. */
  brokeEvenIn: string | null;
  /** 🔴 The four figures a founder opens this page to read. */
  position: Position;
};

/**
 * 🔴 WHERE THE COMPANY STANDS, WHICH IS FOUR NUMBERS AND NOT ONE.
 *
 * `/admin/financial-model` produces `cashUsd`, `runwayMonths` and
 * `deepestDeficitUsd` from assumptions. This produces the same shape from rows,
 * so the two screens can be read side by side rather than argued about.
 */
export type Position = {
  /** What is in the account: capital in, plus what trading did to it. */
  bankBalanceCents: number;
  /** Of that, what belongs to a tax authority, a clinician or an employer. */
  heldForOthersCents: number;
  /** Bank balance minus held. The only figure that is safe to spend. */
  oursCents: number;
  /** Everything put in, ever. */
  capitalInCents: number;
  /**
   * 🔴 THE AVERAGE MONTHLY LOSS OVER THE LAST THREE MONTHS, not the last one.
   *
   * One month is noise: a quarterly invoice, a month somebody joined, a month
   * with five Fridays. Three months is the shortest window in which a burn rate
   * is a rate rather than an anecdote, and it is what an investor asking "what
   * is your burn" means. Null when the trailing window made money, because a
   * burn rate for a profitable company is not a small number, it is not a
   * number, and printing zero would read as "we spend nothing".
   */
  monthlyBurnCents: number | null;
  /** How many months the trailing window covered, so the screen can say so. */
  burnWindowMonths: number;
  /**
   * 🔴 `oursCents / monthlyBurnCents`, and it is OURS rather than the balance.
   *
   * Dividing the whole bank balance by the burn is how a company with a large
   * VAT liability and three employers' unspent pots convinces itself it has a
   * year. Every one of those has somebody who can ask for it back.
   *
   * Null when there is no burn, and **negative ours reads as zero months**
   * rather than as a negative runway, because the answer to "how long does the
   * money last" when the money is already gone is none.
   */
  runwayMonths: number | null;
  /** The month `oursCents` was at its lowest, and what it was. */
  deepestCents: number;
  deepestMonth: string | null;
};

/** 1 cent = 1000 microcents. */
const CENTS_PER_MICRO = 1000;

/**
 * Every month from the first thing that happened to this one.
 *
 * 🔴 THE RANGE IS READ OUT OF THE DATA, not passed in. A caller that says "the
 * last six months" gets six months whether or not the business had six, and a
 * run that was aged backwards by a hundred and eighty days would fall entirely
 * outside it while the page reported zeroes with a straight face.
 */
export async function monthlyActuals(opts: { maxMonths?: number } = {}): Promise<Actuals> {
  const maxMonths = opts.maxMonths ?? 36;

  const months = await monthRange(maxMonths);
  if (months.length === 0) {
    /*
     * 🔴 CAPITAL IS READ EVEN WITH NO MONTHS, because money in the bank before
     * the first session is the normal state of a company that has not opened
     * yet, and reporting a balance of zero over it would be the same mistake
     * this whole change exists to fix, in the one month it is most likely.
     */
    const capital = await capitalByMonth([thisMonth()]);
    const capitalInCents = capital.get(thisMonth()) ?? 0;

    return {
      months: [],
      totals: {
        sessions: 0,
        revenueCents: 0,
        aiCostMicrocents: 0,
        payrollCents: 0,
        otherSpendCents: 0,
        typedCostsCents: 0,
        spendCents: 0,
        netCents: 0,
        capitalInCents,
      },
      from: null,
      lossMonths: 0,
      brokeEvenIn: null,
      position: {
        bankBalanceCents: capitalInCents,
        heldForOthersCents: 0,
        oursCents: capitalInCents,
        capitalInCents,
        monthlyBurnCents: null,
        burnWindowMonths: 0,
        runwayMonths: null,
        deepestCents: capitalInCents,
        deepestMonth: null,
      },
    };
  }

  const [activity, ledger, ai, payroll, capital, typed] = await Promise.all([
    activityByMonth(),
    ledgerByMonth(),
    aiCostByMonth(),
    payrollByMonth(months),
    capitalByMonth(months),
    otherCostsByMonth(),
  ]);

  let runningCash = 0;
  let runningHeld = 0;
  const rows: ActualMonth[] = months.map((month, i) => {
    const a = activity.get(month);
    const l = ledger.get(month);
    const p: PayrollMonth = payroll.get(month) ?? {
      month,
      headcount: 0,
      totalCents: 0,
      byQueue: {},
    };

    const sessionRevenueCents = l?.sessionRevenueCents ?? 0;
    const subscriptionRevenueCents = l?.subscriptionRevenueCents ?? 0;
    const otherRevenueCents = l?.otherRevenueCents ?? 0;
    const revenueCents = sessionRevenueCents + subscriptionRevenueCents + otherRevenueCents;

    const aiCostMicrocents = ai.get(month) ?? 0;
    const otherSpendCents = l?.expenseCents ?? 0;
    const fxCents = l?.fxCents ?? 0;

    /*
     * 🔴 THE AI COST IS ROUNDED ONCE, HERE, AND NOWHERE ELSE.
     *
     * Microcents are carried all the way to this line on purpose. Rounding each
     * call to a cent is what made the old usage table report nothing at all.
     */
    const aiCostCents = Math.round(aiCostMicrocents / CENTS_PER_MICRO);
    const typedCostsCents = typed.get(month) ?? 0;
    const spendCents = aiCostCents + p.totalCents + otherSpendCents + fxCents + typedCostsCents;

    const cashMovedCents = l?.cashCents ?? 0;
    runningCash += cashMovedCents;

    /*
     * 🔴 THE THREE POTS OF SOMEBODY ELSE'S MONEY, ACCUMULATED.
     *
     * The table's `showHeld` columns are each month's MOVEMENT, which is the
     * right figure beside that month's trading. The balance question is
     * different and needs the total standing at the end: VAT collected since we
     * opened and not yet remitted, everything clinicians have earned and not
     * been paid, and every employer's unspent pot. All three sit in one bank
     * account, all three can be asked for, and none of them is runway.
     */
    runningHeld +=
      (l?.vatCents ?? 0) + (l?.therapistPayableCents ?? 0) + (l?.potCents ?? 0);

    const capitalInCents = capital.get(month) ?? 0;
    const bankBalanceCents = capitalInCents + runningCash;

    return {
      month,
      index: i + 1,
      sessions: a?.sessions ?? 0,
      therapists: a?.therapists ?? 0,
      patients: a?.patients ?? 0,
      recordedSessions: a?.recordedSessions ?? 0,
      sessionRevenueCents,
      subscriptionRevenueCents,
      otherRevenueCents,
      revenueCents,
      aiCostMicrocents,
      payrollCents: p.totalCents,
      headcount: p.headcount,
      otherSpendCents,
      fxCents,
      typedCostsCents,
      spendCents,
      netCents: revenueCents - spendCents,
      cashMovedCents,
      cashCents: runningCash,
      capitalInCents,
      bankBalanceCents,
      heldForOthersCents: runningHeld,
      oursCents: bankBalanceCents - runningHeld,
      vatCollectedCents: l?.vatCents ?? 0,
      owedToCliniciansCents: l?.therapistPayableCents ?? 0,
      potMovementCents: l?.potCents ?? 0,
    };
  });

  return {
    months: rows,
    totals: {
      sessions: sum(rows, (r) => r.sessions),
      revenueCents: sum(rows, (r) => r.revenueCents),
      aiCostMicrocents: sum(rows, (r) => r.aiCostMicrocents),
      payrollCents: sum(rows, (r) => r.payrollCents),
      otherSpendCents: sum(rows, (r) => r.otherSpendCents + r.fxCents),
      typedCostsCents: sum(rows, (r) => r.typedCostsCents),
      spendCents: sum(rows, (r) => r.spendCents),
      netCents: sum(rows, (r) => r.netCents),
      capitalInCents: rows.at(-1)!.capitalInCents,
    },
    from: rows[0]!.month,
    lossMonths: rows.filter((r) => r.netCents < 0).length,
    brokeEvenIn: rows.find((r) => r.netCents > 0)?.month ?? null,
    position: positionFrom(rows),
  };
}

/** `YYYY-MM` for right now, used only when the business has no months yet. */
function thisMonth(): string {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The four figures a founder opens this page for, off the rows above.
 *
 * 🔴 IT TAKES THE ROWS RATHER THAN QUERYING AGAIN, so the headline and the table
 * cannot disagree. A card that queries its own totals is a card that reads
 * differently from the table under it after somebody changes one of them, and
 * the reader has no way to tell which is right.
 *
 * 🔴 AND IT IS NOT EXPORTED. It was, and `verify:reachable` was right about it:
 * nothing outside this file calls it, and an exported function with no caller
 * is how `diariseSession` came to be unit-tested, benchmarked, documented and
 * wired to nothing for four sprints. Every caller reads `actuals.position`.
 */
function positionFrom(rows: ActualMonth[]): Position {
  const last = rows.at(-1);
  if (!last) {
    return {
      bankBalanceCents: 0,
      heldForOthersCents: 0,
      oursCents: 0,
      capitalInCents: 0,
      monthlyBurnCents: null,
      burnWindowMonths: 0,
      runwayMonths: null,
      deepestCents: 0,
      deepestMonth: null,
    };
  }

  /*
   * 🔴 THE TRAILING THREE MONTHS, OR FEWER IF THAT IS ALL THERE IS.
   *
   * A two-month-old company has a two-month window and the screen says so
   * rather than quietly dividing by three and reporting a burn a third of the
   * real one.
   */
  const window = rows.slice(-3);
  const windowNet = window.reduce((total, row) => total + row.netCents, 0);
  const monthlyBurnCents = windowNet < 0 ? Math.round(-windowNet / window.length) : null;

  const runwayMonths =
    monthlyBurnCents === null || monthlyBurnCents === 0
      ? null
      : Math.max(0, last.oursCents) / monthlyBurnCents;

  const deepest = rows.reduce((worst, row) => (row.oursCents < worst.oursCents ? row : worst), rows[0]!);

  return {
    bankBalanceCents: last.bankBalanceCents,
    heldForOthersCents: last.heldForOthersCents,
    oursCents: last.oursCents,
    capitalInCents: last.capitalInCents,
    monthlyBurnCents,
    burnWindowMonths: window.length,
    runwayMonths: runwayMonths === null ? null : Math.round(runwayMonths * 10) / 10,
    deepestCents: deepest.oursCents,
    deepestMonth: deepest.month,
  };
}

const sum = <T>(rows: T[], of: (row: T) => number): number =>
  rows.reduce((total, row) => total + of(row), 0);

/* ------------------------------------------------------------------ pieces */

/**
 * The months this business has had.
 *
 * 🔴 SIX SOURCES, AND THE EARLIEST WINS. A month with staff and no trading is
 * still a month that cost their salary, and a month with sessions and no money
 * is the shape of the first month of anything. Taking the range from the ledger
 * alone would silently drop both.
 *
 * 🔴 AND THE FIFTH IS CAPITAL, WHICH WAS FOUND BY LOOKING AT THE SCREEN.
 *
 * The founders put money in three months before the first session, and the page
 * said *"1 month, from 2026-09"* over a balance of $75,000 that had plainly not
 * arrived in one month. The company existed from the day its bank account was
 * funded, whatever the product was doing, and a range that starts at the first
 * session reports a business that sprang into being fully capitalised.
 *
 * The sixth is a typed-in cost, for the same reason: an accountancy bill in a
 * month with no sessions is a month this company had.
 */
async function monthRange(maxMonths: number): Promise<string[]> {
  const found = await db.execute<{ first: string | null }>(sql`
    SELECT to_char(LEAST(
      (SELECT MIN(created_at) FROM ledger_entries),
      (SELECT MIN(COALESCE(started_at, created_at)) FROM sessions),
      (SELECT MIN(created_at) FROM ai_request_logs),
      (SELECT MIN(started_on)::timestamptz FROM employees),
      (SELECT MIN(received_on)::timestamptz FROM capital_contributions),
      (SELECT MIN(month)::timestamptz FROM other_costs)
    ), 'YYYY-MM') AS first`);

  const first = found.rows[0]?.first ?? null;
  if (!first) return [];
  return monthsUpTo(first, new Date(), maxMonths);
}

/**
 * The months from `first` to `now`, the NEWEST `maxMonths` of them.
 *
 * 🔴 It kept the OLDEST: the loop walked forward from the first record and
 * stopped at the cap, so after three years the page ended at month 36 and
 * never showed the month the founder was living in. Walked the whole way,
 * then cut from the front; `verify:actuals` asks for two months and expects
 * this one last.
 */
function monthsUpTo(first: string, now: Date, maxMonths: number): string[] {
  const out: string[] = [];
  const [startYear, startMonth] = first.split("-").map(Number) as [number, number];

  let year = startYear;
  let month = startMonth;
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth() + 1;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return maxMonths > 0 ? out.slice(-maxMonths) : [];
}

type Activity = {
  sessions: number;
  therapists: number;
  patients: number;
  recordedSessions: number;
};

async function activityByMonth(): Promise<Map<string, Activity>> {
  /*
   * 🔴 COMPLETED ONLY. A cancelled session earned nothing and a scheduled one
   * has not happened, and counting either makes the sessions column disagree
   * with the revenue beside it for a reason nobody can find afterwards.
   *
   * `recordedSessions` is a correlated EXISTS rather than a join for the reason
   * at the top of this file: joining transcript segments would multiply the
   * session count by however many the session had.
   */
  const rows = await db.execute<{
    month: string;
    sessions: string;
    therapists: string;
    patients: string;
    recorded: string;
  }>(sql`
    SELECT to_char(date_trunc('month', COALESCE(s.started_at, s.created_at)), 'YYYY-MM') AS month,
           COUNT(*)::text AS sessions,
           COUNT(DISTINCT s.therapist_id)::text AS therapists,
           COUNT(DISTINCT s.patient_id)::text AS patients,
           COUNT(*) FILTER (
             WHERE EXISTS (SELECT 1 FROM transcript_segments t WHERE t.session_id = s.id)
           )::text AS recorded
      FROM sessions s
     WHERE s.status = 'completed'
     GROUP BY 1`);

  const out = new Map<string, Activity>();
  for (const row of rows.rows) {
    out.set(row.month, {
      sessions: Number(row.sessions),
      therapists: Number(row.therapists),
      patients: Number(row.patients),
      recordedSessions: Number(row.recorded),
    });
  }
  return out;
}

type LedgerMonth = {
  sessionRevenueCents: number;
  subscriptionRevenueCents: number;
  otherRevenueCents: number;
  expenseCents: number;
  fxCents: number;
  cashCents: number;
  vatCents: number;
  therapistPayableCents: number;
  potCents: number;
};

async function ledgerByMonth(): Promise<Map<string, LedgerMonth>> {
  /*
   * 🔴 ONE PASS OVER THE LEDGER, and every account named.
   *
   * The temptation is eight queries, one per account. The reason not to is that
   * a ninth account added later would be in none of them and in no total, and
   * nothing would fail: the page would simply stop adding up, slowly, in a
   * direction nobody chose. So the revenue split below is `ref_type`, which is
   * data, and `otherRevenueCents` catches whatever does not match rather than
   * dropping it.
   *
   * Revenue and liabilities are negated because a credit is negative here.
   */
  const rows = await db.execute<{
    month: string;
    session_revenue: string;
    subscription_revenue: string;
    other_revenue: string;
    expense: string;
    fx: string;
    cash: string;
    vat: string;
    payable: string;
    pot: string;
  }>(sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           COALESCE(-SUM(amount_cents) FILTER (
             WHERE account = 'platform_revenue' AND ref_type IN ('session_payment', 'session')), 0)::text
             AS session_revenue,
           COALESCE(-SUM(amount_cents) FILTER (
             WHERE account = 'platform_revenue' AND ref_type = 'invoice'), 0)::text
             AS subscription_revenue,
           COALESCE(-SUM(amount_cents) FILTER (
             WHERE account = 'platform_revenue'
               AND (ref_type IS NULL
                    OR ref_type NOT IN ('session_payment', 'session', 'invoice'))), 0)::text
             AS other_revenue,
           COALESCE(SUM(amount_cents) FILTER (WHERE account = 'platform_expense'), 0)::text AS expense,
           COALESCE(SUM(amount_cents) FILTER (WHERE account = 'fx_difference'), 0)::text AS fx,
           COALESCE(SUM(amount_cents) FILTER (WHERE account = 'cash'), 0)::text AS cash,
           COALESCE(-SUM(amount_cents) FILTER (WHERE account = 'vat_payable'), 0)::text AS vat,
           COALESCE(-SUM(amount_cents) FILTER (WHERE account = 'therapist_payable'), 0)::text AS payable,
           COALESCE(-SUM(amount_cents) FILTER (WHERE account = 'sponsor_pot'), 0)::text AS pot
      FROM ledger_entries
     GROUP BY 1`);

  const out = new Map<string, LedgerMonth>();
  for (const row of rows.rows) {
    out.set(row.month, {
      sessionRevenueCents: Number(row.session_revenue),
      subscriptionRevenueCents: Number(row.subscription_revenue),
      otherRevenueCents: Number(row.other_revenue),
      expenseCents: Number(row.expense),
      fxCents: Number(row.fx),
      cashCents: Number(row.cash),
      vatCents: Number(row.vat),
      therapistPayableCents: Number(row.payable),
      potCents: Number(row.pot),
    });
  }
  return out;
}

async function aiCostByMonth(): Promise<Map<string, number>> {
  const rows = await db.execute<{ month: string; micro: string }>(sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           COALESCE(SUM(cost_microcents), 0)::text AS micro
      FROM ai_request_logs
     GROUP BY 1`);

  const out = new Map<string, number>();
  for (const row of rows.rows) out.set(row.month, Number(row.micro));
  return out;
}
