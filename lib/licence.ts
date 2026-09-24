/**
 * 🔴 W1-16: when a licence stops being valid, read from what a clinician typed.
 *
 * `license_expiry` is free text (the form's placeholder is `2028-04`, and the
 * rows on dev hold `2029-06-30`), so this reads the shapes people actually
 * write and refuses to guess at anything else. A licence is valid THROUGH the
 * date given: `2028-04` is good until the end of April, `2029-06-30` until the
 * end of that day. Days are UTC, so the sweep that runs at 03:00 UTC acts on
 * the morning after the last valid day everywhere this product runs.
 *
 * Unreadable text is `unknown`, never expired. Taking a clinician off the
 * radar because we could not parse a date would be our failure charged to them.
 */

export const EXPIRY_WARNING_DAYS = 30;

const DAY = 86_400_000;

function utc(year: number, monthIndex: number, day: number): Date | null {
  const at = new Date(Date.UTC(year, monthIndex, day));
  if (at.getUTCFullYear() !== year || at.getUTCMonth() !== monthIndex || at.getUTCDate() !== day) {
    return null;
  }
  return at;
}

/** The first instant the licence is no longer valid, or null if unreadable. */
export function licenceValidUntil(text: string | null | undefined): Date | null {
  const value = (text ?? "").trim();
  if (!value) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (m) {
    const last = utc(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return last ? new Date(last.getTime() + DAY) : null;
  }

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (m) {
    // Day first, as written in Egypt and most of the world this runs in.
    const last = utc(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return last ? new Date(last.getTime() + DAY) : null;
  }

  const yearFirst = /^(\d{4})[/-](\d{1,2})$/.exec(value);
  const monthFirst = /^(\d{1,2})[/-](\d{4})$/.exec(value);
  const [year, month] = yearFirst
    ? [Number(yearFirst[1]), Number(yearFirst[2])]
    : monthFirst
      ? [Number(monthFirst[2]), Number(monthFirst[1])]
      : [NaN, NaN];
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  // Valid through the last day of that month: the first of the next.
  return utc(month === 12 ? year + 1 : year, month % 12, 1);
}

export type LicenceStanding = "expired" | "expiring" | "valid" | "unknown";

export function licenceStanding(text: string | null | undefined, now: Date): LicenceStanding {
  const until = licenceValidUntil(text);
  if (!until) return "unknown";
  if (now.getTime() >= until.getTime()) return "expired";
  if (until.getTime() - now.getTime() <= EXPIRY_WARNING_DAYS * DAY) return "expiring";
  return "valid";
}
