/**
 * What a patient can say about a session in one tap.
 *
 * Here rather than in `lib/db/schema.ts` because the rating form is a client
 * component. Importing the schema module to read two string arrays pulls the
 * whole ORM into the browser bundle for a page whose entire job is five stars
 * and an email field.
 *
 * Deliberately blunt in both directions. A list of only warm options is a
 * satisfaction survey rather than feedback, and the negative ones are the
 * reason the positive ones mean anything.
 */

export const THERAPIST_TAGS = [
  "Listened properly",
  "Felt safe",
  "Practical advice",
  "Explained things clearly",
  "Non-judgemental",
  "Right amount of challenge",
  "Rushed",
  "Distracted",
  "Talked over me",
  "Not the right fit",
] as const;

export const SERVICE_TAGS = [
  "Easy to find someone",
  "Connected quickly",
  "Good audio and video",
  "Worth the money",
  "Hard to use",
  "Connection problems",
  "Too expensive",
] as const;

/** Languages written right to left — the brief has to know which way to run. */
export const RTL_LANGUAGE_CODES = new Set(["ar", "he", "fa", "ur"]);
