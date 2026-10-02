import "server-only";

import { and, eq, lte } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { sponsorMoneyEntries } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import {
  companyView,
  lastCompleteWeek,
  type HeldBack,
  type LedgerAnalytics,
  type LedgerPeriod,
} from "@/lib/sponsor/ledger";

/**
 * 🔴 W2-S10 / F7: THE COMPANY'S MONEY VIEW. C244'S ONE EXCEPTION, AS PERIODS.
 *
 * C244 forbids company reporting from joining sessions, dates or names. The
 * founder's decision of 2026-09-24 makes one exception, narrowed by F7 (the
 * independent due diligence): a company sees, per week or month, what its pot
 * spent and how many sessions it paid for, and only for a period in which at
 * least the reporting floor's worth of DIFFERENT people were funded. Never a
 * row per session, never a price, never the employee's share.
 *
 * ## 🔴 This file reads ONE table, joins NOTHING, and returns NO ENTRY
 *
 * `sponsor_money_entries` has no session, person, therapist or payment id and
 * no date finer than the week. Its `person_tag` is a keyed digest read here
 * only so `ledgerPeriods` can count distinct people; what this function returns
 * is periods and totals, so neither the tag nor any one session's money ever
 * reaches a page, a CSV or a log. `verify:sprint49` and
 * `tests/company-portal.test.ts` assert this file names no other table.
 */
export type PublishedLedger = {
  weeks: LedgerPeriod[];
  months: LedgerPeriod[];
  /** The trailing weeks still short of the floor. For the verifiers, never rendered. */
  heldBack: HeldBack | null;
  stats: LedgerAnalytics;
  through: string;
  publishing: "weekly" | "live";
  floor: number;
  /** DD-2 B1: the last week of the last published period, or null. */
  publishedThrough: string | null;
  /** DD-2 B1: the overview chart, from the same periods. */
  series: { weekStart: string; spendCents: number | null }[];
};

/**
 * DD-2 B1: the one reader behind every company surface (overview chart and
 * totals, balance, ledger page, CSV). The rules live in `companyView`.
 */
export async function publishedLedger(
  sponsorId: string,
  now = new Date(),
  context: { balanceCents: number | null; topUps: { amountCents: number }[] } = {
    balanceCents: null,
    topUps: [],
  },
): Promise<PublishedLedger> {
  const settings = await getSettings();
  const through = lastCompleteWeek(now);

  const rows = await controlDb
    .select({
      /* 🔴 THE WHOLE SELECT LIST. No price and no share are even read. */
      kind: sponsorMoneyEntries.kind,
      weekStart: sponsorMoneyEntries.weekStart,
      coverageBps: sponsorMoneyEntries.coverageBps,
      coveredCents: sponsorMoneyEntries.coveredCents,
      personTag: sponsorMoneyEntries.personTag,
    })
    .from(sponsorMoneyEntries)
    .where(
      and(eq(sponsorMoneyEntries.sponsorId, sponsorId), lte(sponsorMoneyEntries.weekStart, through)),
    )
    .limit(20_000);

  const view = companyView({
    entries: rows,
    floor: settings.sponsor.activityFloor,
    now,
    balanceCents: context.balanceCents,
    topUps: context.topUps,
  });
  return {
    weeks: view.weeks,
    months: view.months,
    heldBack: view.heldBack,
    stats: view.stats,
    through: view.through,
    publishing: settings.sponsor.ledgerPublishing,
    floor: view.floor,
    publishedThrough: view.publishedThrough,
    series: view.series,
  };
}
