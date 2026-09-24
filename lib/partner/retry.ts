/**
 * 🔴 W2-X03 — WHEN A FAILED WEBHOOK IS TRIED AGAIN, AND WHEN WE STOP.
 *
 * Pure, and outside `webhooks.ts`, so the schedule can be asserted without a
 * database. RESEARCH-2 section 7: exponential backoff over about three days, the
 * shape Stripe uses (5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours, then a
 * steady interval), then a delivery that says it failed rather than "Pending" for
 * ever. Deliveries are drained by the hourly cron wake, so a short wait here
 * means "at the next wake".
 */

/** Minutes to wait after the Nth failed try (index 0 is after the first). */
export const RETRY_MINUTES = [5, 30, 120, 300, 600, 600, 600, 600, 600, 600] as const;

/** Every try, the first included. The last failure is final. */
export const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;

/**
 * Minutes to wait after `attempts` tries have failed, or null when that was the
 * last one and the delivery has failed.
 *
 * Minutes rather than a time, so the caller adds them to the DATABASE's clock:
 * the drain compares `next_attempt_at` with `now()`, and a time from this
 * process's clock is a second or so off it (78.6 in `lib/rate-limit.ts`).
 */
export function retryWaitMinutes(attempts: number): number | null {
  if (attempts < 1) return 0;
  if (attempts >= MAX_ATTEMPTS) return null;
  return RETRY_MINUTES[attempts - 1]!;
}
