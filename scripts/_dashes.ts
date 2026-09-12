/**
 * The dash ban, made checkable. PLAN.md 24.1, C117, §7.
 *
 * ## The rule
 *
 * U+2014 (em) and U+2013 (en) do not appear in anything a person reads: a CMS
 * default, a `ui_strings` row, a rendered page, an email body, a WhatsApp
 * template. They read as machine-written, and this product is asking people to
 * trust it with the worst week of their life.
 *
 * ## Where the line between copy and comment is drawn
 *
 * Comments are for developers and may say anything, including naming the
 * character. So every scan here **strips comments first**, and what is left of
 * a TypeScript file is code plus copy. A dash has no syntactic use in
 * TypeScript, so a dash surviving the strip is copy, with two exceptions that
 * have to be named rather than guessed:
 *
 *   - a file whose *job* is the dash — this one, its verifier, and the
 *     sanitiser that strips them;
 *   - `lib/i18n/config.ts`, where the Arabic comma and the digit rules are
 *     documented in string form.
 *
 * The allowlist is deliberately tiny and each entry is a file path, not a
 * pattern. A pattern would let the next offender in.
 *
 * 🔴 The characters themselves are never written into this file as literals —
 * they are built from their code points. Seven checkers in this repository
 * have now matched their own text; a dash checker containing dashes would be
 * the eighth and the most obvious.
 */

export const EM_DASH = String.fromCharCode(0x2014);
export const EN_DASH = String.fromCharCode(0x2013);

/** The pattern, built rather than typed. */
export const DASHES = new RegExp(`[${EM_DASH}${EN_DASH}]`, "g");

/** Files whose job is the character itself. Paths, never patterns. */
export const ALLOWED = [
  "scripts/_dashes.ts",
  "scripts/verify-sprint24.ts",
  "lib/text/dashes.ts",
];

/** Comments out. What remains of a TypeScript file is code and copy. */
export function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The same, with the line numbering intact. C205.
 *
 * `stripComments` deletes a block comment outright, which moves every line
 * after it. That is harmless for a checker asking "does this construct appear"
 * and wrong for one that reports a line number, so a blanket sweep across
 * every verifier needs this shape rather than that one: each removed line
 * leaves an empty line behind, and line N of the output is line N of the file.
 */
export function stripCommentsKeepingLines(source: string): string {
  const blanked = (match: string) => match.replace(/[^\n]/g, "");
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blanked)
    .replace(/\/\*[\s\S]*?\*\//g, blanked)
    .replace(/^(\s*)\/\/.*$/gm, "$1");
}

export type DashHit = { file: string; line: number; text: string };

/** Every dash left in one source once its comments are gone. */
export function dashesIn(file: string, source: string): DashHit[] {
  if (ALLOWED.includes(file)) return [];

  const stripped = stripComments(source);
  const hits: DashHit[] = [];

  stripped.split("\n").forEach((line, index) => {
    if (!DASHES.test(line)) return;
    DASHES.lastIndex = 0;
    hits.push({ file, line: index + 1, text: line.trim().slice(0, 90) });
  });

  return hits;
}

/** Every dash in a value that came out of the database. */
export function dashesInText(label: string, text: string): DashHit[] {
  DASHES.lastIndex = 0;
  if (!DASHES.test(text)) return [];
  DASHES.lastIndex = 0;
  return [{ file: label, line: 0, text: text.slice(0, 90) }];
}
