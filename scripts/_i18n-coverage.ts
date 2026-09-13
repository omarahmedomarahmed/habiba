/**
 * How much of the product still speaks only English. PLAN.md 37L.6, C182.
 *
 * ## 🔴 Why this file exists at all
 *
 * Sprint 19 translated the strings that existed. Sprint 21 made every string
 * editable by an administrator. Sprint 31 gave Arabic its own URLs. All three
 * shipped, all three work, and the **application** was never translated:
 * measured on `main` the day 37L started, 0 of 21 admin pages, 0 of 19 patient
 * pages and 2 of 20 therapist pages called the dictionary at all.
 *
 * Nothing was broken. Each sprint was scoped to the surface in front of it and
 * **nothing counted what was left**, so fourteen sprints wrote English past a
 * rule shipped in sprint 19. That is C157 one layer up: a rule with no number
 * behind it drifts, and the fix is the same one the region seam got — a static
 * count, printed, ratcheted, and impossible to satisfy by remembering.
 *
 * ## What is counted, and why it is the literals rather than the calls
 *
 * The obvious metric is "does this file call `t()`", and it is the wrong one:
 * a page that translates its heading and hard-codes the other forty strings
 * would pass. What a reader meets is **English text on the screen**, so that is
 * what this counts: literal text nodes in JSX, plus the handful of attributes
 * that are read aloud or shown (`aria-label`, `placeholder`, `title`, `alt`).
 *
 * The count is deliberately crude in one direction: it cannot tell a proper
 * noun from a sentence, so "24Therapy" and "SOAP" count against a file until
 * somebody moves them out of JSX or the file is allow-listed by name. Crude in
 * that direction is safe. Crude in the other — missing English that is really
 * there — is not, which is why there is no cleverness here to be wrong about.
 */
import { readFileSync, readdirSync } from "node:fs";

import { stripComments } from "./_dashes";

export type FileCount = {
  file: string;
  /** Visible English literals still in the markup. */
  literals: number;
  /** Does this file ask the dictionary at all? */
  translates: boolean;
  /** The first few, so a failure names something a person can go and fix. */
  examples: string[];
};

/** Directories whose text is not a product surface. */
const SKIP = new Set(["node_modules", ".next", "dist", "build"]);

/**
 * Files exempt by name, each for a stated reason.
 *
 * 🔴 Kept tiny and argued for individually. An exemption list is the obvious
 * way to make a ratchet meaningless, so every entry here is a file whose text
 * is genuinely not read by a patient or a clinician in their own language.
 */
const EXEMPT: Array<{ file: string; why: string }> = [
  { file: "app/(admin)/admin/strings/", why: "the translation console itself, staffed in English" },
  {
    file: "components/admin/strings-editor",
    why: "the same translation console, rendered. 45.5 added two sentences to it and the page half was already exempt for this reason; exempting the page and counting its only component was an accident of path rather than a decision",
  },
  { file: "components/admin/page-editor", why: "the CMS editor's own chrome, staffed in English" },
  { file: "app/(public)/", why: "CMS-driven: the rows are already published in both languages" },
  { file: "components/public/blocks", why: "renders CMS rows, which carry their own language" },
];

function exemptFor(file: string): string | null {
  return EXEMPT.find((entry) => file.includes(entry.file))?.why ?? null;
}

export function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/**
 * Visible text literals in one file.
 *
 * Two shapes, and no third:
 *
 *   `>Some words<`            a JSX text node
 *   `placeholder="Some words"` an attribute a reader sees or hears
 *
 * A run containing `{` is skipped: that is an expression, and its text lives
 * wherever the expression came from.
 */
export function literalsIn(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];

  /*
   * 🔴 The `>` that opens a text node is not the `>` of an arrow function.
   *
   * `(fn: () => Promise<State>)` gave this scanner a match of "Promise": the
   * `>` of `=>`, then a word, then the `<` of a type argument. Seven files
   * were carrying a phantom literal named `Promise`, and sprint 51 nearly
   * responded by rewriting real code to please a regex. A ratchet that counts
   * type annotations cannot be ratcheted, because the number moves when
   * somebody adds a generic.
   *
   * The preceding character is captured and an arrow is skipped. This LOWERS
   * the recorded floor, and it does so by correcting the measurement rather
   * than by translating anything, which is a different claim entirely and is
   * why `_i18n-coverage.json` says so where the numbers changed.
   */
  for (const match of code.matchAll(/(^|[^=])>([^<>{}]+)</g)) {
    const text = match[2]!.replace(/\s+/g, " ").trim();
    if (isVisibleEnglish(text)) found.push(text);
  }

  /*
   * 🔴 `label` AND `hint`, WHICH IS WHERE THIS CODEBASE ACTUALLY PUTS ITS FORM TEXT.
   *
   * The four attributes above are the generic HTML ones. They are not how a form in this repository
   * reaches a reader: `<Field label="Phone number or email" hint="…">` and `<Submit label="Sign in" />`
   * are, and there are 176 of them.
   *
   * 🔴 THE BLIND SPOT WAS DOCUMENTED AND ITS COST WAS NEVER COUNTED, which is the whole finding.
   * The note in `_i18n-coverage.json` said plainly that "a string passed as an ordinary prop is
   * invisible to it" and argued the ratchet was still right because it "cannot be satisfied by
   * remembering". It could. It could be satisfied by using a `label` prop — and the Arabic patient
   * sign-in page is the proof: heading, body and every hint in Arabic, and then **Phone number or
   * email**, **Password**, **Sign in** and **Send me a code** in English, on the first screen an
   * Arabic-speaking patient ever sees, with `t()` called three lines away in the same file.
   *
   * That is the §6 family landing on the instrument built to prevent it: a check that passed by
   * measuring the wrong thing, where the thing it could not measure was the majority of the text.
   *
   * These are counted by NAME rather than by any prop, because "every string-valued prop" would
   * sweep up ids, routes and variants and produce a number that moves when somebody renames a
   * variable — the failure sprints 51 and 53 each had to correct. `label` and `hint` are two names,
   * they are this repository's own, and both are rendered to the screen by `components/ui`.
   *
   * This RAISES the recorded floors, and raising a floor is a decision made on purpose with a reason
   * written down: `_i18n-coverage.json` carries it, and the patient surface is brought back down in
   * the same sprint rather than merely re-measured.
   */
  for (const match of code.matchAll(
    /\b(?:aria-label|placeholder|title|alt|label|hint)="([^"{}]+)"/g,
  )) {
    const text = match[1]!.trim();
    if (isVisibleEnglish(text)) found.push(text);
  }

  return found;
}

function isVisibleEnglish(text: string): boolean {
  if (text.length < 3) return false;
  /*
   * 🔴 Not code.
   *
   * `useState<string>("list")` ends in a `>` and is followed by code until the
   * next `<`, so a naive text-node scan reports `("list"); const [active,` as
   * a visible English string. Those are not merely noise: a scanner that
   * counts code cannot be ratcheted, because the number moves when somebody
   * renames a variable. Anything carrying the punctuation of an expression is
   * skipped, and the cost is that a genuine string containing a semicolon goes
   * uncounted, which is a sentence nobody writes.
   */
  if (/[;={}`[\]]|^\(|=>|\bconst\b|\breturn\b|\buseState\b/.test(text)) return false;
  /*
   * 🔴 A JSX TERNARY IS NOT A SENTENCE, and this is the second phantom family.
   *
   * The first was `=>` (see the note at the call site). This one is a relational
   * operator inside an expression container: `{benefits.length > 1 ? (` gives a
   * match running from that `>` to the next `<`, and the code it sweeps up
   * contains a four-letter identifier, so the letter test passes it. Two real
   * examples, both phantoms that were IN the recorded floor:
   *
   *     "1 ? ( benefit.isPrimary ? ("
   *     ") : canRequest && !open ? ("
   *
   * Sprint 51's ruling was that a ratchet counting type annotations cannot be
   * ratcheted, and the same holds for one that counts conditionals: the number
   * moves when somebody adds a branch. So the shapes are rejected by the
   * punctuation only code has — a `? (`, a `) :`, a `&&`, a `||` — rather than by
   * rejecting every parenthesis, which would also drop genuine prose like
   * "VAT (14%)".
   *
   * This LOWERS the recorded floor. It is a measurement correction and not
   * translation work, and `_i18n-coverage.json` says so where the numbers moved.
   */
  if (/\?\s*\(|\)\s*:|&&|\|\|/.test(text)) return false;
  /* Two words, or one word of four letters or more. A lone "OK" is not a
     sentence anybody notices; "Continue" is. */
  if (!/[A-Za-z]{4}/.test(text)) return false;
  /*
   * A bare identifier is not a sentence. `onClose,` sits between a `>` and a
   * `<` inside a props type and reads like text to a regex; a lone
   * lower-camel token followed by nothing but punctuation is code every time,
   * and interface copy starts with a capital or has a space in it.
   */
  if (!/\s/.test(text) && /^[a-z][A-Za-z0-9]*[,:;)?.]?$/.test(text)) return false;
  /* Anything already in Arabic is, by construction, not the problem. */
  if (/[؀-ۿ]/.test(text)) return false;
  return true;
}

export function scanI18n(roots = ["app", "components"]): FileCount[] {
  const out: FileCount[] = [];

  for (const root of roots) {
    for (const file of walk(root)) {
      if (exemptFor(file)) continue;
      const source = readFileSync(file, "utf8");
      const literals = literalsIn(source);
      out.push({
        file,
        literals: literals.length,
        translates: /\buseT\(\)|getI18n\(\)|\bt\(["'][a-z0-9]+\./.test(source),
        examples: literals.slice(0, 3),
      });
    }
  }

  return out.sort((a, b) => b.literals - a.literals);
}

export type Surface = "patient" | "auth" | "portal" | "admin" | "shared";

/** Which part of the product a file belongs to, for the per-surface ratchet. */
export function surfaceOf(file: string): Surface {
  if (file.includes("(patient)") || file.includes("components/patient/")) return "patient";
  if (file.includes("(auth)")) return "auth";
  if (file.includes("(admin)") || file.includes("components/admin/")) return "admin";
  if (file.includes("(app)") || file.includes("(room)")) return "portal";
  return "shared";
}

export function bySurface(counts: FileCount[]): Record<Surface, number> {
  const totals: Record<Surface, number> = {
    patient: 0,
    auth: 0,
    portal: 0,
    admin: 0,
    shared: 0,
  };
  for (const count of counts) totals[surfaceOf(count.file)] += count.literals;
  return totals;
}

if (process.argv[1]?.endsWith("_i18n-coverage.ts")) {
  const counts = scanI18n();
  const totals = bySurface(counts);
  console.log("\nEnglish literals still in the markup, by surface\n");
  for (const [surface, total] of Object.entries(totals)) {
    console.log(`  ${surface.padEnd(8)} ${String(total).padStart(5)}`);
  }
  console.log(`  ${"TOTAL".padEnd(8)} ${String(counts.reduce((n, c) => n + c.literals, 0)).padStart(5)}`);
  console.log("\nWorst twenty files\n");
  for (const count of counts.slice(0, 20)) {
    console.log(`  ${String(count.literals).padStart(4)}  ${count.file}`);
    console.log(`        e.g. ${count.examples.map((e) => `"${e.slice(0, 40)}"`).join(", ")}`);
  }
}
