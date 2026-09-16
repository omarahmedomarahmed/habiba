/**
 * 🔴 65.1 / 65.2 — THE INVENTORY, AND IT IS A SCRIPT RATHER THAN A WALK-THROUGH.
 *
 *   npm run prose
 *   npm run prose -- --portal patient
 *
 * ## The founder's sentence, as a measurement
 *
 * > *There is too much text. On every single page of every single portal. Chunks of
 * > text that explain important things, important titles, important descriptions,
 * > important disclaimers. Instead of boxes of text everywhere, we need to visualize
 * > it into components, with minimal text.*
 *
 * ## 🔴 WHY THIS IS A SAFETY SCRIPT AND NOT A DESIGN ONE
 *
 * A disclaimer nobody reads is a disclaimer that does not exist. This repository has
 * spent fifty sprints making sure a rule is true in the database rather than in a
 * comment, and then rendered the rule to the person it protects as grey prose in a box
 * they scroll past.
 *
 * The measure is not "fewer words". It is whether the person can answer the question
 * the text was there to answer, and nothing automated can measure that. What this CAN
 * measure is where the walls are, which is the first thing nobody knew.
 *
 * ## 🔴 65.3 — AND IT COUNTS WORDS, NOT KEYS
 *
 * A wall split into four keys is the same wall. The unit is the word a person has to
 * read, summed per portal, which is the only unit the founder's sentence is in.
 *
 * ## 🔴 65.2 — A RATCHET, THE WAY `DEAD_EXPORT_BASELINE` WORKS
 *
 * `evals/prose.json` holds the high-water mark per portal, and this exits non-zero
 * when one rises. A sprint that adds a paragraph has to spend one, which is the whole
 * mechanism: H20's lesson is that a gate nobody can pass gets switched off, and a
 * gate that only ever moves in one direction is one somebody can live with.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { DEFAULT_PAGES } from "../lib/content/defaults";
import { DICTIONARIES } from "../lib/i18n/messages";
import { literalsIn, scanI18n, surfaceOf, type Surface } from "./_i18n-coverage";

const RATCHET = "evals/prose.json";

/**
 * 🔴 WHICH PORTAL A KEY BELONGS TO, AND THE MAP IS EXHAUSTIVE BY CONSTRUCTION.
 *
 * Every prefix in the dictionary resolves to one of these or to `other`, and `other`
 * is printed with its prefixes so it cannot quietly become the biggest bucket. A map
 * that silently dropped a prefix would be a ratchet with a hole in it.
 */
const PORTALS: Record<string, readonly string[]> = {
  /*
   * 🔴 THE EXPLICIT MAP WINS, and it exists for the prefixes the letter rule below
   * would get wrong. `pricing` and `portal` both start with `p` and are the public
   * site and the clinician's portal; `records` is a clinic setting.
   *
   * 🔴 AND EVERY LINE OF IT IS CHECKED BY GREP, NOT BY WHAT THE PREFIX SOUNDS LIKE.
   *
   * `home` sat under `public` for exactly that reason: the word means the front door
   * of the marketing site to anybody reading the map, and every one of those keys is
   * rendered by `app/(patient)/patient/page.tsx`. The patient app's own home screen,
   * the worst wall in the product and the one 65.5 is written about, was being counted
   * against the public site's ratchet and subtracted from the patient's.
   *
   * A misattributed prefix is worse than an unattributed one, because `other` is
   * printed and this was not. The method that settles it is one command:
   *
   *   grep -rn 't("<prefix>\.' app components lib
   *
   * and the portal is wherever the call sites are. `radar` came back rendered by both
   * `/radar` and `/patient/radar`, which is what `shared` is for; `blocks` came back
   * public-only despite living beside `common` and `nav`.
   */
  patient: [
    "home",
    /*
     * 🔴 `error` is the PATIENT's, because there is exactly one route boundary using
     * it and it is `app/(patient)/error.tsx`. Left unattributed it landed in `other`,
     * which is a bucket with no ratchet: three strings a patient reads at the worst
     * moment they have on this product, counted against nobody.
     */
    "error",
    /*
     * `room` and `preset` are the PATIENT's too, checked the same way. `room.*` renders
     * in the join flow, the patient room, the rating form and the booking sheet and
     * nowhere else; `preset` is `components/patient/reset-form.tsx` and is a password
     * reset rather than a clinician's preset. The letter rule had `room` under the
     * clinician because it is the therapy room, which is a description of the place
     * rather than of who reads the words in it.
     */
    "room",
    "preset",
    "pclaim",
    "pbook",
    "prating",
    "pinvite",
    "benefit",
    "checkin",
    "consent",
    "browse",
    "feedback",
    "homework",
    "jconsent",
    "join",
    "journal",
    "residency",
    "risk",
  ],
  /*
   * 🔴 `pted` AND `pracc` ARE THE CLINICIAN'S, and the letter rule had them backwards.
   *
   * Both render on `app/(app)/patients/[id]/page.tsx`, the clinician's view of a
   * patient's record. They are named for what they are ABOUT rather than who reads
   * them, which is the same trap `home` fell into from the other direction. These are
   * the strings 37L.2 deferred, so having them counted against the patient app was
   * hiding work in the wrong column twice over.
   */
  clinician: [
    "portal",
    "import",
    "note",
    "spec",
    "pted",
    "pracc",
    /*
     * 🔴 76.40 — `pprof` AND `pinv` JOIN THEM, for the same reason and on the
     * same page. Checked the way this map insists on:
     *
     *   grep -rn 't("pprof\.' app components lib
     *   grep -rn 't("pinv\.' app components lib
     *
     * comes back as `app/(app)/patients/[id]/page.tsx` and
     * `components/patient/invite-to-session.tsx`, which that page renders. Both
     * are words a CLINICIAN reads about a patient. The letter rule would have
     * put 145 words of therapist copy in the patient app's column, which is the
     * exact misattribution the note above was written about.
     */
    "pprof",
    "pinv",
    /* `cassess` renders in `components/assessments/clinician-assessments.tsx`. */
    "cassess",
    /*
     * 🔴 76.16 — `bill` is the CLINICIAN's, and the letter rule would have made
     * it nobody's: `b` is not a portal. It landed in `other`, which has no
     * ratchet, and the sweep printing its unattributed prefixes is the only
     * reason it was caught in the same day it was written.
     *
     * Checked the way this map insists on:
     *
     *   grep -rn 't("bill\.' app components lib
     *
     * comes back as `components/billing/bill-picker.tsx`, rendered by
     * `app/(app)/billing/page.tsx` and nowhere else. It is the invoice picker a
     * therapist chooses their unpaid sessions from.
     */
    "bill",
  ],
  clinic: ["clinic", "records"],
  /*
   * 🔴 `topup` is the SPONSOR's, and the letter rule had it under the clinician
   * on the `t` — the same misattribution the note below this list was written
   * about. Checked the same way as the rest:
   *
   *   grep -rn 't("topup\.' app components lib
   *
   * comes back as one component, `components/billing/top-up-stepper.tsx`, which
   * renders on `/sponsor/pot` and nowhere else. A company's own screen counted
   * against a therapist's ratchet is prose nobody is asked to cut.
   */
  sponsor: ["sponsor", "sint", "topup"],
  partner: ["dev", "devs"],
  /*
   * 🔴 76.32 — `hdemo` IS THE PUBLIC SITE'S, checked by grep like the rest.
   *
   *   grep -rn 't("hdemo\.' app components lib
   *
   * Every one of them renders in `components/public/blocks.tsx`, inside the
   * marketing hero: they are the chrome around the demo session on the
   * homepage. The letter rule had nothing for `h`, so they arrived as an
   * `unattributed` bucket with no ratchet at all, which is a hole in the map
   * rather than a cost and is exactly what `home` did from the other side.
   */
  public: ["pricing", "contact", "public", "marketing", "blocks", "hdemo"],
  admin: ["admin", "aclinic", "apartner", "asponsor", "acheckin"],
  /*
   * 🔴 SHARED IS A REAL CATEGORY, NOT A BIN.
   *
   * `common`, `nav`, `lang`, `tab`, `when` and `urgent` render in more than one
   * portal, so attributing them to one would make that portal's ratchet move when a
   * different portal's chrome changed. They get their own line and their own number.
   */
  /*
   * 🔴 `transfer` is SHARED, checked the same way as the rest of this list.
   *
   *   grep -rn 't("transfer\.' app components lib
   *
   * comes back as one component, `components/billing/pay-by-transfer.tsx`, which is
   * rendered to a patient, a therapist, a clinic manager and a company finance team.
   * The letter rule would have put it under the clinician on the `t`, which is the
   * exact misattribution the note above this list was written about: a payment screen
   * counted against the wrong portal is a wall of text nobody is asked to cut.
   */
  /*
   * 🔴 `pop` and `bar` are SHARED for the same reason `transfer` is, checked the
   * same way:
   *
   *   grep -rn 't("pop\.' app components lib
   *   grep -rn 't("bar\.' app components lib
   *
   * come back as `components/billing/payment-popup.tsx` and
   * `components/billing/pending-bar.tsx`, both of which render for a patient, a
   * clinician, a clinic manager and a company finance team. Attributing them to
   * one portal would move that portal's ratchet when a different portal's
   * payment screen changed.
   */
  shared: [
    "common",
    "nav",
    "lang",
    "tab",
    "when",
    "urgent",
    "crisis",
    "radar",
    "nf",
    "transfer",
    "pop",
    "bar",
  ],
};

const PREFIX_TO_PORTAL = new Map<string, string>();
for (const [portal, prefixes] of Object.entries(PORTALS)) {
  for (const prefix of prefixes) PREFIX_TO_PORTAL.set(prefix, portal);
}

/**
 * 🔴 AND A LETTER RULE UNDERNEATH IT, so the map does not need a line per screen.
 *
 * This repository's dictionary is prefixed by portal already: `p…` is the patient
 * app, `t…` is the therapist's, `a…` is the back office. Sixty prefixes were falling
 * through to `other` because nobody had listed them, and a bucket nobody can attribute
 * is a ratchet nobody can act on: somebody lowers a portal's number by moving a key
 * into a prefix the map does not know.
 *
 * The explicit map above wins, so `pricing` stays public and `portal` stays the
 * clinician's.
 */
function portalOf(prefix: string): string {
  const explicit = PREFIX_TO_PORTAL.get(prefix);
  if (explicit) return explicit;

  if (/^p[a-z]/.test(prefix)) return "patient";
  if (/^t[a-z]/.test(prefix)) return "clinician";
  if (/^a[a-z]/.test(prefix)) return "admin";

  return "other";
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * 🔴 A BLOCK, and the threshold is where a sentence becomes a paragraph.
 *
 * Twenty-five words is about two sentences. Below it a string is a label, a button or
 * a line of help; above it somebody is being asked to read something, and that is the
 * thing this sprint is about.
 */
const BLOCK_WORDS = 25;

type Block = { key: string; portal: string; words: number; text: string };

function harvest(): Block[] {
  const out: Block[] = [];

  for (const [key, value] of Object.entries(DICTIONARIES.en)) {
    const text = String(value);
    const count = words(text);
    if (count === 0) continue;

    const prefix = key.split(".")[0]!;
    out.push({
      key,
      portal: portalOf(prefix),
      words: count,
      text,
    });
  }

  /*
   * 🔴 THE CMS PAGES TOO, because the public site's prose lives there rather than in
   * the dictionary and 65.14's 80% is measured across both. A sweep that read only
   * the dictionary would report the marketing site as nearly clean.
   */
  const walk = (node: unknown, path: string, portal: string) => {
    if (typeof node === "string") {
      const count = words(node);
      if (count > 0) out.push({ key: `content:${path}`, portal, words: count, text: node });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`, portal));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (["slug", "icon", "demo", "type", "href", "key"].includes(key)) continue;
        walk(value, `${path}.${key}`, portal);
      }
    }
  };

  /*
   * 🔴 LEGAL PAGES ARE COUNTED SEPARATELY, AND THAT IS A RULING RATHER THAN A DODGE.
   *
   * 65.14 asks for 80% less text on every page of the public site, and it was written
   * about the marketing pages: the founder's sentence is about *boxes of text that
   * explain important things*, not about a privacy notice.
   *
   * 🔴 A PRIVACY NOTICE IS NOT A WALL OF TEXT, IT IS THE PRODUCT. Cutting one by 80%
   * removes disclosures a regulator expects a reader to have been given, which is 65.23's
   * failure in its most expensive form: *hidden is not minimal, it is gone.* These four
   * pages therefore get their own number, which may not RISE either, so nothing can hide
   * in them — a marketing paragraph moved into `terms` shows up here rather than
   * vanishing.
   */
  const LEGAL = new Set(["privacy", "terms", "hipaa", "security"]);
  DEFAULT_PAGES.forEach((page, index) => {
    walk(page, `pages[${index}]`, LEGAL.has(page.slug) ? "legal" : "public");
  });

  /*
   * 🔴 AND THE ENGLISH STILL SITTING IN MARKUP, because otherwise the two ratchets fight.
   *
   * This swept the dictionary and the CMS and called that "words a person has to read".
   * It was not: `components/pay/pay-flow.tsx` had fourteen sentences hard-coded in its
   * JSX and this sweep could not see one of them, which meant a screen could be made
   * longer by typing into a component rather than into the dictionary.
   *
   * 🔴 IT ALSO PUT THE TWO GATES IN 65.24's PASS IN DIRECT OPPOSITION. Keying a literal
   * is the work `verify:sprint37l` asks for, and under a dictionary-only sweep it RAISED
   * this portal's number: 227 words moved out of markup and into the dictionary, and a
   * reader met exactly the same sentences before and after. A pass whose gates disagree
   * about whether an improvement happened is a pass somebody switches one half of off.
   *
   * So the unit is now the word a reader meets, wherever it is written. Moving a sentence
   * between the two is neutral here and an improvement there, which is the relationship
   * those two numbers should have had from the start.
   */
  for (const file of scanI18n()) {
    if (file.literals === 0) continue;
    for (const literal of literalsIn(readFileSync(file.file, "utf8"))) {
      const count = words(literal);
      if (count > 0) {
        out.push({
          key: `markup:${file.file}`,
          portal: PORTAL_OF_SURFACE[surfaceOf(file.file)],
          words: count,
          text: literal,
        });
      }
    }
  }

  return out;
}

/**
 * 🔴 THE TWO VOCABULARIES, LINED UP.
 *
 * `_i18n-coverage.ts` splits the product into five surfaces and this file into eight
 * portals, because they were written for different questions. `auth` is the clinician's
 * sign-in and the patient's, so it goes to `shared` rather than picking one.
 */
const PORTAL_OF_SURFACE: Record<Surface, string> = {
  patient: "patient",
  portal: "clinician",
  admin: "admin",
  auth: "shared",
  shared: "shared",
};

function totals(blocks: Block[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const block of blocks) out[block.portal] = (out[block.portal] ?? 0) + block.words;
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes("--portal") ? argv[argv.indexOf("--portal") + 1] : null;
  const write = argv.includes("--write");

  const blocks = harvest();
  const byPortal = totals(blocks);

  console.log("\n🔴 Prose sweep. Words a person has to read, per portal.\n");

  const ratchet = JSON.parse(readFileSync(RATCHET, "utf8")) as {
    baseline: Record<string, number>;
    origin?: Record<string, number>;
  };

  let rose = false;

  for (const portal of Object.keys(byPortal).sort()) {
    if (only && portal !== only) continue;

    const now = byPortal[portal]!;
    const was = ratchet.baseline[portal];
    const mark =
      was === undefined
        ? "NEW"
        : now > was
          ? `UP from ${was}`
          : now < was
            ? `down from ${was}, LOWER THE BASELINE`
            : "level";

    if (was !== undefined && now > was) rose = true;

    /*
     * 🔴 65.14 / THE ACCEPT LINE, AS A COLUMN RATHER THAN A JUDGEMENT.
     *
     * > *the prose ratchet is down by more than half in every portal and by 80% across
     * > the public site*
     *
     * A baseline that moves down every time somebody spends a paragraph cannot answer
     * that question: by the end it agrees with wherever the sprint stopped. `origin` is
     * the measurement this sprint started from and NOTHING writes to it, so the sprint's
     * own acceptance criterion is a number on this screen instead of a recollection.
     */
    const from = ratchet.origin?.[portal];
    const cut =
      from === undefined || from === 0
        ? ""
        : `   ${String(Math.round(((from - now) / from) * 100)).padStart(3)}% off ${from}`;

    console.log(`  ${String(now).padStart(6)}  ${portal.padEnd(10)} ${mark.padEnd(34)}${cut}`);
  }

  /*
   * 🔴 `other` IS PRINTED WITH ITS PREFIXES, so a map with a hole in it is visible.
   *
   * A prefix that falls through lands here, and a bucket nobody can attribute is a
   * ratchet nobody can act on: somebody would lower a portal's number by moving a key
   * into a prefix the map does not know.
   */
  const stray = new Set(
    blocks.filter((b) => b.portal === "other").map((b) => b.key.split(".")[0]!),
  );
  if (stray.size > 0) {
    console.log(`\n  unattributed prefixes: ${[...stray].sort().join(", ")}`);
  }

  /* The walls themselves, biggest first, because the list IS the work. */
  const walls = blocks
    .filter((b) => (!only || b.portal === only))
    .sort((a, b) => b.words - a.words);

  /*
   * 🔴 `--all` PRINTS EVERY BLOCK, and `--min` LOWERS THE FLOOR.
   *
   * Twenty is the right number to read at the start of a sprint and the wrong one to
   * work from: a portal with 43 walls is worked through in four passes, and each pass
   * needs the next twenty rather than the same twenty. `--min 12` matters too, because a
   * portal's total is mostly NOT its walls — 43 blocks of 25+ words are a third of the
   * patient app's count and the rest is two-line bodies under titles.
   */
  const all = argv.includes("--all");
  const floor = argv.includes("--min") ? Number(argv[argv.indexOf("--min") + 1]) : BLOCK_WORDS;
  const shown = walls.filter((wall) => wall.words >= floor);

  console.log(
    `\n  ${shown.length} blocks of ${floor}+ words. ${all ? "All of them:" : "The twenty largest:"}\n`,
  );
  for (const wall of all ? shown : shown.slice(0, 20)) {
    console.log(`  ${String(wall.words).padStart(4)}  ${wall.portal.padEnd(10)} ${wall.key}`);
    console.log(`        ${wall.text.slice(0, 100)}${wall.text.length > 100 ? "…" : ""}`);
  }

  if (write) {
    /*
     * 🔴 C364 — EVERYTHING ALREADY IN THE FILE IS CARRIED, not the four fields
     * this function happens to know about.
     *
     * The previous version built a fresh object from `comment`, `origin`,
     * `baseline` and `measuredOn`, and silently dropped every other key. By
     * sprint 71 those other keys were: `translated.removed`, the record of 25
     * dictionary keys deleted in sprint 65 and what replaced each one, which
     * `verify:sprint65` READS to assert they are genuinely gone; and the `c349`
     * and `sprint65` entries, which are the written arguments for two raised
     * floors. So the documented way to record a lowered baseline destroyed the
     * evidence behind three gates, and it survived only because nobody had run
     * `--write` since the block was added.
     *
     * That is C205's rule pointed at a writer rather than a reader: a record a
     * tool can quietly delete is a record no check can rely on. Spreading the
     * parsed file first makes the default KEEP rather than DROP, which is the
     * only safe default for a file whose contents outlive the code that writes
     * it.
     */
    writeFileSync(
      RATCHET,
      `${JSON.stringify(
        {
          ...(ratchet as Record<string, unknown>),
          /*
           * 🔴 `origin` IS CARRIED, NEVER RECOMPUTED. A `--write` that refreshed it
           * would make every portal 0% off its own current state, which is the shape
           * of a target that has been quietly redefined as whatever was achieved.
           */
          origin: ratchet.origin,
          baseline: byPortal,
          measuredOn: new Date().toISOString().slice(0, 10),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`\n  wrote ${RATCHET}\n`);
    return;
  }

  if (rose) {
    console.log("\n🔴 A portal's prose went UP. A sprint that adds a paragraph spends one.\n");
    process.exit(1);
  }

  console.log("\n  no portal rose.\n");
}

main();
