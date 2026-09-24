/**
 * 🔴 W2-C06 — THE CLINIC'S WEEK, computed once for the screen and its export.
 *
 * Monday-anchored in UTC rather than in the reader's zone: a practice manager
 * and a clinician in different cities must be looking at the same seven rows
 * when they discuss them, and a per-viewer week boundary means they are not.
 *
 * The rota page and `/clinic/export` both call this with the same `week`
 * parameter, so "the export shows nothing this screen does not" is one
 * function rather than two windows that happened to agree. The export used a
 * fixed 90 days either side of today while the screen showed one week.
 *
 * Whatever `week` says, the window is seven days: somebody who edits the URL
 * can move the week, never widen it. Nonsense falls back to the current week.
 */
export function clinicWeek(
  week: string | null | undefined,
  now: Date = new Date(),
): { monday: Date; next: Date; prev: Date } {
  const anchor = week ? new Date(`${week}T00:00:00Z`) : now;
  const valid = Number.isFinite(anchor.getTime()) ? anchor : now;

  const monday = new Date(valid);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const next = new Date(monday);
  next.setUTCDate(next.getUTCDate() + 7);
  const prev = new Date(monday);
  prev.setUTCDate(prev.getUTCDate() - 7);

  return { monday, next, prev };
}
