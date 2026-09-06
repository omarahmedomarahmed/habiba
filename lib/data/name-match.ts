/**
 * Does the name somebody typed match the name on the record? PLAN.md 13.6.
 *
 * Pure and dependency-free — **not** `server-only` — so the comparison that
 * decides whether a person reaches their own clinical history is asserted in a
 * test rather than trusted. `lib/data/challenge.ts` is the module that uses it
 * and that one does touch the database.
 *
 * ## Wrong in either direction is a real harm
 *
 * Too strict and somebody cannot claim their own record because they typed
 * "sara" and the therapist wrote "Sara". Too loose and "Sarah" opens "Sara"'s
 * history. So: fold case, collapse whitespace, strip combining marks — and
 * nothing else. No fuzzy distance, no phonetics, no nicknames. A near-miss is
 * a miss, and the person is told to ask their therapist for an invite link.
 *
 * ## Two alphabets, one rule
 *
 * `NFKD` decomposes a character into its base plus its marks, and the marks are
 * then removed. That is one rule which happens to handle both `José` → `jose`
 * and `مُحَمَّد` → `محمد`: Arabic harakat are combining marks in exactly the same
 * sense as a French acute. It is a string comparison in both scripts, never a
 * transliteration between them.
 */

/**
 * Unicode combining marks: the general block, plus the Arabic range that
 * covers fatha, damma, kasra, shadda, sukun and tanwin.
 */
const COMBINING = /[̀-ͯؐ-ًؚ-ٰٟۖ-ۜ]/g;

export function normaliseName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 🔴 An empty offering never matches, even against an empty record.
 *
 * The failure this exists to stop: a blank submission normalising to `""` and
 * matching a record whose first name is somehow also blank. A name nobody
 * typed is not a name that was confirmed.
 */
export function nameMatches(offered: string | null | undefined, stored: string | null): boolean {
  const a = normaliseName(offered);
  if (a.length === 0) return false;
  return a === normaliseName(stored);
}
