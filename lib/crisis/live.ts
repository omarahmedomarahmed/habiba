import { scanForCrisisLanguage } from "@/lib/crisis/alerts";
import { firstPersonIn } from "@/lib/crisis/context";
import { arabicWords, fold } from "@/lib/crisis/fold";

/**
 * The crisis scan for a live session, one chunk at a time. DD-2.
 *
 * Two things the plain scan got wrong in the room:
 *
 * 1. It ignored who was speaking, so a therapist asking "any thoughts of
 *    suicide?" raised an alert. A line labelled as the therapist is not
 *    scanned. When nobody knows who spoke, every line is still scanned, but a
 *    question that asks somebody else about themselves ("kill yourself",
 *    "تنتحر") is not read as a disclosure.
 * 2. Chunks are cut every eight seconds on a clock, so "I want to" in one and
 *    "die" in the next matched nothing. The new chunk is scanned joined to the
 *    tail of the previous one from the same speaker, and a phrase found only
 *    in that tail is not raised again.
 */

export type Speaker = "therapist" | "patient" | "unknown";

/** How much of the previous chunk is carried into the next scan. */
export const TAIL_CHARS = 80;

const QUESTION_OPENER =
  /^(?:(?:so|and|but|ok|okay|now|well|and so)\s+)?(?:do|does|did|have|has|had|are|is|were|was|would|could|can|any|how|when|what|why|ever)(?![a-z0-9])/;
const ARABIC_OPENERS = ["هل", "ايه", "امتي", "ازاي", "ليه"].map((word) => arabicWords(word));
/*
 * 🔴 Review: the crisis words pointed at "you": "kill yourself", "your life",
 * "تنتحر", "نفسك". A bare "you" is not enough: "Do you ever just want to die?"
 * and "انت عارف اني عايز اموت؟" are the speaker's own.
 */
const SECOND_PERSON_LATIN = /(?:^|[^a-z0-9])(?:yourself|your own life|your life|kill you|hurt you)(?:$|[^a-z0-9])/;
const SECOND_PERSON_ARABIC = ["نفسك", "حياتك", "تنتحر", "تنتحري", "تموت", "تموتي"].map((word) => arabicWords(word));

/**
 * Is this sentence a question put to somebody else about themselves ("have
 * you thought of killing yourself", "بتفكر تنتحر؟")?
 *
 * All three must hold: it is a question (a question mark, or a question word
 * first), its crisis words point at "you" (`SECOND_PERSON_*`), and it says
 * nothing about "I". When unsure it is scanned: a false alert costs a
 * clinician a minute, a missed one cannot be undone. "Do you have thoughts
 * of suicide?" from an unknown speaker is scanned; labelled as the
 * therapist's, it is not.
 */
export function isQuestionToOther(sentence: string): boolean {
  const folded = fold(sentence).trim();
  if (!folded) return false;
  const asked =
    /[?؟]\s*$/.test(folded) ||
    QUESTION_OPENER.test(folded) ||
    ARABIC_OPENERS.some((re) => re.test(folded.split(/\s+/)[0] ?? ""));
  if (!asked) return false;
  const toYou = SECOND_PERSON_LATIN.test(folded) || SECOND_PERSON_ARABIC.some((re) => re.test(folded));
  if (!toYou) return false;
  return !firstPersonIn(folded);
}

/** The text with every question put to somebody else taken out. */
export function withoutQuestionsToOthers(text: string): string {
  const parts = text.match(/[^.!?؟\n]+[.!?؟]*/g) ?? [];
  return parts.filter((part) => !isQuestionToOther(part)).join("\n");
}

/** The end of the previous chunk, starting on a word edge. */
export function tailOf(text: string, chars = TAIL_CHARS): string {
  if (text.length <= chars) return text;
  const cut = text.slice(-chars);
  const space = cut.search(/\s/);
  return space < 0 ? cut : cut.slice(space + 1);
}

/**
 * The phrases to alert on for one new chunk.
 *
 * `previous` is the chunk stored just before this one, if any. Its tail is
 * joined only when the same speaker said it, so a therapist's question is
 * never glued onto a patient's answer.
 */
export function scanLiveChunk(input: {
  text: string;
  speaker: Speaker;
  previous?: { text: string; speaker: Speaker } | null;
}): string[] {
  if (input.speaker === "therapist") return [];

  const prepare = (text: string) =>
    input.speaker === "unknown" ? withoutQuestionsToOthers(text) : text;

  const own = scanForCrisisLanguage(prepare(input.text));

  const previous = input.previous;
  if (!previous || previous.speaker !== input.speaker || !previous.text.trim()) return own;

  const tail = tailOf(previous.text.trim());
  const joined = scanForCrisisLanguage(prepare(`${tail} ${input.text}`));
  const inTail = new Set(scanForCrisisLanguage(prepare(tail)));
  const across = joined.filter((label) => !inTail.has(label) && !own.includes(label));

  return [...own, ...across];
}
