import "server-only";

import { and, eq, lte } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { sponsorMoneyEntries } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { lastPublishedWeek, type LedgerEntry } from "@/lib/sponsor/ledger";

/**
 * 🔴 W2-S10 / FIX-PLAN D1 — THE COMPANY'S MONEY VIEW. C244'S ONE EXCEPTION.
 *
 * C244 forbids company reporting from joining sessions, dates or names. The
 * founder's decision of 2026-09-24 makes one exception: a company sees each
 * pot-funded session's money (price, coverage, covered amount, the employee's
 * share), with no employee, no therapist and no specialty.
 *
 * ## 🔴 This file reads ONE table and joins NOTHING
 *
 * `sponsor_money_entries` is written by `payFromPot` at the moment it freezes
 * the split, with no session, person, therapist or payment id and no date
 * finer than the week. So the join C244 forbids is made nowhere at read time,
 * and `verify:sprint49` and `tests/company-portal.test.ts` assert this file
 * names no other table: a column or a join added here is a failure.
 *
 * ## 🔴 Published in batches
 *
 * `sponsor.ledgerPublishing` decides the newest week returned: `weekly` (the
 * default) returns only weeks that have ended, so a week's entries appear
 * together the Monday after; `live` returns this week's as they are paid.
 */
export async function publishedLedger(
  sponsorId: string,
  now = new Date(),
): Promise<{ entries: LedgerEntry[]; through: string; publishing: "weekly" | "live" }> {
  const settings = await getSettings();
  const publishing = settings.sponsor.ledgerPublishing;
  const through = lastPublishedWeek(publishing, now);

  const rows = await controlDb
    .select({
      /* 🔴 THE WHOLE SELECT LIST. There is nothing else in the table to add. */
      kind: sponsorMoneyEntries.kind,
      weekStart: sponsorMoneyEntries.weekStart,
      priceCents: sponsorMoneyEntries.priceCents,
      coverageBps: sponsorMoneyEntries.coverageBps,
      coveredCents: sponsorMoneyEntries.coveredCents,
      employeeCents: sponsorMoneyEntries.employeeCents,
      shuffle: sponsorMoneyEntries.shuffle,
    })
    .from(sponsorMoneyEntries)
    .where(
      and(eq(sponsorMoneyEntries.sponsorId, sponsorId), lte(sponsorMoneyEntries.weekStart, through)),
    )
    .limit(20_000);

  return { entries: rows, through, publishing };
}
