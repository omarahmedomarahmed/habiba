import { contains, fold } from "./fold";

/**
 * When a matched crisis phrase is not about this patient, now. PLAN.md 35R,
 * C171.
 *
 * ## 🔴 The most dangerous file in this repository
 *
 * Everything else in `lib/crisis` makes an alert more likely. This makes one
 * **less** likely, which means a bug here is a missed alert, and a missed
 * alert is the failure that cannot be undone. It exists for one measured
 * reason and it is built to be as small as a thing can be.
 *
 * ## The measured reason
 *
 * C171: after sprint 35 the classifier scored 100% specificity and the shipped
 * pipeline scored 76.9%, because **every remaining false alarm came from the
 * phrase list** and the list is a floor the model may not lower. All three:
 *
 *   - *"Eight years ago I felt suicidal. I have not felt anything like that
 *     since I had my son."* — past, and explicitly resolved.
 *   - *"My brother took an overdose in 2019 and that is why I am here."* —
 *     somebody else.
 *   - *"قبل سنوات كنت أفكر في إيذاء نفسي، لكن ذلك انتهى تمامًا."* — both.
 *
 * The founder's ruling was to fix the **list**, not the floor. So the list
 * gains the two things a list cannot otherwise carry: tense and subject.
 *
 * ## The three rules that keep this safe
 *
 * 1. **It suppresses a sentence, never a text.** A text where one sentence is
 *    about a brother and another is about the patient still alerts, on the
 *    second sentence. Suppression is per match, and one surviving match is an
 *    alert.
 * 2. **A present-tense marker beats everything.** "I used to be fine, now I
 *    want to die" contains a past marker and is a live disclosure. Any marker
 *    of the present in the same sentence cancels the suppression outright.
 * 3. **The markers are closed lists, written down, and tested against the
 *    sentences they are meant to catch and the ones they must not.** A
 *    heuristic that grows is a heuristic that will eventually swallow a real
 *    one.
 *
 * Anything this cannot decide, it does not suppress. Silence is the default
 * only for the two shapes named above.
 */

/** Somebody who is not the person speaking. Checked BEFORE the phrase. */
/** Exported so the verifier can assert every entry still folds to something. */
export const THIRD_PARTY = [
  "my brother",
  "my sister",
  "my mother",
  "my mum",
  "my mom",
  "my father",
  "my dad",
  "my friend",
  "my son",
  "my daughter",
  "my husband",
  "my wife",
  "my partner",
  "my cousin",
  "my uncle",
  "my aunt",
  "my neighbour",
  "my neighbor",
  "my colleague",
  "my patient",
  "my client",
  "his ",
  "her ",
  "their ",
  "he ",
  "she ",
  "they ",
  /* Arabic, folded. */
  "اخي",
  "اختي",
  "امي",
  "ابي",
  "والدي",
  "والدتي",
  "صديقي",
  "صديقتي",
  "ابني",
  "بنتي",
  "زوجي",
  "زوجتي",
  "جاري",
  "قريبي",
  "خالي",
  "عمي",
];

/** A time that is over, said about the thing itself. */
export const PAST = [
  "years ago",
  "year ago",
  "months ago",
  "back then",
  "at the time",
  "used to",
  "when i was",
  "as a teenager",
  "in my twenties",
  "after the divorce i",
  "قبل سنوات",
  "قبل سنين",
  "قبل شهور",
  "زمان",
  "في الماضي",
  "كنت",
  "ايام",
];

/** Said to have ended. The half of "past" that does the real work. */
export const RESOLVED = [
  "not since",
  "never since",
  "have not felt",
  "haven t felt",
  "havent felt",
  "no longer",
  "that is over",
  "that was over",
  "it passed",
  "long past",
  "nothing like that since",
  "anything like that since",
  "انتهي",
  "انتهت",
  "خلصت",
  "ما عاد",
  "لم اعد",
  "مابقاش",
  "تجاوزت",
];

/**
 * 🔴 The override. Any of these and nothing is suppressed, ever.
 *
 * A sentence can be about the past and about now at once — "I used to think
 * about it sometimes, and this week I have not stopped" — and in every such
 * case the present wins. This list is deliberately generous: a false alarm is
 * thirty seconds of a clinician's attention, and the alternative is not.
 */
export const PRESENT = [
  "now",
  "today",
  "tonight",
  "this week",
  "lately",
  "these days",
  "at the moment",
  "still",
  "again",
  "since then i",
  "right now",
  "currently",
  "الان",
  "اليوم",
  "الليله",
  "هذا الاسبوع",
  "دلوقتي",
  "حاليا",
  "لسه",
  "مازلت",
  "ما زلت",
  "تاني",
  "مره تانيه",
  "مرة اخري",
];

/** Sentence-ish. Arabic full stops, question marks and newlines all count. */
export function sentences(text: string): string[] {
  return text
    .split(/[.!?؟\n]+|،\s*(?=(?:لكن|لكنه|لكنها|بس)\b)/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export type Suppression = { suppressed: boolean; because: "third_party" | "resolved" | null };

/**
 * Should this sentence's match be ignored?
 *
 * `phrase` is the folded phrase that matched, so the subject test can look at
 * what comes **before** it: "my brother took an overdose" suppresses, and
 * "my brother worries about me and I took an overdose" does not, because the
 * relative belongs to a different clause than the phrase.
 */
export function suppressedIn(sentence: string, phrase: string): Suppression {
  const folded = fold(sentence);
  const at = folded.indexOf(fold(phrase));
  if (at < 0) return { suppressed: false, because: null };

  /* Rule 2, first and unconditionally. */
  if (PRESENT.some((marker) => contains(sentence, marker))) {
    return { suppressed: false, because: null };
  }

  /*
   * 🔴 Past AND resolved, together. A past tense alone is not enough: "I tried
   * to kill myself last year" is past, unresolved, and exactly the sentence a
   * clinician must see. Only an explicit statement that it ended suppresses.
   */
  const past = PAST.some((marker) => contains(sentence, marker));
  const resolved = RESOLVED.some((marker) => contains(sentence, marker));
  if (past && resolved) return { suppressed: true, because: "resolved" };

  /*
   * The subject, and only in the run-up to the phrase. A pronoun after it is
   * usually the patient talking about the consequences, not the actor.
   */
  const before = folded.slice(0, at);
  if (THIRD_PARTY.some((who) => contains(before, who))) {
    /* "I" anywhere before the phrase means the speaker put themselves in it. */
    if (/\bi\b|\bانا\b|\bنفسي\b/.test(before)) return { suppressed: false, because: null };
    return { suppressed: true, because: "third_party" };
  }

  return { suppressed: false, because: null };
}

/**
 * Does any sentence in this text carry the phrase un-suppressed?
 *
 * One surviving sentence is a hit. That is the shape of rule 1 and it is why
 * this returns a boolean about the whole text rather than filtering sentences:
 * a caller that forgot to OR them together would silence a disclosure sitting
 * next to a story about a brother.
 */
export function stillCounts(text: string, phrase: string): boolean {
  const parts = sentences(text);
  const relevant = parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => contains(part, phrase));

  if (relevant.length === 0) return true;

  /*
   * 🔴 The present wins over the WHOLE TEXT, not just over its own sentence.
   *
   * The widened case set caught this the hour it was written, in both
   * languages: *"Years ago I felt suicidal and it passed. It is back now,
   * worse than it was."* The first sentence is past and resolved on its own
   * terms, so the sentence-local rule suppressed it, and the correction that
   * matters — *it is back now* — was in the next sentence where nothing was
   * looking. The alert was silently lost.
   *
   * This is the rule the file's own doc claimed ("a present-tense marker beats
   * everything") applied where it was actually promised. It is checked first,
   * before any suppression, and it errs toward alerting: that is the only
   * direction this file is allowed to be wrong in.
   */
  if (parts.some((part) => PRESENT.some((marker) => contains(part, marker)))) return true;

  return relevant.some(({ part, index }) => {
    if (!suppressedIn(part, phrase).suppressed) {
      /*
       * 🔴 The qualification usually comes in the NEXT sentence.
       *
       * *"Eight years ago I felt suicidal. I have not felt anything like that
       * since I had my son."* is the shape of the one false alarm the
       * sentence-local rule could not reach, and it is how people actually
       * talk: the disclosure, then the correction. So a sentence that is
       * plainly in the past can be resolved by something said after it.
       *
       * Bounded, and stopped by the present: if ANY later sentence mentions
       * now, this week, still or again, nothing is suppressed. "Eight years
       * ago I felt suicidal. I feel that way again now." must alert, and the
       * cost of getting that wrong is the only cost that cannot be undone.
       */
      const past = PAST.some((marker) => contains(part, marker));
      if (!past) return true;

      const after = parts.slice(index + 1);
      if (after.some((later) => PRESENT.some((marker) => contains(later, marker)))) return true;
      if (after.some((later) => RESOLVED.some((marker) => contains(later, marker)))) return false;

      return true;
    }
    return false;
  });
}
