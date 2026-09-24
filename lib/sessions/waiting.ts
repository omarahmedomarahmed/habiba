/**
 * 🔴 W2-P11: how long a patient has been waiting for a booked clinician, and
 * when the screen asks again.
 *
 * `NoShowRecovery` was handed a wait computed once, on the server, when the
 * page rendered. A patient who opened the room at minute three was told
 * "joining shortly" for ever, because nothing ever counted past three, and the
 * offer at five minutes never came. The clock is the browser's now, from the
 * booked instant the server sent, so it keeps counting while they wait.
 */
export const OFFER_AFTER_MINUTES = 5;

/** How often a waiting screen asks again: often enough to matter, under the offer's rate limit. */
export const RECHECK_MS = 3 * 60_000;

export function minutesWaiting(scheduledAtIso: string, now: number): number {
  const at = Date.parse(scheduledAtIso);
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.floor((now - at) / 60_000));
}

/**
 * Ask the server now? At the five-minute line, and again every `RECHECK_MS`
 * while nobody has been offered: a clinician who comes on shift at minute
 * seven is somebody to offer.
 */
export function shouldAsk(input: {
  waited: number;
  started: boolean;
  state: "waiting" | "offer" | "none" | "done";
  lastAskedAt: number | null;
  now: number;
}): boolean {
  if (input.started || input.waited < OFFER_AFTER_MINUTES) return false;
  if (input.state === "offer" || input.state === "done") return false;
  if (input.lastAskedAt === null) return true;
  return input.now - input.lastAskedAt >= RECHECK_MS;
}
