/**
 * Which crisis number to print, and when to print none. PLAN.md 21R.8, C98.
 *
 * ## 🔴 The defect this exists to fix
 *
 * `988` was hardcoded into the risk banner, the patient's support notice, the
 * radar console and the booking sheet. It is the United States lifeline. This
 * product's first market is Egypt, and `tel:988` dialled from Cairo reaches
 * nothing — so a person in crisis got a button that looks like help, presses
 * like help, and does nothing. The interface dictionary already says this in
 * as many words about `urgent.footer` ("988 means nothing in Abu Dhabi") and
 * then five components printed it anyway.
 *
 * ## Why the table has one entry
 *
 * Because one is what we actually know. Egypt's ambulance is 123 and its
 * police 122, and I am not putting a number a person in crisis will dial into
 * a product on the strength of a recollection — a **wrong** crisis number is
 * worse than none, in the same way and for the same reason that the wrong
 * country's number is. Where there is no verified line the copy says "your
 * local emergency number", which is always true and always actionable.
 *
 * ⚠️ **Incomplete until the lines are configured.** Each country the platform
 * opens in needs its crisis line entered and checked by a person — it belongs
 * in `country_settings` beside the payment rail, and adding it there is the
 * fix rather than growing this list from memory.
 */

export type CrisisLine = {
  /** What the reader sees. A number, as they would say it. */
  label: string;
  /** What `tel:` dials. Digits only. */
  tel: string;
};

/**
 * Verified lines, by ISO country. One entry, deliberately.
 *
 * Adding to this is a decision somebody makes with a phone in their hand, not
 * a translation task.
 */
export const CRISIS_LINES: Record<string, CrisisLine> = {
  US: { label: "988", tel: "988" },
};

/**
 * The line for a country, or null when we do not know one.
 *
 * Null is not a failure — it is the honest state for every country except one,
 * and the components render "call your local emergency number" for it, which
 * is what somebody should do anyway.
 */
export function crisisLine(country?: string | null): CrisisLine | null {
  if (!country) return null;
  return CRISIS_LINES[country.trim().toUpperCase()] ?? null;
}
