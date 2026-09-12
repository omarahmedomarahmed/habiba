import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export function fullName(
  first?: string | null,
  last?: string | null,
  fallback = "Unnamed",
): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Dates and times on staff screens. 12.3 / C70.
 *
 * ## The zone is a required argument, and that is the fix
 *
 * These three used to call `toLocaleDateString(undefined)`. In a client
 * component that is the browser's zone; in a server component on Vercel it is
 * **UTC**. Roughly forty call sites mixed the two, so an invoice issued at
 * 01:00 in Cairo showed as the previous day on one screen and the right day on
 * another, and nothing on either screen said which.
 *
 * C61 fixed this for the times a patient reads about their own appointment, in
 * `lib/scheduling/tz.ts`. This is the same defect on the screens staff read,
 * and the same answer: one instant, one formatter, a named zone. Making the
 * parameter required is what found the call sites — the type error is the
 * audit.
 *
 * Server callers pass `actor.timezone`; client callers pass `readerZone()`.
 * Either may be null, and null means UTC — stated, not assumed.
 */
import { dateTag, type Locale } from "@/lib/i18n/config";

/** The four keys `relativeDay` may ask for. Narrow on purpose. */
type RelativeKey = "when.today" | "when.yesterday" | "when.tomorrow" | "when.daysAgo";
import { formatCalendarDate, formatTime, resolveZone } from "@/lib/scheduling/tz";

/**
 * 🔴 37L.9 — the language is required, for the reason the zone is.
 *
 * This file's own doc already makes the argument about the time zone:
 * *"Making the parameter required is what found the call sites — the type
 * error is the audit."* The language is the same shape of mistake one layer
 * along. A patient reading her session history in Arabic met
 * `Friday 11 September, 16:09 (Cairo)`, which is the seam that makes an app
 * feel half-translated, and an optional parameter would have been a thing to
 * remember — C182's whole failure.
 *
 * Callers pass the app's own locale (`"en"` / `"ar"`), never an Intl tag:
 * `dateTag` decides the tag, and it pins **Western digits** for Arabic
 * (`-u-nu-latn`) because `lib/i18n/config.ts` rules that a patient in crisis
 * reading `٩٨٨` is a worse outcome than a small loss of authenticity.
 *
 * An admin screen passing `"en"` is not an oversight: the console is English
 * by decision until 37L.3, and the call site is where that decision shows.
 */

export function formatDate(
  date: Date | string | null | undefined,
  zone: string | null,
  locale: Locale,
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(dateTag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: resolveZone(zone).name,
  }).format(d);
}

export function formatDateTime(
  date: Date | string | null | undefined,
  zone: string | null,
  locale: Locale,
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const resolved = resolveZone(zone).name;
  return `${new Intl.DateTimeFormat(dateTag(locale), {
    day: "numeric",
    month: "short",
    timeZone: resolved,
  }).format(d)}, ${formatTime(d, resolved)}`;
}

/**
 * "Today", "Yesterday", "3 days ago" — counted in the reader's own days.
 *
 * The old version compared `getDate()` on two Date objects, which is the
 * *server's* calendar day. At 23:00 in Cairo that is still yesterday in UTC, so
 * a session finished an hour ago read as "Yesterday".
 */
export function relativeDay(
  date: Date | string | null | undefined,
  zone: string | null,
  locale: Locale,
  t: (key: RelativeKey, values?: Record<string, string | number>) => string,
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const resolved = resolveZone(zone).name;

  const key = (at: Date) =>
    Date.parse(`${new Intl.DateTimeFormat("en-CA", { timeZone: resolved }).format(at)}T00:00:00Z`);

  const days = Math.round((key(new Date()) - key(d)) / 86_400_000);
  /*
   * 🔴 37L.9 — the words are the dictionary's, not this file's.
   *
   * "Today" is a string a reader sees, so it cannot live in a formatting
   * helper as an English literal. `t` is passed rather than imported because
   * this function runs on both sides of the client boundary and the two get
   * their translator from different places.
   */
  if (days === 0) return t("when.today");
  if (days === 1) return t("when.yesterday");
  if (days === -1) return t("when.tomorrow");
  if (days > 1 && days < 7) return t("when.daysAgo", { count: days });
  return formatDate(d, zone, locale);
}

/** The full `12 September 2026`, for prose rather than a table. */
export function formatLongDate(
  date: Date | string | null | undefined,
  zone: string | null,
  locale: Locale,
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatCalendarDate(d, resolveZone(zone).name, dateTag(locale));
}

