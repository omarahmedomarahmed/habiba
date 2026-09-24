/**
 * 🔴 THE ONE CONVERSION, pure, shared by the server that charges and the
 * screen that shows. Pounds per dollar times a million, from the operator's
 * setting (`payouts.egpRateMicro`), never from a feed and never typed here.
 *
 * `lib/billing/manual.ts` re-exports `egpMinorFor` from here, so the figure a
 * person reads and the figure a transfer or a card is asked for are the same
 * integer arithmetic on the same rate.
 */

/** USD cents to piastres. 2,000 at 50 pounds is 100,000, which is 1,000 EGP. */
export function egpMinorFor(usdCents: number, rateMicro: number): number {
  return Math.round((usdCents * rateMicro) / 1_000_000);
}

/** Piastres to USD cents, for a figure that is already in pounds. */
export function usdCentsFor(egpMinor: number, rateMicro: number): number {
  return rateMicro > 0 ? Math.round((egpMinor * 1_000_000) / rateMicro) : 0;
}

export type DisplayCurrency = "EGP" | "USD";

/**
 * A figure in the currency it is shown in. Whole units print without
 * decimals ("EGP 1,000", "$20"); a figure with a fraction keeps two, because
 * an amount somebody transfers has to match to the piastre.
 */
export function formatDisplay(minor: number, currency: DisplayCurrency, locale: string): string {
  const whole = Math.round(minor) % 100 === 0;
  return (Math.round(minor) / 100).toLocaleString(locale || "en-US", {
    style: "currency",
    currency,
    currencyDisplay: currency === "EGP" && !locale.startsWith("ar") ? "code" : "symbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

/**
 * Both labels for one amount: the one on screen and the one a hover or a tap
 * reveals. `amountIn` is the currency the stored figure is in.
 */
export function moneyLabels(input: {
  minor: number;
  amountIn: DisplayCurrency;
  primary: DisplayCurrency;
  rateMicro: number;
  locale: string;
}): { shown: string; other: string | null } {
  const usd = input.amountIn === "USD" ? input.minor : usdCentsFor(input.minor, input.rateMicro);
  const egp = input.amountIn === "EGP" ? input.minor : egpMinorFor(input.minor, input.rateMicro);
  const known = input.rateMicro > 0;
  const shownCurrency: DisplayCurrency = known ? input.primary : input.amountIn;
  const shown = formatDisplay(shownCurrency === "USD" ? usd : egp, shownCurrency, input.locale);
  if (!known) return { shown, other: null };
  const otherCurrency: DisplayCurrency = shownCurrency === "USD" ? "EGP" : "USD";
  return { shown, other: formatDisplay(otherCurrency === "USD" ? usd : egp, otherCurrency, input.locale) };
}
