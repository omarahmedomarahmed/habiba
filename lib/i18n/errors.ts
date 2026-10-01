import type { MessageKey } from "./messages";
import type { Translate } from "./server";

/**
 * Bilingual errors on the patient's paths. Due diligence F18.
 *
 * The patient-facing server actions (pay, join, booking, claim, sign up and sign
 * in) answered in English on Arabic screens: the form was Arabic, the refusal under
 * it was not. Each of those returns now goes through a dictionary key.
 *
 * Three shared helpers answer in English from code that is not request aware
 * (`validatePassword`, `e164Problem`, `INVITE_MISMATCH`). Rather than thread a
 * locale through every caller of each, their exact sentences are mapped to keys
 * here, at the action boundary. A sentence with no entry passes through unchanged,
 * which is the same English it always was rather than a blank.
 */
const SHARED: Readonly<Record<string, MessageKey>> = {
  "Enter a number, or leave it blank.": "perr.phone.empty",
  "Choose the country your number is in.": "perr.phone.noCountry",
  "We cannot send messages to that country yet.": "perr.phone.unknownCountry",
  "That number looks too short.": "perr.phone.tooShort",
  "That number looks too long.": "perr.phone.tooLong",
  "Check that phone number.": "perr.checkPhone",
  "Password must be at least 10 characters.": "perr.pw.short",
  "Password must be under 200 characters.": "perr.pw.long",
  "Password cannot start or end with a space.": "perr.pw.space",
  "This link is for a different phone number. Sign up with the number your therapist has for you, or ask them for a new link.":
    "perr.inviteMismatch",
};

export function localiseShared(message: string, t: Translate): string {
  const key = SHARED[message];
  return key ? t(key) : message;
}

/** Exported for the test that holds every mapped sentence to its English key. */
export const __shared = SHARED;

/** "Try again in N min", rounded up so one never means ninety seconds. */
export function minutesFrom(retryAfterSeconds: number): number {
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}
