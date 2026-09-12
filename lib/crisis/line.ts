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

import { DIALLING_CODES } from "@/lib/phone/e164";

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

/**
 * 🔴 The line for a person we know only by their number. 37R.25, C184.
 *
 * The walkthrough found the orb printing `988 · United States` to a patient
 * whose number begins `+20`, because it rendered **every** entry in the table
 * rather than the one for the reader — `crisisLine`, written for exactly this,
 * was never called by it. One entry in the table is what made the bug
 * invisible: the list and the correct answer looked identical from Delaware
 * and only differed in Cairo, which is the market.
 *
 * Matching is longest-prefix over the dialling codes, and a tie is resolved
 * only when the tied countries leave exactly one verified line between them:
 * `+1` is the United States and Canada, and there is one line for the pair.
 * Anything else returns null, and null means the sentence that is true
 * everywhere.
 */
export function lineForNumber(e164: string | null | undefined): CrisisLine | null {
  const digits = (e164 ?? "").replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return null;
  const national = digits.slice(1);

  let best = 0;
  let candidates: string[] = [];
  for (const [country, code] of Object.entries(DIALLING_CODES)) {
    if (!national.startsWith(code)) continue;
    if (code.length > best) {
      best = code.length;
      candidates = [country];
    } else if (code.length === best) {
      candidates.push(country);
    }
  }

  const lines = candidates
    .map((country) => CRISIS_LINES[country])
    .filter((line): line is CrisisLine => Boolean(line));
  const distinct = new Set(lines.map((line) => line.tel));

  return distinct.size === 1 ? lines[0]! : null;
}

/** The country label for a number, when there is a line to label. */
export function countryForNumber(e164: string | null | undefined): string | null {
  const line = lineForNumber(e164);
  if (!line) return null;
  return Object.keys(CRISIS_LINES).find((country) => CRISIS_LINES[country]!.tel === line.tel) ?? null;
}
