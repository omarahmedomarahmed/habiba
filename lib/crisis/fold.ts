/**
 * One spelling, in one place. PLAN.md 35R, C161, C173.
 *
 * ## 🔴 Why this file exists, and it is not tidiness
 *
 * C161 ruled, in sprint 32, that an Arabic normaliser written with a literal
 * character class had swallowed the Arabic **letters** as well as the marks,
 * so every Arabic string folded to `""` — and `"anything".includes("")` is
 * true, so a crisis scanner matched every English sentence ever written. The
 * ruling was "assert the value survived".
 *
 * **It happened again, in 35R, in a new file, one sprint later.** A second
 * normaliser was written for the context guard by copying the same shape, the
 * class mangled the same way, every Arabic marker folded to `""`, and the
 * "is this sentence about the present?" test therefore returned **true for
 * every English sentence** — which silently disabled the entire guard. The
 * eval showed no change at all, which is what sent somebody looking.
 *
 * So the rule stops being a thing to remember and becomes two things in code:
 *
 *   1. **One fold.** Written with explicit `\u` escapes, because a character
 *      class of literal Arabic marks is unreadable in every editor and diff,
 *      and unreadable is how it was wrong twice.
 *   2. **`contains`, which refuses an empty needle.** That is the line that
 *      turns this bug class from "a scanner matches everything" into "a
 *      marker does nothing", which is safe, visible in a test, and cannot page
 *      a clinician about a sentence with no crisis language in it.
 */

/**
 * Arabic combining marks and the tatweel — everything that carries no lexical
 * content — as escapes:
 *
 *   0610-061A  Quranic annotation marks
 *   064B-065F  fathatan through the low marks
 *   0670       superscript alef
 *   06D6-06ED  more annotation marks
 *   0640       tatweel, a stretching character with no sound
 */
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/**
 * The same folding every crisis surface uses.
 *
 * Arabic is written with optional diacritics, three interchangeable alef
 * forms, a final ة half the internet types as ه, and a final ى half types as
 * ي. None of those change the word, and a crisis scanner may not depend on
 * how somebody's phone keyboard behaves at 3am.
 *
 * English passes through with nothing but the lowercasing it already had.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(MARKS, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/[\u0624\u0626]/g, "\u0621");
}

/**
 * 🔴 Does `haystack` contain `needle`, where an EMPTY needle contains nothing?
 *
 * `"".includes("")` is true, and so is `"any English sentence".includes("")`.
 * Every occurrence of this bug in this repository — twice now — has been a
 * needle that normalised to nothing and then matched everything. One function,
 * used by every membership test in `lib/crisis`, and the class is closed.
 *
 * It fails **safe in both directions**: a marker that folds to nothing stops
 * suppressing (so an alert is raised rather than swallowed) and stops matching
 * (so no alert is raised from a phrase that is not there).
 */
export function contains(haystack: string, needle: string): boolean {
  const folded = fold(needle);
  if (folded.length === 0) return false;
  return fold(haystack).includes(folded);
}

/**
 * 🔴 Does `haystack` contain `needle` as whole words, when the needle is Latin?
 *
 * `contains` is a substring test, which is right for Arabic (a prefix like و
 * or ب is written onto the word) and wrong for a short Latin marker: the
 * third-party marker "he " matched inside "the ", so "The only way out is to
 * kill myself" read as a sentence about somebody else and raised nothing.
 *
 * So a needle made only of Latin letters, digits and spaces must sit between
 * word edges. Anything else falls back to `contains`. Use this for every list
 * that SUPPRESSES an alert: a stricter match there can only suppress less.
 * PRESENT uses it too, since "now" inside "know" is not the present; the forms
 * the loose match caught on purpose are listed there as their own markers.
 */
export function containsWords(haystack: string, needle: string): boolean {
  const folded = fold(needle).trim();
  if (folded.length === 0) return false;
  if (!/^[a-z0-9 ]+$/.test(folded)) return contains(haystack, needle);
  const words = folded.split(/ +/).join(" +");
  return new RegExp(`(?:^|[^a-z0-9])${words}(?:$|[^a-z0-9])`).test(fold(haystack));
}

/**
 * Every entry in a marker list that folds away to nothing.
 *
 * Exported so `verify:sprint35r` can assert the lists are all still readable
 * rather than trusting that somebody remembered. A marker that folds to
 * nothing is a marker that does nothing, silently.
 */
export function foldsToNothing(markers: readonly string[]): string[] {
  return markers.filter((marker) => marker.trim().length > 0 && fold(marker).length === 0);
}

/* ---------------------------------------------------------------- Arabizi -- */

/**
 * 🔴 ARABIZI, AND WHY IT NEEDS ITS OWN FOLD RATHER THAN A BRANCH IN THE ONE ABOVE.
 *
 * Franco-Arab: Arabic typed in Latin letters with digits standing in for the
 * sounds Latin has no letter for. `3` is ع, `7` is ح, `2` is a glottal stop or
 * ق, `5` is خ, `6` is ط, `9` is ص. It is how a very large share of young
 * Egyptians type on a phone, and the crisis phrase list could not read a word
 * of it: English, Arabic script and Egyptian dialect in Arabic script, and
 * nothing for the register somebody actually uses at 3am on WhatsApp.
 *
 * That is the same gap sprint 32 found when Arabic sensitivity scored 0%, one
 * alphabet over. The market is Egypt.
 *
 * ## 🔴 A SEPARATE FOLD, BECAUSE THE MAIN ONE MUST NOT CHANGE
 *
 * Arabizi has no standard spelling: `3ayez`, `3ayz`, `3aiz`, and `amoot`,
 * `amout`, `amut` are all the same two words. Collapsing doubled letters and
 * unifying the vowel runs is what makes a list of them matchable.
 *
 * Applying that to `fold` would break the English list in the same file:
 * "better off dead" would collapse to "beter of dead" and stop matching the
 * sentence it was written for. So this is its own function, used by its own
 * matcher, over its own list. Two folds, each total, neither touching the
 * other's alphabet.
 *
 * 🔴 NOT EXPORTED. `containsArabizi` is the whole public surface, the same way
 * `contains` is for `fold`. A normaliser reachable from outside is a normaliser
 * somebody applies to half a comparison, and this repository has had two
 * folding defects already, both from a second normaliser written beside the
 * first.
 */
function foldArabizi(text: string): string {
  return (
    text
      .toLowerCase()
      /* Anything that is not a letter or one of the six digits is a space. */
      .replace(/[^a-z234567890]+/g, " ")
      /* `ou` and `ow` are both the long u everyone writes three ways. */
      .replace(/o[uw]/g, "o")
      /* A doubled letter is one letter. `amoot` and `amot` are one word. */
      .replace(/([a-z])\1+/g, "$1")
      /* Word-final `y` and `i` are the same sound: `nefsy`, `nefsi`. */
      .replace(/y\b/g, "i")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * 🔴 The same empty-needle rule as `contains`, for the same reason.
 *
 * A phrase that folds to nothing would match every sentence ever written. That
 * defect has happened twice in this repository already, in two different
 * normalisers, and both times it turned a scanner into something that alerted
 * on everything. A third normaliser gets the guard at birth.
 */
export function containsArabizi(haystack: string, needle: string): boolean {
  const folded = foldArabizi(needle);
  if (folded.length === 0) return false;
  return foldArabizi(haystack).includes(folded);
}
