import "server-only";

import { and, eq, lte } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { sponsorMoneyEntries } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import {
  lastPublishedWeek,
  ledgerAnalytics,
  ledgerPeriods,
  monthsFromWeeks,
  privacyFloor,
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
};

export async function publishedLedger(
  sponsorId: string,
  now = new Date(),
  context: { balanceCents: number | null; topUps: { amountCents: number }[] } = {
    balanceCents: null,
    topUps: [],
  },
): Promise<PublishedLedger> {
  const settings = await getSettings();
  const publishing = settings.sponsor.ledgerPublishing;
  const through = lastPublishedWeek(publishing, now);
  const floor = privacyFloor(settings.sponsor.activityFloor);

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

  const weekly = ledgerPeriods(rows, floor, "week");
  return {
    weeks: weekly.periods,
    /* Review fix: months are the published weeks summed, never merged on their own. */
    months: monthsFromWeeks(weekly.periods),
    heldBack: weekly.heldBack,
    stats: ledgerAnalytics({ entries: rows, floor, ...context }),
    through,
    publishing,
    floor,
  };
}
