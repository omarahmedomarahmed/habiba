/**
 * Printing money and counts, without `Intl`.
 *
 * ## 🔴 C84, and why this is hand-rolled rather than imported
 *
 * `verify:sprint12` bans `toLocaleString`, `Intl.NumberFormat` and their
 * relatives from any `"use client"` file, and it bans the CONSTRUCT rather than
 * the mistake: an explicit `"en-US"` passes review and is indistinguishable in a
 * diff from the `undefined` that means "ask whatever machine is running this".
 * Seven files got through the previous version of that guard by inlining
 * exactly that. So the rule is the construct, and this respects it.
 *
 * The obvious alternative was `formatMoney` from `lib/billing/plans.ts`, and it
 * is the wrong import for two reasons. It takes cents and a currency, where a
 * forecast deals in whole dollars over thirty-six months; and it would put a
 * billing module in the financial model's import graph, which is the one thing
 * `verify:finance` exists to prevent. A forecast that imports the code that
 * charges people is a forecast one refactor away from charging somebody.
 *
 * ## The shape, which is a decision rather than a default
 *
 * Under ten dollars keeps its cents, because the per-therapist model spend is
 * $5.20 a month and rounding it prints `$5`, and one more rounding prints `$0`.
 * A unit cost that rounds to zero is how somebody concludes the AI is free.
 * Ten and over drops them, because nobody reads the cents on a $654,322 cash
 * balance.
 */

/** Group a whole number with commas. No locale, no `Intl`, no surprises. */
function grouped(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Dollars. Negative numbers get a leading minus, never parentheses: a bracket
 * around a number is an accounting convention that half of any room reads as a
 * footnote.
 */
export function usd(n: number): string {
  const a = Math.abs(n);
  const body = a < 10 ? a.toFixed(2) : grouped(String(Math.round(a)));
  return `${n < 0 ? "-" : ""}$${body}`;
}

/**
 * Egyptian pounds, for a screen whose reader thinks in them.
 *
 * 🔴 Same rule as `usd`: no `Intl`, no locale. A price quoted to an Egyptian
 * clinic is quoted in pounds, and a figure that renders differently depending on
 * which machine opened the page is not a price.
 */
export function egp(usdAmount: number, egpPerUsd: number): string {
  return `${grouped(String(Math.round(usdAmount * egpPerUsd)))} EGP`;
}

/**
 * People and sessions.
 *
 * 🔴 Rounded, because the model carries fractions of a therapist and a fraction
 * of a person is a modelling artefact rather than a person. Printing `77.24
 * therapists` invites a reader to believe the model is more precise than its
 * inputs, which are mostly somebody's judgement.
 */
export function count(n: number): string {
  return grouped(String(Math.round(n)));
}
