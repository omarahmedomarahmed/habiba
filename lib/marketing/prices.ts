import type { Locale } from "@/lib/i18n/config";
import { localeTag } from "@/lib/i18n/config";
import { egpMinorFor, formatDisplay } from "@/lib/money/convert";
import { SETTINGS_DEFAULTS } from "@/lib/settings/defs";

/**
 * THE PRICES INSIDE THE WEBSITE'S EXAMPLE SCREENS, in pounds, from the product's
 * own defaults rather than typed into a mockup.
 *
 * `fixtures.ts` imports nothing (65.19), so the arithmetic lives here: the
 * benchmark session the founders set (`sponsor.averageSessionCents`, $20) at
 * the operator's rate (`payouts.egpRateMicro`, 50), which is EGP 1,000. A
 * dollar figure in a fixture goes through the same conversion, so a company's
 * pot and a clinic's bill are drawn in the currency an Egyptian buyer reads.
 */
const RATE = SETTINGS_DEFAULTS.payouts.egpRateMicro;

/** Piastres for a figure the fixtures hold in US cents. */
export function egpFrom(usdCents: number): number {
  return egpMinorFor(usdCents, RATE);
}

/** One session on the example screens: EGP 1,000 at the shipped defaults. */
export const DEMO_SESSION_EGP = egpFrom(SETTINGS_DEFAULTS.sponsor.averageSessionCents);

/** "EGP 1,000" in English, the pound sign in Arabic, western digits in both. */
export function egp(minor: number, locale: Locale): string {
  return formatDisplay(minor, "EGP", localeTag(locale));
}
