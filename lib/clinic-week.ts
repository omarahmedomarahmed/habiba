import { dayKey, dayKeyOf, parseDayKey, weekIn } from "@/lib/scheduling/tz";

/**
 * 🔴 W2-C06: THE CLINIC'S WEEK, computed once for the screen and its export.
 *
 * The rota page and `/clinic/export` both call this with the same `week`
 * parameter, so "the export shows nothing this screen does not" is one
 * function rather than two windows that happened to agree. The export used a
 * fixed 90 days either side of today while the screen showed one week.
 *
 * Whatever `week` says, the window is seven days: somebody who edits the URL
 * can move the week, never widen it. Nonsense falls back to the current week.
 *
 * 🔴 T8: AND THE WEEK IS THE READER'S, BOUNDED BY THEIR ZONE'S MIDNIGHTS.
 *
 * This was Monday-anchored in UTC, on the argument that a manager and a
 * clinician in different cities should see the same seven rows. What it
 * produced was a Cairo practice finding every Monday session before 02:00 (03:00
 * in summer) filed under the previous week, on the screen whose one job is who
 * is coming this week. The reader and the room are almost always in the same
 * city, so the week is theirs: `zone` is `actor.zone.name`, which the page names
 * on screen, so the boundary is never a silent guess.
 *
 * `week` is a calendar day and is parsed as three numbers, never as an instant:
 * `new Date("2026-09-21")` is a UTC midnight, which is this bug again. The three
 * keys are what the page's links carry.
 */
export function clinicWeek(
  week: string | null | undefined,
  zone: string,
  now: Date = new Date(),
): {
  monday: Date;
  next: Date;
  mondayKey: string;
  prevKey: string;
  nextKey: string;
} {
  const today = parseDayKey(dayKey(now, zone))!;
  const day = (week && parseDayKey(week)) || today;
  const bounds = weekIn(day, zone);

  return {
    monday: bounds.from,
    next: bounds.to,
    mondayKey: dayKeyOf(bounds.monday),
    prevKey: dayKeyOf(bounds.prev),
    nextKey: dayKeyOf(bounds.next),
  };
}
