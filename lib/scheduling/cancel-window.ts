/**
 * 🔴 Ruling 16: THE FREE CANCELLATION WINDOW, AS ARITHMETIC.
 *
 * A patient who cancels a paid booking at least `hours` before it starts gets
 * everything back; later, the money stays with the clinician unless the
 * clinician agrees. A patient may move a booking inside the same window.
 * `hours` is `rules.refunds.patientCancelWindowHours`, never a constant.
 *
 * Pure, so the boundary is a test (`verify:booking-change`).
 */

const HOUR_MS = 3_600_000;

/** The last instant a cancellation is still free. */
export function freeUntil(scheduledAt: Date, hours: number): Date {
  return new Date(scheduledAt.getTime() - Math.max(0, hours) * HOUR_MS);
}

/** True while a cancellation is refunded in full and a move is allowed. */
export function insideFreeWindow(scheduledAt: Date, now: Date, hours: number): boolean {
  return now.getTime() <= freeUntil(scheduledAt, hours).getTime();
}

/** Where a session meets, against where an hour can be booked for. */
export function placeFits(
  modality: string,
  place: "online" | "in_person" | "either",
): boolean {
  if (place === "either") return true;
  return modality === "in_person" ? place === "in_person" : place === "online";
}
