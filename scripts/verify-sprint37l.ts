/**
 * Sprint 37L acceptance: the product speaks Arabic. PLAN.md 37L.1 to 37L.8.
 *
 *   npm run verify:sprint37l
 *
 * ## What this gate is really for
 *
 * Not "is there Arabic" — there has been Arabic since sprint 19. The failure
 * C182 names is that **nothing counted what was left**, so three sprints of
 * genuine translation work were each followed by fourteen sprints of English.
 * A rule with no number behind it drifts.
 *
 * So the centre of this file is the ratchet: English left in the markup, per
 * surface, which may only go down. Everything else here checks the properties
 * that make the ratchet meaningful — that the dictionary is complete in both
 * languages, that the patient's own screens are finished rather than merely
 * improved, and that the safety copy is translated and carries no country's
 * phone number.
 */
import { readFileSync, readdirSync } from "node:fs";

import { ar, en } from "../lib/i18n/messages";
import { isSafetyKey } from "../lib/i18n/strings";
import { stripComments } from "./_dashes";
import { bySurface, literalsIn, scanI18n, surfaceOf, type Surface } from "./_i18n-coverage";
import { reporter, readSource } from "./_verify";

const { check, finish } = reporter();

const RATCHET = JSON.parse(readFileSync("scripts/_i18n-coverage.json", "utf8")) as {
  surfaces: Record<Surface, number>;
};

/** Every page under the patient's own route group, however deep. */
function patientPages(dir = "app/(patient)", out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) patientPages(`${dir}/${entry.name}`, out);
    else if (entry.name === "page.tsx") out.push(`${dir}/${entry.name}`);
  }
  return out;
}

function main() {
  console.log("\nSprint 37L, the product speaks Arabic\n");

  /* ------------------------------------------------ 37L.5 · the dictionary */

  const enKeys = Object.keys(en);
  const arKeys = Object.keys(ar);

  check(
    "37L.5 every shipped string exists in both languages",
    enKeys.length === arKeys.length && enKeys.every((key) => key in ar),
    `${enKeys.length} keys, both languages`,
  );

  /*
   * 🔴 An Arabic value that is the English one is a key somebody forgot.
   *
   * The type system guarantees the key exists; it cannot guarantee anybody
   * translated it. Copying the English string is what a hurried author does,
   * and it is invisible in a diff of 300 lines.
   */
  /*
   * 🔴 Brand names, which are the same word in every language.
   *
   * The existing exemption above covers a SINGLE token, so "Zoom" passed and
   * "Google Meet" did not. Microsoft ships "Microsoft Teams" untranslated in
   * its own Arabic interface and Google ships "Google Meet"; transliterating
   * them here would produce a label an Egyptian clinician has never seen on
   * the product they are being asked to join.
   *
   * Listed by exact value rather than by key prefix, so a key that stops
   * holding a brand name stops being exempt on the same edit, and the CONTROL
   * below proves the list is not swallowing ordinary English.
   */
  const BRAND_NAMES = new Set(["Google Meet", "Microsoft Teams", "Zoom", "24Therapy"]);

  const untranslated = enKeys.filter((key) => {
    const english = en[key as keyof typeof en] as string;
    const arabic = ar[key as keyof typeof ar];
    /* Proper nouns and addresses are legitimately identical. */
    if (/^[A-Za-z0-9@._+-]+$/.test(english.trim())) return false;
    if (BRAND_NAMES.has(english.trim())) return false;
    return english.trim() === arabic.trim();
  });

  check(
    "🔴 37L.5 no Arabic string is a copy of the English one",
    untranslated.length === 0,
    untranslated.slice(0, 3).join(", ") || `${enKeys.length} values compared`,
  );

  const noArabic = arKeys.filter((key) => {
    const value = ar[key as keyof typeof ar].trim();
    /*
     * An example address is the same in every language. `you@example.com` is
     * what somebody types over, not something to translate, and a checker that
     * demanded Arabic letters in it would be demanding a worse placeholder.
     */
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
    if (BRAND_NAMES.has(value)) return false;
    /* A value with no Arabic letters at all is English left behind. */
    return !/[؀-ۿ]/.test(value) && /[A-Za-z]{4}/.test(value);
  });

  /*
   * 🔴 CONTROL — the brand list is a list, not a hole.
   *
   * An exemption set is exactly where an untranslated string goes to hide, so
   * this asserts that ordinary English is still caught while a brand name is
   * not. Without it, widening the set one entry at a time is invisible.
   */
  check(
    "🔴 37L.5 CONTROL, the brand-name exemption does not swallow ordinary English",
    !BRAND_NAMES.has("Sign in") && !BRAND_NAMES.has("Start") && BRAND_NAMES.has("Zoom"),
    `${BRAND_NAMES.size} brand names exempt, each a word that is the same in Arabic`,
  );

  check(
    "🔴 37L.5 CONTROL, the same scan CATCHES an Arabic value with no Arabic in it",
    !/[؀-ۿ]/.test("Sign in") && /[A-Za-z]{4}/.test("Sign in"),
    noArabic.length === 0 ? "and there are none" : `found: ${noArabic.slice(0, 3).join(", ")}`,
  );

  check(
    "37L.5 …and none is left in English",
    noArabic.length === 0,
    noArabic.slice(0, 3).join(", ") || `${arKeys.length} Arabic values`,
  );

  /* ------------------------------------------------- 37L.1 · the patient app */

  const counts = scanI18n();
  const totals = bySurface(counts);
  const patientFiles = counts.filter(
    (count) => surfaceOf(count.file) === "patient" && count.literals > 0,
  );

  /*
   * The patient app is the one surface this sprint finishes rather than
   * improves, so it is asserted by name rather than by ratchet. The three
   * files still counted are the CLINICIAN's view of a patient's record, which
   * live in the same folder and belong to 37L.2.
   */
  const CLINICIAN_FACING = ["record-access", "access-banner", "patient-editor"];
  const stragglers = patientFiles.filter(
    (count) => !CLINICIAN_FACING.some((name) => count.file.includes(name)),
  );

  check(
    "🔴 37L.1 every patient screen asks the dictionary, and none carries English",
    stragglers.length === 0,
    stragglers.map((s) => s.file).join(", ") ||
      `${patientPages().length} pages, ${CLINICIAN_FACING.length} clinician-facing files deferred to 37L.2`,
  );

  /*
   * A page that renders one component and no text of its own has nothing to
   * resolve, and demanding a `t` it never calls would be demanding a lie. The
   * property that matters is: no page carries text it did not ask for.
   */
  const untranslatedPages = patientPages().filter((file) => {
    const source = readSource(file);
    if (/getI18n\(\)|useT\(\)/.test(source)) return false;
    return literalsIn(source).length > 0;
  });

  check(
    "🔴 37L.1 …and every one that has text of its own resolves it at render",
    untranslatedPages.length === 0,
    untranslatedPages.join(", ") ||
      `${patientPages().length} patient pages, two of which render a component and no text`,
  );

  /*
   * 🔴 A hook in a server component is a screen that throws, and neither the
   * typechecker nor the build says so.
   *
   * Found by running the app: `useT()` was added to three components that had
   * no `"use client"`, and the patient's home screen and session list returned
   * a 500 while `tsc` and `next build` were both clean. The fix is
   * `getI18n()` in a server component; the guard is this check, because the
   * next person translating a file will reach for the hook they saw in the
   * file beside it.
   */
  /*
   * 🔴 §6 again, and this is the seventh occurrence: comments are stripped
   * BEFORE the scan. Without this the guard flagged
   * `components/memory/standing-profile.tsx` for the sentence in its own
   * comment explaining that `useT()` there was the bug it had just stopped
   * being. A checker that matches the prose describing the defect is a
   * checker that reports the fix as the fault.
   */
  const hookInServer = counts.filter((count) => {
    const raw = readSource(count.file);
    const source = stripComments(raw);
    return /\buseT\(\)/.test(source) && !raw.startsWith('"use client"');
  });

  check(
    "🔴 37L.1 no server component calls the client hook",
    hookInServer.length === 0,
    hookInServer.map((h) => h.file).join(", ") ||
      "a hook in a server component builds clean and throws at request time",
  );

  /* ------------------------------------------------------- 37L.6 · the ratchet */

  const rises = (Object.keys(RATCHET.surfaces) as Surface[]).filter(
    (surface) => totals[surface] > RATCHET.surfaces[surface],
  );

  check(
    "🔴 37L.6 no surface has more English in it than the recorded high-water mark",
    rises.length === 0,
    rises.map((s) => `${s} ${totals[s]} > ${RATCHET.surfaces[s]}`).join(", ") ||
      (Object.keys(totals) as Surface[])
        .map((s) => `${s} ${totals[s]}/${RATCHET.surfaces[s]}`)
        .join(" · "),
  );

  check(
    "🔴 37L.6 CONTROL, the ratchet CATCHES a surface that grew",
    (() => {
      const pretend = { ...totals, patient: RATCHET.surfaces.patient + 1 };
      return (Object.keys(RATCHET.surfaces) as Surface[]).some(
        (surface) => pretend[surface] > RATCHET.surfaces[surface],
      );
    })(),
    "one more English sentence on a patient screen fails this gate",
  );

  /*
   * 🔴 65 — THE THIRD PHANTOM FAMILY, AND ITS CONTROL IN BOTH DIRECTIONS.
   *
   * Sprint 65 added an icon map to the patient home, `anxiety: <Zap … />,` line after
   * line, and the scanner read the `, depression:` between one `/>` and the next `<` as
   * visible English. Fourteen phantoms in one file, which is the same shape sprints 51
   * and 53 each had to correct.
   *
   * Blinding a scanner is cheaper than correcting one and is how a ratchet quietly stops
   * ratcheting, so the rejection is asserted BOTH WAYS: the object-literal shape does not
   * count, and a genuine label that happens to end in a colon still does.
   */
  check(
    "🔴 65 an object-literal entry between two elements is not visible English",
    literalsIn('const I = { a: <Zap x="1" />, depression: <Rain x="1" /> };').length === 0,
    "`, depression:` is code; a scanner that counts it moves when somebody adds a specialty",
  );

  check(
    "🔴 65 CONTROL …and a real label that ends in a colon is still counted",
    literalsIn('<dt>Your name, to them:</dt>').length === 1,
    "rejecting every colon would blind the scanner instead of correcting it",
  );

  /* 🔴 W3: the fourth phantom family and a route, asserted both ways like 65's. */
  check(
    "🔴 W3 code between two elements and a bare route are not visible English",
    literalsIn('{ terms: (<a x="1">T</a>), privacy: (<b x="1" />) }').length === 0 &&
      literalsIn('<a href="/login">/login</a>').length === 0,
    "`), privacy: (` is code and `/login` is the same in every language",
  );

  check(
    "🔴 W3 CONTROL …and a sentence with parentheses or a route inside it is still counted",
    literalsIn("<p>Notes (optional) go here</p>").length === 1 &&
      literalsIn("<p>Sign in at /login today</p>").length === 1,
    "the rules match whole shapes, not every parenthesis or slash",
  );

  /* -------------------------------------------------- 🔴 37L.5 · safety copy */

  const safetyKeys = enKeys.filter((key) => isSafetyKey(key));

  check(
    "🔴 37L.5 every crisis, consent and recording string is Arabic",
    safetyKeys.every((key) => /[؀-ۿ]/.test(ar[key as keyof typeof ar])),
    `${safetyKeys.length} safety strings, all translated`,
  );

  /*
   * 🔴 C184 again, and this time found by translating rather than by walking.
   *
   * Three more components printed `988` to every reader: the live session
   * screen, the feedback page and the radar's safety line. None of them was as
   * bad as the orb — each said "in the US" — but each was the only concrete
   * number an Egyptian patient was given, and the dictionary already had a
   * sentence that is true everywhere.
   */
  const markup = counts
    .map((count) => readSource(count.file))
    .filter((source) => !source.includes("_i18n-coverage"));

  /*
   * 🔴 Comments stripped first, and this check learned that the hard way twice
   * in two sprints: `verify:sprint37r` matched a comment quoting the sentence
   * it was looking for, and this one matched a doc comment on a type property
   * explaining why the Arabic prints no US number. C84's shape, both times.
   */
  const hardcoded = counts.filter((count) =>
    /\b988\b/.test(stripComments(readSource(count.file))),
  );

  check(
    "🔴 C184 no component prints a crisis number of its own, in either language",
    hardcoded.length === 0,
    hardcoded.map((h) => h.file).join(", ") || `${markup.length} files scanned`,
  );

  check(
    "🔴 C184 CONTROL, the same scan CATCHES the line that was in the session room",
    /\b988\b/.test("emergency number, in the US, call or text 988."),
    "it was there until this sprint",
  );

  /* ------------------------------------------------------ 37L.7 · direction */

  const layout = readSource("app/layout.tsx");
  check(
    "37L.7 direction is set on the server, from the request, once",
    /dir=\{dirFor\(locale\)\}/.test(layout),
    "a layout that flips after hydration shows a frame of the wrong direction",
  );

  finish("Sprint 37L");
}

main();
