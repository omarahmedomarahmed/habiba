/**
 * The two-ink palette, enforced rather than described.
 *
 *     npm run verify:palette
 *
 * ## The defect this exists for
 *
 * `app/globals.css` has carried a division of labour since the blue came out:
 *
 *     navy   the ground, the structure, the ink
 *     brand  the thing you press, and the thing you press it against
 *     teal   live, now, and anything on the radar's own dark ground
 *
 * It was true of that file and of nothing else. A sweep found 409 `teal-*`
 * class names and 277 of them were doing interface work in files that have
 * never been near the radar: a Saved message, an invite badge, a ledger icon,
 * a copilot card, a benefits form.
 *
 * Nothing looked wrong, which is the whole reason it spread. The two ramps are
 * IDENTICAL at 400 and 500 and one perceptual step apart everywhere else, so
 * every individual wrong choice rendered fine and the rule quietly stopped
 * meaning anything. A rule with no visible consequence and no check is a
 * comment.
 *
 * ## And one that did look wrong, if anybody had measured it
 *
 * Eighteen hand-rolled buttons carried `bg-teal-500 text-white`. White on
 * #2ec4b6 is 2.17:1. That is under the 4.5 body text needs and under the 3.0
 * that even large text needs, and their hover went to 600, which is 3.22:1, so
 * the interaction failed in both states. `components/ui/index.tsx` had been
 * fixed months earlier; the buttons somebody wrote by hand had not.
 *
 * ## Why a file-level rule for the ramps
 *
 * "Is this particular dot live?" is a judgement every reader re-litigates.
 * "Does this file draw the radar or a live session?" is a fact. And the
 * file-level rule costs nothing, because the shades live indicators actually
 * use — 400 and 500 — are the two the ramps share exactly.
 */
import { readdirSync, readFileSync } from "node:fs";

import { reporter } from "./_verify";

const { check, finish } = reporter();

/**
 * 🔴 The only files whose job is "live, now, or the radar's own dark ground".
 *
 * A list rather than a glob for the five outside `components/radar/`, so that
 * adding a sixth is a deliberate edit to this file with a reviewer on it.
 */
const TEAL_FILES = new Set([
  "components/admin/radar-command.tsx",
  "components/admin/total-view.tsx",
  "components/demo/session-demo.tsx",
  "components/marketing/state-dot.tsx",
  "components/session/session-room.tsx",
]);
const TEAL_DIRS = ["components/radar/"];

const mayUseTeal = (file: string) =>
  TEAL_FILES.has(file) || TEAL_DIRS.some((dir) => file.startsWith(dir));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx") || path.endsWith(".ts")) out.push(path);
  }
  return out;
}

/* The ramps, from `app/globals.css`. Kept here so the check can MEASURE. */
const BRAND: Record<string, string> = {
  "50": "#edfbf8", "100": "#cbf4ed", "200": "#9ae9de", "300": "#5fdccc",
  "400": "#38d0be", "500": "#2ec4b6", "600": "#1f9d92", "700": "#15746c",
  "800": "#0e544e", "900": "#083732",
};
const TEAL: Record<string, string> = {
  "50": "#e6faf7", "100": "#c0f2eb", "200": "#8ae7db", "300": "#55dbcb",
  "400": "#38d0be", "500": "#2ec4b6", "600": "#23a094", "700": "#1a7a71",
  "800": "#12564f", "900": "#0b3833",
};
const WHITE = "#ffffff";
const NAVY_600 = "#091e39";

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

function main() {
  const files = [...walk("app"), ...walk("components"), ...walk("lib")];

  /* ================================================================== */
  /*  The ramps answer different questions, so they live in different    */
  /*  files                                                              */
  /* ================================================================== */

  const strays: string[] = [];
  for (const file of files) {
    if (mayUseTeal(file)) continue;
    const source = readFileSync(file, "utf8");
    const hits = source.match(/\bteal-\d+\b/g);
    if (hits) strays.push(`${file} (${[...new Set(hits)].sort().join(" ")})`);
  }

  check(
    "🔴 `teal-*` appears only where the job is live, now, or the radar's dark ground",
    strays.length === 0,
    strays.slice(0, 8).join(" · ") || `${files.length} files scanned, brand everywhere else`,
  );

  /*
   * 🔴 CONTROL — the allow-list has to be an allow-list rather than a sieve.
   *
   * The clause above passes trivially if `mayUseTeal` returns true for
   * everything, and it would still read as a passing check. Asking it about a
   * file that is plainly not the radar proves it says no to something.
   */
  check(
    "🔴 CONTROL the allow-list refuses a file that is not the radar",
    mayUseTeal("components/billing/ledger.tsx") === false &&
      mayUseTeal("components/radar/globe.tsx") === true,
    "the ledger may not, the globe may",
  );

  /* ================================================================== */
  /*  Nothing defined off the ramp                                       */
  /* ================================================================== */

  /*
   * 🔴 `teal-950` WAS NOT A SHADE THIS PRODUCT HAS.
   *
   * The `@theme` block defines 50 through 900. Tailwind keeps its own default
   * for any key the block does not name, so `text-teal-950` silently resolved
   * to stock #042f2e — a colour from nobody's logo pack, on a patient's brief
   * card. It rendered as very dark ink and read as deliberate.
   */
  const offRamp: string[] = [];
  for (const file of files) {
    const hits = readFileSync(file, "utf8").match(/\b(?:brand|teal)-(\d+)\b/g) ?? [];
    for (const hit of hits) {
      const shade = hit.split("-")[1]!;
      if (!(shade in BRAND)) offRamp.push(`${file}: ${hit}`);
    }
  }

  check(
    "🔴 every brand and teal shade used is one the @theme block defines",
    offRamp.length === 0,
    offRamp.slice(0, 6).join(" · ") || "50 through 900, nothing outside it",
  );

  check(
    "🔴 CONTROL a shade the block does not define would be caught",
    !("950" in BRAND) && !("950" in TEAL),
    "the ramps stop at 900, which is what makes 950 a fall-through",
  );

  /* ================================================================== */
  /*  White never goes on the light end of either ramp                   */
  /* ================================================================== */

  /*
   * The measurement that decides it, recomputed here rather than quoted, so a
   * future re-cut of the ramp moves this check with it.
   */
  const whiteOn500 = contrast(WHITE, BRAND["500"]!);
  const navyOn500 = contrast(NAVY_600, BRAND["500"]!);

  check(
    "🔴 white on the pressable ground fails, and navy on it passes",
    whiteOn500 < 3 && navyOn500 >= 4.5,
    `white ${whiteOn500.toFixed(2)}:1 · navy ${navyOn500.toFixed(2)}:1`,
  );

  /*
   * 🔴 SO NOTHING MAY PAIR THEM. A line, not a file: these are single class
   * strings where a ground and an ink sit three words apart.
   */
  /*
   * 🔴 AND 600 IS IN THE BAN, which the first version of this check left out.
   *
   * White on 600 is 3.34:1. That clears the 3.0 a border or large text needs
   * and misses the 4.5 for body text, so it looks like a legal shade and is
   * not one for a button label. A crawler reading computed pixels found five
   * of them — two admin buttons, a transfer chip, the step dot and the whole
   * earnings card — plus two more in the radar's booking sheet.
   *
   * They are 500 grounds now, which is what the ramp calls THE GROUND anyway;
   * 600 is for press, edges and rings, and a resting button sitting on the
   * pressed shade was the other half of the same mistake.
   */
  const whiteInk: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const ground = /bg-(?:brand|teal)-(400|500|600)\b/.exec(line);
        if (!ground || !/\btext-white\b/.test(line)) return;
        /* `bg-slate-900 text-white` on the same line is not this defect. */
        if (/bg-(?:slate|navy)-\d+ text-white/.test(line)) return;
        whiteInk.push(`${file}:${index + 1} (${ground[0]})`);
      });
  }

  const whiteOn600 = contrast(WHITE, BRAND["600"]!);

  check(
    "🔴 no white ink on a 400, 500 or 600 ground, anywhere",
    whiteInk.length === 0,
    whiteInk.slice(0, 8).join(" · ") ||
      `navy is the ink on all three (white on 600 is only ${whiteOn600.toFixed(2)}:1)`,
  );

  check(
    "🔴 CONTROL …and 600 really is too light for white body text",
    whiteOn600 < 4.5,
    `${whiteOn600.toFixed(2)}:1, which is why it is in the ban and not just 400 and 500`,
  );

  const planted = 'className="rounded-xl bg-brand-500 px-4 text-white"';
  check(
    "🔴 CONTROL the same sweep still catches a white-on-teal button",
    /bg-(?:brand|teal)-(?:400|500)\b/.test(planted) && /\btext-white\b/.test(planted),
    "so a passing run means there are none, not that the pattern stopped matching",
  );

  /* ================================================================== */
  /*  600 is an edge, not an ink                                         */
  /* ================================================================== */

  /*
   * 🔴 THE RAMP COMMENT ASSIGNS 600 TO "press, edges, rings" AND 700 TO INK.
   *
   * 600 on white is 3.34:1. That clears the 3.0 a border, a focus ring, an
   * icon or large text needs, and misses the 4.5 that body text needs. Three
   * small labels were using it as ink: a Saved message, a copied confirmation
   * and a date caption, all at 10 to 12 pixels.
   *
   * The check is narrow on purpose. It looks for a 600 ink on a line that also
   * carries a SMALL text size, because those are the ones the measurement
   * actually rules out, and a gate that also failed the large-value tiles
   * would be reporting a failure that is not one.
   */
  const SMALL = /\btext-(?:xs|\[1[0-3]px\]|\[0\.\d+rem\])\b/;
  const smallInk: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (/\btext-(?:brand|teal)-600\b/.test(line) && SMALL.test(line)) {
          smallInk.push(`${file}:${index + 1}`);
        }
      });
  }

  const inkOnWhite600 = contrast(BRAND["600"]!, WHITE);
  const inkOnWhite700 = contrast(BRAND["700"]!, WHITE);

  check(
    "🔴 600 is not used as ink at a size the measurement rules out",
    smallInk.length === 0,
    smallInk.slice(0, 6).join(" · ") ||
      `600 is ${inkOnWhite600.toFixed(2)}:1 and 700 is ${inkOnWhite700.toFixed(2)}:1 on white`,
  );

  check(
    "🔴 CONTROL …and the shade it defers to actually clears the bar",
    inkOnWhite600 < 4.5 && inkOnWhite700 >= 4.5,
    "otherwise this check would be moving text from one failure to another",
  );

  /* ================================================================== */
  /*  A tint is not white, and the quiet ink knows the difference       */
  /* ================================================================== */

  /*
   * 🔴 THE ONE THE BROWSER FOUND THAT ONLY PRODUCTION'S DATA COULD SHOW.
   *
   * `text-slate-500` is the quiet ink everywhere and it is correct on white,
   * at 4.76:1. Drop it on `bg-slate-100` and it is 4.35:1, which is a miss by
   * a fifteenth of a point and a miss all the same.
   *
   * `verify:contrast` caught two of these on localhost and reported the rest
   * green, because the demo data had no therapist without a photo on that
   * screen. Production did, and the same page came back with two more of the
   * identical fallback in two other components. A browser can only measure
   * what the data renders; a source check has no such excuse, so the pairing
   * is banned here where the data cannot hide it.
   *
   * 🔴 `hover:bg-slate-100` IS NOT THIS. That element rests on white, where
   * slate-500 passes, and a hover tint is a different question from a resting
   * one. The lookbehind is what keeps this check to the case it can prove.
   */
  const SLATE_100 = "#f1f5f9";
  const quietOnTint = contrast("#62748e", SLATE_100);
  const darkerOnTint = contrast("#45556c", SLATE_100);

  const onTint: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const resting = /(?<!hover:)(?<!focus:)\bbg-slate-100\b/.test(line);
        if (resting && /\btext-slate-500\b/.test(line)) onTint.push(`${file}:${index + 1}`);
      });
  }

  check(
    "🔴 the quiet ink is not slate-500 when the ground is a slate tint",
    onTint.length === 0,
    onTint.slice(0, 6).join(" · ") ||
      `slate-500 is ${quietOnTint.toFixed(2)}:1 on slate-100 and slate-600 is ${darkerOnTint.toFixed(2)}:1`,
  );

  check(
    "🔴 CONTROL …and the arithmetic is why, not a preference",
    quietOnTint < 4.5 && darkerOnTint >= 4.5,
    "a tint eats the margin that white leaves",
  );

  finish("palette");
}

main();
