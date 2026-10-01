/**
 * DD-2 B2.2: the pure half of counting sign-in guesses. No database, so
 * `tests/attempts.test.ts` holds the rules.
 *
 * Every door counts per network (`callerKey`) and, from here, per account as
 * well. The account counter is keyed on what was typed, normalised, whether or
 * not an account has it, so "too many tries" appears for an unknown address
 * exactly as it does for a real one and says nothing about which exist.
 */

/** Tries per account per window, before the password is even checked. The clinician door's old numbers. */
export const ACCOUNT_ATTEMPTS = 5;
export const ACCOUNT_WINDOW_SECONDS = 15 * 60;

/** Six digit codes: per account across every code it was sent, per hour. */
export const CODE_ACCOUNT_ATTEMPTS = 10;
export const CODE_ACCOUNT_WINDOW_SECONDS = 60 * 60;

/** Codes sent to one handle per hour, from every network together. */
export const CODES_SENT_PER_HANDLE = 5;
export const CODES_SENT_WINDOW_SECONDS = 60 * 60;

/** One spelling per account: case and surrounding space do not make a new bucket. */
export function accountSubject(identifier: string): string {
  return identifier.normalize("NFKC").trim().toLowerCase();
}

/** Whole minutes to wait, never zero, from a limiter's seconds. */
export function minutesToWait(retryAfterSeconds: number): number {
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}

/**
 * What one guess at a six digit code comes to, once the attempt has been
 * counted. `attemptsAfter` is the count the database returned for this guess,
 * or null when no live code could take another guess.
 */
export type GuessOutcome = "match" | "wrong" | "exhausted";

export function guessOutcome(input: { attemptsAfter: number | null; matched: boolean; limit: number }): GuessOutcome {
  if (input.attemptsAfter === null || input.attemptsAfter > input.limit) return "exhausted";
  if (input.matched) return "match";
  return input.attemptsAfter >= input.limit ? "exhausted" : "wrong";
}
