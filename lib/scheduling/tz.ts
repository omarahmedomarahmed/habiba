/**
 * One instant, one formatter, the reader's zone. PLAN.md 11R.1–11R.4, C61.
 *
 * 🔴 §6: **no `toISOString()` in anything a person reads.**
 *
 * The defect this module exists to remove: `BookingCalendar` rendered a slot
 * with `toLocaleTimeString`, so a Cairo patient picked "22:00"; the
 * confirmation body was built from `startsAt.toISOString()`, so the email said
 * "19:00 UTC". Same instant, two renderings, and the patient has to work out
 * which one to trust — at the moment they are deciding when to leave the
 * house.
 *
 * So every human-readable time in the product comes from here, and every one
 * of these functions **requires a zone**. There is no overload that formats
 * "in whatever zone the server is in", because that is the bug.
 *
 * Pure and dependency-free: `Intl` knows the IANA database, including Egypt's
 * on-again-off-again DST, and knows it better than a table we would maintain.
 */

/** What we fell back to, so the sentence can say so. 11R.3. */
export type ZoneSource = "reader" | "clinician" | "utc";

export type Zone = {
  /** An IANA name. Always usable — `resolveZone` guarantees it. */
  name: string;
  source: ZoneSource;
};

/**
 * Pick the zone to render in, and remember why.
 *
 * Order: the reader's own, then the clinician's, then UTC. Each fallback is
 * recorded rather than hidden, because "22:00" with no zone is a time somebody
 * will get wrong by three hours — and the one they get wrong is the one where
 * they miss the appointment.
 */
export function resolveZone(
  readerZone: string | null | undefined,
  clinicianZone?: string | null,
): Zone {
  if (usable(readerZone)) return { name: readerZone!, source: "reader" };
  if (usable(clinicianZone)) return { name: clinicianZone!, source: "clinician" };
  return { name: "UTC", source: "utc" };
}

/**
 * The zone this *runtime* is in. 12.3.
 *
 * 🔴 **In the browser this is the reader's zone. On the server it is the
 * server's, and on Vercel that is UTC** — `Intl` is defined in Node and
 * answers, so there is no null to fall through on. An earlier version of this
 * comment claimed otherwise and six client components were built on it: they
 * called this at module scope, Next.js server-rendered them, and every date
 * was emitted as UTC in the HTML and as local time after hydration. A React
 * hydration mismatch on every timestamp, and a visible flash of the wrong day
 * for anybody east of UTC.
 *
 * So this is **never** safe to call during render. Two safe callers:
 *
 *   - `useReaderZone()` below, which returns null until after mount
 *   - code that only ever runs from an event handler or an effect
 *
 * Anything rendered on both passes takes its zone as a **prop from the
 * server**, so the two passes cannot disagree.
 */
export function readerZone(): string | null {
  if (typeof Intl === "undefined") return null;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Null, empty, or a name this runtime does not know are all unusable. */
export function usable(zone: string | null | undefined): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The short city label a sentence ends with — `Cairo`, `New York`, `UTC`.
 *
 * The last IANA segment with underscores removed. Not the offset: "+03" is
 * correct and unreadable, and it changes under DST while the city does not.
 */
export function zoneLabel(zone: string): string {
  if (zone === "UTC") return "UTC";
  const last = zone.split("/").pop() ?? zone;
  return last.replace(/_/g, " ");
}

const LOCALE = "en-GB";

/** `22:00` */
export function formatTime(at: Date, zone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zone,
  }).format(at);
}

/** `Thursday 12 September` */
export function formatDay(at: Date, zone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: zone,
  }).format(at);
}

/**
 * A calendar date for prose — `12 September 2026`. 11R.1.
 *
 * For the places that name a day and not an hour: "your session on …" in an
 * email, the heading on a feedback form. Still zone-bound, because a 23:00
 * Cairo session is the *previous* day in UTC, and an email that names the
 * wrong day is one the patient reads as being about a different session.
 *
 * `locale` because these strings sit inside translated sentences; the zone is
 * not optional for the same reason it is not optional anywhere else here.
 */
export function formatCalendarDate(at: Date, zone: string, locale = LOCALE): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: zone }).format(at);
}

/** `Thu 12` — the short label on a day chip. */
export function formatWeekday(at: Date, zone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    timeZone: zone,
  }).format(at);
}

/**
 * The full rendering a person reads: `Thursday 12 September, 22:00 (Cairo)`.
 *
 * The zone is **always** named. Not "when it is ambiguous" — always, because
 * the reader cannot tell from the string whether it was ambiguous, and a
 * label they did not need costs them nothing.
 */
export function formatWhen(at: Date, zone: Zone): string {
  return `${formatDay(at, zone.name)}, ${formatTime(at, zone.name)} (${zoneLabel(zone.name)})`;
}

/**
 * The same, plus a plain sentence when we are not sure it is their zone.
 *
 * A confirmation that fell back to the clinician's zone says so. The
 * alternative — printing a time in somebody else's zone with a city name that
 * looks authoritative — is worse than saying "we do not know where you are".
 */
export function formatWhenWithCaveat(at: Date, zone: Zone): string {
  const base = formatWhen(at, zone);
  if (zone.source === "reader") return base;
  if (zone.source === "clinician") return `${base}, your therapist's time zone`;
  return `${base}. We do not have your time zone, so this is UTC`;
}

/* ------------------------------------------------- the calendar's own day -- */

/**
 * The calendar day a slot falls on **in the display zone**. 11R.4.
 *
 * `toISOString().slice(0, 10)` buckets on the UTC date, so a 23:00Z slot in
 * Cairo (02:00 the next morning) sat under Monday and rendered "Tuesday" — a
 * calendar that disagrees with its own headings. This is the same computation
 * done in the zone the reader is looking at.
 *
 * `en-CA` because its short date format is ISO-ordered (`2026-09-12`), which
 * makes the key sortable as a string. That is a deliberate trick, not a
 * locale preference — nothing user-facing comes out of it.
 */
export function dayKey(at: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: zone,
  }).format(at);
}

/**
 * Group slots by the day they fall on *for the reader*.
 *
 * Replaces `byDay` from `hours.ts`, which bucketed on UTC. Keys are sortable
 * ISO-shaped strings; `label` is what the heading shows, computed from the
 * first slot in the bucket rather than by parsing the key back into a date —
 * parsing `2026-09-12` and formatting it again reintroduces exactly the
 * off-by-one this function exists to remove.
 */
export function byDayIn<T extends { startsAt: Date }>(
  slots: T[],
  zone: string,
): { key: string; label: string; slots: T[] }[] {
  const buckets = new Map<string, T[]>();

  for (const slot of [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const key = dayKey(slot.startsAt, zone);
    const list = buckets.get(key);
    if (list) list.push(slot);
    else buckets.set(key, [slot]);
  }

  return [...buckets.entries()].map(([key, list]) => ({
    key,
    label: formatDay(list[0]!.startsAt, zone),
    slots: list,
  }));
}

/* --------------------------------------------- publishing in a local zone -- */

/**
 * The UTC instant of a wall-clock hour on a given local day. 11R.2.
 *
 * A clinician in Cairo choosing 18:00 on 12 September means 18:00 *there*,
 * which is 15:00Z in summer and 16:00Z in winter — Egypt reintroduced DST in
 * 2023, so this is a live problem and not a theoretical one.
 *
 * The implementation is the standard two-step: guess UTC, ask `Intl` what that
 * instant looks like in the zone, and correct by the difference. One pass is
 * enough except exactly at a DST transition, so it runs twice — the second
 * pass is a no-op every other hour of the year.
 *
 * Returns null for an hour that does not exist (the spring-forward gap), which
 * is the honest answer: 02:00 on that day is not a time anybody can be seen at.
 */
export function zonedHourToUtc(
  day: { year: number; month: number; date: number },
  hour: number,
  zone: string,
): Date | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!usable(zone)) return null;

  let utc = Date.UTC(day.year, day.month - 1, day.date, hour, 0, 0, 0);

  for (let pass = 0; pass < 2; pass += 1) {
    const seen = partsIn(new Date(utc), zone);
    const wanted = Date.UTC(day.year, day.month - 1, day.date, hour, 0, 0, 0);
    const actual = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0, 0);
    if (actual === wanted) return new Date(utc);
    utc += wanted - actual;
  }

  // Second pass still disagrees: the wall-clock hour does not exist in this
  // zone on this day. A spring-forward gap, and nobody can be seen at it.
  const final = partsIn(new Date(utc), zone);
  return final.hour === hour ? new Date(utc) : null;
}

/**
 * `2026-09-12` → `{ year: 2026, month: 9, date: 12 }`, or null.
 *
 * Deliberately not `new Date("2026-09-12")`, which produces a UTC midnight and
 * then tempts every caller into doing arithmetic on it. A calendar day the
 * clinician picked is three numbers, not an instant — it becomes an instant
 * only once a zone is applied, which is `zonedHourToUtc`'s job.
 */
export function parseDayKey(day: string): { year: number; month: number; date: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;

  // Rejects 31 February without a table of month lengths: the round-trip
  // through Date.UTC normalises an impossible date into the next month.
  const probe = new Date(Date.UTC(year, month - 1, date));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== date) return null;

  return { year, month, date };
}

/** What an instant looks like in a zone, as numbers. */
function partsIn(at: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // `hour12: false` renders midnight as 24 in some runtimes.
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/** The hour of the day, in a zone. Used by the reminder's quiet window. */
export function hourIn(at: Date, zone: string): number {
  return partsIn(at, usable(zone) ? zone : "UTC").hour;
}

/**
 * 11R.16 — is it a reasonable hour to message somebody?
 *
 * Nothing goes out between 22:00 and 07:00 where the recipient is. A reminder
 * that wakes somebody at 05:20 is worse than no reminder: it is the product
 * being useful at the patient's expense, and they will turn notifications off.
 */
export const QUIET_FROM = 22;
export const QUIET_UNTIL = 7;

export function isQuietHour(at: Date, zone: string): boolean {
  const hour = hourIn(at, zone);
  return hour >= QUIET_FROM || hour < QUIET_UNTIL;
}
