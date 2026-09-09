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
import { formatCalendarDate, formatTime, resolveZone } from "@/lib/scheduling/tz";

export function formatDate(
  date: Date | string | null | undefined,
  zone: string | null,
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: resolveZone(zone).name,
  }).format(d);
}

export function formatDateTime(
  date: Date | string | null | undefined,
  zone: string | null,
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const resolved = resolveZone(zone).name;
  return `${new Intl.DateTimeFormat("en-GB", {
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
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const resolved = resolveZone(zone).name;

  const key = (at: Date) =>
    Date.parse(`${new Intl.DateTimeFormat("en-CA", { timeZone: resolved }).format(at)}T00:00:00Z`);

  const days = Math.round((key(new Date()) - key(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(d, zone);
}

/** The full `12 September 2026`, for prose rather than a table. */
export function formatLongDate(
  date: Date | string | null | undefined,
  zone: string | null,
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatCalendarDate(d, resolveZone(zone).name);
}

