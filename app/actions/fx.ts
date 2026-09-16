"use server";

import { egpMinorFor, egpRateMicro } from "@/lib/billing/manual";
import { formatMoney } from "@/lib/billing/plans";

/**
 * 🔴 76.7 — WHAT A DOLLAR FIGURE IS IN POUNDS, ASKED ONLY WHEN SOMEBODY ASKS.
 *
 * ## Why this is an action and not a number in the page
 *
 * Every price in this product is quoted in dollars and every person reading it
 * in the launch market thinks in pounds. The obvious build is to render both
 * everywhere, which doubles the width of every table and puts a second number
 * beside a figure that is only occasionally the question.
 *
 * So the pounds are revealed on hover or on a tap, and fetched at that moment.
 * Nothing is converted on page load, which means a screen with forty prices on
 * it does forty conversions only if somebody actually asks forty questions.
 *
 * ## Why the SERVER formats it
 *
 * C84. `Intl` inside a client component renders one string on the server pass
 * and another in the browser, and the rate itself is a server fact: an
 * operator sets it on `/admin/settings` and changes it the afternoon the pound
 * moves. A browser that could compute this number is a browser that could be
 * shown a different one from the one we would honour.
 *
 * ## Why it is safe to expose
 *
 * It returns a rate an operator publishes on every payment screen in the
 * product, applied to an amount the caller already knows. There is no record
 * behind it, no identifier reaches it, and knowing the rate is the point of
 * showing it. It is deliberately incapable of answering anything else.
 */
export async function egpFor(cents: number): Promise<string> {
  /*
   * Clamped rather than trusted. This is reachable by anyone, and an absurd
   * input should cost a formatted string rather than a thrown error in a
   * tooltip somebody is hovering.
   */
  const safe = Math.max(0, Math.min(Math.round(cents), 1_000_000_000));
  return formatMoney(egpMinorFor(safe, await egpRateMicro()), "EGP", "en-US");
}
