import "server-only";

import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { fxQuotes } from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * Exchange rates, quoted once and honoured for an hour.
 *
 * PLAN.md 4.4. The rule exists for the patient: somebody shown "1,440 EGP" and
 * then charged a different number because the market moved between the page and
 * the card form has been quoted a price we did not keep. In a product where the
 * person paying is often in crisis at one in the morning, that is not a
 * rounding complaint.
 *
 * ## Where the rates come from, and what is honest about it today
 *
 * There is no rate provider wired up. `STATIC_RATES` below is a table of
 * indicative rates, and every quote it produces is stamped `source: "static"`
 * so that a payment made against one can be told apart from a payment made
 * against a real feed — in the row, afterwards, by anybody auditing.
 *
 * That is a deliberate seam rather than a stub to be forgotten: `fetchRate` is
 * the one function to replace, the quote table and the hour do not change, and
 * the `source` column is what proves which rows came from where. Sprint 14
 * ("adding a provider is configuration, not code") is where a real feed
 * belongs, alongside the payment providers it has to agree with.
 *
 * 🔴 **A static rate must not be used to settle a real payment in production.**
 * `quoteFor` refuses a pair it has no rate for rather than inventing one, so
 * the failure is a country that cannot be paid in yet — visible — rather than a
 * patient charged at a wrong number.
 */

/** How long a quote is good for. §3/4.4: one hour. */
export const QUOTE_TTL_MS = 60 * 60 * 1000;

/**
 * Indicative rates against USD, x1e6.
 *
 * Only currencies `country_settings` can actually name. A pair that is not here
 * is refused, which is the correct answer for "we have not set that country up
 * yet" and is why this map is short rather than a list of every ISO code.
 */
const STATIC_RATES: Record<string, number> = {
  usd: 1_000_000,
  // ~48 EGP to the dollar. Indicative, and stamped as such on every quote.
  egp: 48_000_000,
};

export type Quote = {
  base: string;
  quote: string;
  /** Units of quote per unit of base, x1e6. */
  rateMicro: number;
  quotedAt: Date;
  expiresAt: Date;
  source: string;
};

/**
 * The seam. Replace this with a provider call and nothing else changes.
 *
 * Returns null for a pair we cannot price, which `quoteFor` turns into a
 * refusal rather than a guess.
 */
async function fetchRate(base: string, quote: string): Promise<{ rateMicro: number; source: string } | null> {
  const from = STATIC_RATES[base];
  const to = STATIC_RATES[quote];
  if (from === undefined || to === undefined) return null;
  return { rateMicro: Math.round((to / from) * 1_000_000), source: "static" };
}

/**
 * A live quote for this pair, reusing one if it has not expired.
 *
 * Reuse is the point rather than an optimisation: two patients opening the pay
 * page a minute apart should see the same number, and a payment created from a
 * quote must be created from *that* quote rather than from a fresh call that
 * has drifted.
 *
 * An identity pair short-circuits without touching the table. Storing a row
 * saying a dollar is worth a dollar would be a row that can go stale.
 */
export async function quoteFor(base: string, quote: string): Promise<Quote | null> {
  const from = base.trim().toLowerCase();
  const to = quote.trim().toLowerCase();
  const now = new Date();

  if (from === to) {
    return {
      base: from,
      quote: to,
      rateMicro: 1_000_000,
      quotedAt: now,
      expiresAt: new Date(now.getTime() + QUOTE_TTL_MS),
      source: "identity",
    };
  }

  const [live] = await db
    .select()
    .from(fxQuotes)
    .where(
      and(
        eq(fxQuotes.baseCurrency, from),
        eq(fxQuotes.quoteCurrency, to),
        gt(fxQuotes.expiresAt, now),
      ),
    )
    .orderBy(desc(fxQuotes.quotedAt))
    .limit(1);

  if (live) {
    return {
      base: from,
      quote: to,
      rateMicro: live.rateMicro,
      quotedAt: live.quotedAt,
      expiresAt: live.expiresAt,
      source: live.source,
    };
  }

  const fetched = await fetchRate(from, to);
  if (!fetched) {
    log.warn("no exchange rate for pair", { base: from, quote: to });
    return null;
  }

  /*
   * Both timestamps from the same clock.
   *
   * `quoted_at` defaults to Postgres's `now()` and `expires_at` was being
   * computed from this process's `Date.now()`, so the stored window was an hour
   * plus or minus the skew between two machines. Caught by the sprint-4
   * verifier asserting the window is *exactly* an hour, which it was not.
   *
   * It matters more than the milliseconds suggest: the hour is a promise to the
   * patient, and a window derived from two clocks is a window nobody can
   * reproduce when asked why a quote expired early.
   */
  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS);
  const [row] = await db
    .insert(fxQuotes)
    .values({
      baseCurrency: from,
      quoteCurrency: to,
      rateMicro: fetched.rateMicro,
      source: fetched.source,
      quotedAt: now,
      expiresAt,
    })
    .returning();

  return {
    base: from,
    quote: to,
    rateMicro: row?.rateMicro ?? fetched.rateMicro,
    quotedAt: row?.quotedAt ?? now,
    expiresAt: row?.expiresAt ?? expiresAt,
    source: fetched.source,
  };
}
