import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 44.1 / 22R.11 — DIFFERENTLY WORDED EACH TIME, NEVER A TEMPLATE EVERYBODY RECOGNISES.
 *
 * Pure, and it takes the last wording rather than reading one, so the choice is testable and the
 * caller owns the query.
 *
 * ## 🔴 TWELVE WORDINGS FROM `messages.ts`, NOT A GENERATED SENTENCE
 *
 * The obvious build is a model call: "write a short friendly check-in for Nour". It is wrong here
 * for two reasons and the second is the one that settles it.
 *
 * A generated sentence cannot be reviewed before it is sent, so the first time it says something
 * clinical, or something that reads as a judgement about somebody's week, it has already arrived.
 * And 44.2 says a check-in never interprets — a model given a person's name and asked to be warm
 * has no way to be sure it is not also being perceptive, and perceptive about somebody in distress
 * is interpretation whether or not it was asked for.
 *
 * So: twelve fixed wordings, admin-editable like every string since 45, each in both languages,
 * each carrying the person's name, each under about fifteen words. Twelve is enough that at once a
 * day nobody sees a repeat inside a fortnight, and small enough that a human read all of them.
 *
 * ## 🔴 AND IT REFUSES TO REPEAT THE LAST ONE FOR THE SAME PERSON
 *
 * Not a random choice: a random choice from twelve repeats about one time in twelve, and the
 * complaint C97 anticipates is *a template everybody recognises*. The same wording twice in a row
 * is what makes it feel like a template, so the previous one is excluded and the pick is made from
 * the remaining eleven.
 */

export const WORDING_KEYS = [
  "checkin.1",
  "checkin.2",
  "checkin.3",
  "checkin.4",
  "checkin.5",
  "checkin.6",
  "checkin.7",
  "checkin.8",
  "checkin.9",
  "checkin.10",
  "checkin.11",
  "checkin.12",
] as const satisfies readonly MessageKey[];

export type WordingKey = (typeof WORDING_KEYS)[number];

/**
 * Pick a wording, excluding the one this person saw last.
 *
 * `pick` is injected so a test can pin it. A default of `Math.random` would make this function
 * untestable and the untested half is the exclusion, which is the whole point of it.
 */
export function nextWording(
  lastBody: string | null,
  rendered: Record<WordingKey, string>,
  pick: (upperExclusive: number) => number = (n) => Math.floor(Math.random() * n),
): WordingKey {
  /*
   * 🔴 Matched on the RENDERED TEXT rather than on a stored key, and that is deliberate.
   *
   * `checkins.body` holds what we actually sent, which is the honest record and the thing 44.1
   * needs in order to vary. Storing the key instead would be smaller and would go stale the moment
   * an admin edits a wording: the key would match while the words had changed, so the exclusion
   * would suppress a sentence this person has never seen.
   */
  const candidates = WORDING_KEYS.filter((key) => rendered[key] !== lastBody);

  /* Every wording identical to the last one, which can only happen if an admin made them equal. */
  if (candidates.length === 0) return WORDING_KEYS[0];

  return candidates[pick(candidates.length)] ?? candidates[0]!;
}

/**
 * 🔴 THE ONE WORD THAT STOPS THEM, IN BOTH LANGUAGES.
 *
 * A reply is matched against these before anything else happens to it. Matched on the whole
 * trimmed message rather than on a substring, because "I cannot stop crying" contains the word
 * stop and is the single most important message this product could ever receive: muting somebody
 * who wrote that, instead of routing it to the crisis path, would be the worst possible failure of
 * this sprint.
 *
 * So the opt-out is an exact match on a short message, and everything else is a reply.
 */
const STOP_WORDS = ["stop", "unsubscribe", "إيقاف", "توقف", "الغاء", "إلغاء"] as const;

export function isStopWord(body: string): boolean {
  const trimmed = body
    .trim()
    .toLowerCase()
    /* Strip trailing punctuation so "stop." and "stop!" count. */
    .replace(/[.!،؟?]+$/u, "")
    .trim();

  return (STOP_WORDS as readonly string[]).includes(trimmed);
}
