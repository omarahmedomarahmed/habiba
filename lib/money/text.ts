import "server-only";

import { egpRateMicro } from "@/lib/billing/manual";

import { formatDisplay, moneyLabels, type DisplayCurrency } from "./convert";

/**
 * 🔴 AN AMOUNT AS TEXT, for the places a hover cannot reach: a message an
 * action returns, an email, a notification. Pounds for everybody using the
 * product, the dollars beside them in brackets so the one figure carries both.
 * `<Money>` is the answer everywhere a component can render.
 */
export async function moneyText(
  cents: number,
  options: { locale?: string; primary?: DisplayCurrency; both?: boolean } = {},
): Promise<string> {
  const rateMicro = await egpRateMicro().catch(() => 0);
  const { shown, other } = moneyLabels({
    minor: cents,
    amountIn: "USD",
    primary: options.primary ?? "EGP",
    rateMicro,
    locale: options.locale ?? "en-US",
  });
  return options.both === false || !other ? shown : `${shown} (${other})`;
}

/** The same, for a figure already in pounds. */
export function poundsText(egpMinor: number, locale = "en-US"): string {
  return formatDisplay(egpMinor, "EGP", locale);
}
