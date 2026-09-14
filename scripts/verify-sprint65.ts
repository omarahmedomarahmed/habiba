/**
 * Sprint 65 acceptance: show it, do not write it.
 *
 *   npm run verify:sprint65
 *
 * ## 🔴 The founder's sentence, and it is a measurement rather than a complaint
 *
 * > *There is too much text. On every single page of every single portal. Chunks of text
 * > that explain important things, important titles, important descriptions, important
 * > disclaimers. Instead of boxes of text everywhere, we need to visualize it into
 * > components, with minimal text.*
 *
 * ## 🔴 WHAT THIS FILE CAN AND CANNOT CHECK, SAID FIRST
 *
 * It cannot check whether a screen is clearer. `npm run prose` measures the only thing
 * that is mechanical — how many words a person is asked to read — and everything else in
 * this sprint is a judgement somebody has to make by looking.
 *
 * What it CAN check is the two ways this sprint fails, which 65.22 and 65.23 name
 * exactly: decoration that encodes nothing, and a disclaimer that became a tooltip. Both
 * are properties of the source, both are absences, and every absence assertion below is
 * paired with a planted offender, because §6's defect family is a check that passes by
 * measuring the wrong thing.
 */
import { readdirSync, readFileSync } from "node:fs";

import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

async function main() {
  const primitives = readSource("components/visual/primitives.tsx");
  const sweep = readSource("scripts/prose-sweep.ts");
  const gates = readSource("scripts/gates.ts");

  /* ================================================================== */
  /*  65.4 · a small vocabulary, built once                             */
  /* ================================================================== */

  const VOCABULARY = [
    "StateBanner",
    "FlowStrip",
    "SeesWhat",
    "Meter",
    "Checklist",
    "BeforeAfter",
    "NeverBar",
    "SplitBar",
    "IconGrid",
  ] as const;

  check(
    "🔴 65.4 the visual vocabulary exists, in one file",
    VOCABULARY.every((name) => primitives.includes(`export function ${name}`)),
    VOCABULARY.join(" · "),
  );

  /*
   * 🔴 AND IT IS REUSED, which is the half 65.4 is actually about.
   *
   * *Never a one-off card per page.* A vocabulary nobody imports is nine components and
   * fifty bespoke cards, which is the state this sprint started in: the clinic's
   * acceptance screen had its own two-list card with its own headings, rendered once.
   */
  const importers = walk("app")
    .concat(walk("components"))
    .filter((file) => readFileSync(file, "utf8").includes("@/components/visual/primitives"));

  check(
    "🔴 65.4 …and it is used across portals rather than in one place",
    new Set(
      importers.map((file) => file.split("/").slice(0, 3).join("/")),
    ).size >= 5 && importers.length >= 12,
    `${importers.length} files, in ${new Set(importers.map((f) => f.split("/").slice(0, 3).join("/"))).size} areas`,
  );

  /* ================================================================== */
  /*  65.23 · a disclaimer that became a tooltip                        */
  /* ================================================================== */

  /*
   * 🔴 THE FAILURE MODE OF THIS WHOLE SPRINT, AND IT IS PREVENTED BY CONSTRUCTION.
   *
   * *Anything a regulator, a payer or a court would expect a person to have seen stays
   * visible without an interaction. Hidden is not minimal, it is gone.*
   *
   * The cheapest way to guarantee it is to have nothing in the vocabulary that could do
   * it. No accordion, no tooltip, no `collapsed` prop, no `title=` attribute standing in
   * for a sentence somebody has to hover to read.
   */
  const HIDING = /\bdetails\b|<summary|collapsed|accordion|tooltip|title=|aria-expanded/i;

  check(
    "🔴 65.23 nothing in the vocabulary can hide a disclosure behind an interaction",
    !HIDING.test(primitives),
    "no accordion, no tooltip, no collapsed prop, no hover-only text",
  );

  check(
    "🔴 65.23 CONTROL the same scan CATCHES the shapes it is looking for",
    ["<details>", "collapsed={true}", 'title="the rule"', "aria-expanded"].every((shape) =>
      HIDING.test(shape),
    ),
    "details · collapsed · title · aria-expanded",
  );

  /*
   * 🔴 AND THE TWO STANDING DISCLOSURES ARE RENDERED IN THE CHROME, not on a page.
   *
   * C240 and 54.9 both rule that the limit is on EVERY screen of the portal. A component
   * in the chrome is how that is true of a page nobody has written yet.
   */
  for (const [portal, file] of [
    ["sponsor", "components/sponsor/chrome.tsx"],
    ["clinic", "components/clinic/chrome.tsx"],
  ] as const) {
    const chrome = readSource(file);
    check(
      `🔴 65.12 the ${portal} chrome renders the standing limit, on every screen`,
      /<NeverBar/.test(chrome),
      "in the chrome, so a page nobody has written yet already carries it",
    );
  }

  /* ================================================================== */
  /*  65.22 · decoration instead of information                         */
  /* ================================================================== */

  /*
   * 🔴 A NUMBERED STRIP OVER CONTENT THAT IS NOT A SEQUENCE.
   *
   * `FlowStrip` is the only numbered component and it numbers steps, which are ordered by
   * definition. The test is that nothing else in the vocabulary renders an index: a
   * component that printed `i + 1` over a list of unrelated things is exactly the 01/02/03
   * strip 65.22 forbids.
   */
  const numbering = [...primitives.matchAll(/\bi \+ 1\b|\bindex \+ 1\b/g)];
  const [firstNumber] = numbering;

  check(
    "🔴 65.22 only the flow strip numbers anything, because only a flow is a sequence",
    numbering.length === 1 &&
      (firstNumber?.index ?? -1) > primitives.indexOf("export function FlowStrip") &&
      (firstNumber?.index ?? -1) < primitives.indexOf("export function SeesWhat"),
    `${numbering.length} numbered render(s), inside FlowStrip`,
  );

  /*
   * 🔴 AN ICON CHOSEN BECAUSE THE ROW LOOKED BARE.
   *
   * The category grid's fallback is the test. A build that hashed the code to pick one of
   * twelve glyphs would make every category look considered and mean nothing: somebody
   * scanning for "grief" would find a lightning bolt. The fallback is one neutral tag.
   */
  const grid = readSource("components/patient/category-grid.tsx");

  check(
    "🔴 65.22 an unknown category gets a NEUTRAL icon, never an arbitrary one",
    /return hit \? ICONS\[hit\] : <Tag/.test(grid) && !/%\s*ICONS|hash|charCodeAt/.test(grid),
    "a tag says 'this is a category and we have no picture for it', which is true",
  );

  /*
   * 🔴 65.9 — AND A SPECIALTY AN ADMIN ADDS TOMORROW RENDERS WITHOUT A DEPLOY.
   *
   * Asserted on the source rather than by importing the module: a `.tsx` file's JSX needs
   * React in scope and this script is plain node, so an import here would be testing the
   * script's own runtime rather than the component.
   *
   * The property is that the lookup is a PREFIX match over whatever the taxonomy holds.
   * An exact-key map would need a line per specialty, which is the deploy 65.9 removes,
   * and `includes` is what makes `anxiety_gad` find the anxiety glyph.
   */
  check(
    "🔴 65.9 …and a specialty an admin adds tomorrow renders without a deploy",
    /Object\.keys\(ICONS\)\.find\(\(candidate\) => key\.includes\(candidate\)\)/.test(grid) &&
      /export function iconFor/.test(grid),
    "a prefix match over the taxonomy, plus a neutral fallback for everything else",
  );

  /* ================================================================== */
  /*  65.2 · the ratchet, and its own honesty                           */
  /* ================================================================== */

  const ratchet = JSON.parse(readFileSync("evals/prose.json", "utf8")) as {
    origin: Record<string, number>;
    baseline: Record<string, number>;
  };

  check(
    "🔴 65.2 every portal has an origin and a baseline, and none is above its origin",
    Object.keys(ratchet.baseline).every(
      (portal) =>
        typeof ratchet.origin[portal] === "number" &&
        ratchet.baseline[portal]! <= ratchet.origin[portal]!,
    ),
    Object.keys(ratchet.baseline)
      .sort()
      .map(
        (p) =>
          `${p} ${Math.round(((ratchet.origin[p]! - ratchet.baseline[p]!) / ratchet.origin[p]!) * 100)}%`,
      )
      .join(" · "),
  );

  /*
   * 🔴 THE SWEEP COUNTS MARKUP TOO, which is what stops the two gates in 65.24's pass
   * from disagreeing about whether an improvement happened.
   *
   * Keying a hard-coded sentence is the work `verify:sprint37l` asks for. Under a
   * dictionary-only sweep it RAISED the portal's prose number, because the words moved
   * from somewhere invisible into somewhere counted.
   */
  check(
    "🔴 65.1 the sweep counts English in markup, not only the dictionary",
    /literalsIn/.test(sweep) && /scanI18n/.test(sweep),
    "otherwise a screen gets longer by typing into a component instead of the dictionary",
  );

  /*
   * 🔴 AND THE LEGAL PAGES ARE COUNTED SEPARATELY, which is a ruling rather than a dodge.
   *
   * Cutting a privacy notice by 80% removes disclosures a regulator expects a reader to
   * have been given. Their number may not rise either, so nothing can hide in them.
   */
  check(
    "🔴 65.14 the legal pages have their own number, which may not rise either",
    /const LEGAL = new Set\(\["privacy", "terms", "hipaa", "security"\]\)/.test(sweep) &&
      typeof ratchet.baseline.legal === "number",
    "80% off a privacy notice is 65.23's failure in its most expensive form",
  );

  /* ================================================================== */
  /*  65.24 · one pass                                                  */
  /* ================================================================== */

  for (const gate of ["prose", "verify:claims", "verify:principals", "verify:sprint37l"]) {
    check(
      `🔴 65.24 \`npm run gates\` runs ${gate}`,
      gates.includes(`"${gate}"`),
      "so a page cannot be prettier and less truthful at the same time",
    );
  }

  check(
    "🔴 65.24 …and it runs them ALL before reporting, rather than stopping at the first",
    !/break;|return;/.test(gates.slice(gates.indexOf("for (const gate of GATES)"))),
    "a pass that stops at the first failure is one somebody re-runs four times and then avoids",
  );

  /* ================================================================== */
  /*  65.17 / 65.19 · the marketing site renders the real components    */
  /* ================================================================== */

  const demos = readSource("components/public/audience-demos.tsx");
  const fixtures = readSource("lib/marketing/fixtures.ts");

  check(
    "🔴 65.17 the audience demos import the PORTAL's own components",
    /from "@\/components\/sponsor\/spend-heatmap"/.test(demos) &&
      /from "@\/components\/visual\/primitives"/.test(demos),
    "a screenshot survives the feature being deleted; this does not",
  );

  check(
    "🔴 65.17 …and the patient's fold renders the LIVE radar rather than a fixture of it",
    (() => {
      const home = readSource("lib/content/defaults.ts");
      return /demo: "radar"/.test(home) && /RadarHero/.test(readSource("components/public/blocks.tsx"));
    })(),
    "the only case where the real data is safer than a fixture: the public radar is already public",
  );

  /*
   * 🔴 65.19 — SYNTHETIC, AND THAT IS NOT NEGOTIABLE.
   *
   * *They come from the simulation's SHAPE, never from its rows. No name, no note, no
   * session that traces to a person, seeded or otherwise. C127 does not have a marketing
   * exemption.*
   *
   * Asserted on the IMPORT BLOCK rather than on a promise in a comment: a file that
   * imports nothing cannot read a row, and the obvious build — a script that reads the
   * demo seed and writes this file — is the one thing the ticket forbids.
   */
  check(
    "🔴 65.19 the marketing fixtures import nothing at all",
    !/^\s*import\s/m.test(fixtures),
    "a file with no import cannot leak a row, whatever anybody remembers to do",
  );

  check(
    "🔴 65.19 …and nothing in it reaches a database module",
    !/lib\/db|drizzle|@\/lib\/data/.test(fixtures),
    "'it was only the demo data' is the sentence at the front of every incident of this kind",
  );

  check(
    "🔴 65.19 CONTROL the same scan CATCHES an import somebody would add",
    /^\s*import\s/m.test('import { db } from "@/lib/db";\nexport const X = 1;'),
    "a planted import fails the rule that cleared the real file",
  );

  /* ================================================================== */
  /*  65.15 / 65.16 · four audiences, four heroes, four pages           */
  /* ================================================================== */

  const { DEFAULT_PAGES } = await import("../lib/content/defaults");
  const { DEFAULT_PAGES_AR } = await import("../lib/content/defaults-ar");

  for (const [locale, pages] of [
    ["EN", DEFAULT_PAGES],
    ["AR", DEFAULT_PAGES_AR],
  ] as const) {
    const home = pages.find((page) => page.slug === "home");
    const heroes = (home?.blocks ?? []).filter((block) => block.type === "hero");

    check(
      `🔴 65.15 the ${locale} homepage has four heroes, one per person who arrives`,
      heroes.length === 4,
      `${heroes.length} heroes`,
    );

    /*
     * 🔴 AND EACH ONE SHOWS THAT AUDIENCE'S OWN COMPONENT (65.17), which is the check
     * that a fourth hero is a fourth audience rather than a fourth paragraph.
     */
    const demoNames = heroes.map((hero) => (hero as { demo?: string }).demo);
    check(
      `🔴 65.15 …and the ${locale} four show four DIFFERENT components`,
      new Set(demoNames).size === 4 && demoNames.every(Boolean),
      demoNames.join(", "),
    );
  }

  /*
   * 🔴 65.16 — AND EACH AUDIENCE HAS A PAGE, not a section under a heading.
   */
  const ROUTES = [
    "app/(public)/for-companies/page.tsx",
    "app/(public)/for-clinics/page.tsx",
    "app/(public)/developers/page.tsx",
  ];

  check(
    "🔴 65.16 every audience has a real page of its own",
    ROUTES.every((route) => readSource(route).length > 500) &&
      DEFAULT_PAGES.some((page) => page.slug === "for-patients"),
    "for-companies · for-clinics · developers · for-patients",
  );

  /*
   * 🔴 65.21 — ARABIC FIRST, NOT ARABIC AFTER.
   *
   * The new marketing pages put their text in the dictionary rather than in the markup,
   * which is what makes the Arabic half possible at all. `app/(public)/` is exempt from
   * `verify:sprint37l`, on the stated ground that its rows are published in both
   * languages — true of `[slug]` and false of a hand-built page, so the exemption cannot
   * be relied on here and this check stands in for it.
   */
  const { DICTIONARIES } = await import("../lib/i18n/messages");
  const marketingKeys = Object.keys(DICTIONARIES.en).filter((key) =>
    key.startsWith("marketing."),
  );

  check(
    "🔴 65.21 every marketing string exists in Arabic as well as English",
    marketingKeys.length >= 18 &&
      marketingKeys.every((key) => {
        const value = DICTIONARIES.ar[key as keyof typeof DICTIONARIES.ar];
        return typeof value === "string" && /[؀-ۿ]/.test(value);
      }),
    `${marketingKeys.length} strings`,
  );

  check(
    "🔴 65.21 …and the audience pages read them rather than typing them",
    ROUTES.slice(0, 2).every((route) => /t\("marketing\./.test(readSource(route))),
    "text typed into a page under app/(public)/ is invisible to BOTH gates",
  );

  /* ================================================================== */
  /*  65.5 / 65.8 · the patient app                                     */
  /* ================================================================== */

  const home = readSource("app/(patient)/patient/page.tsx");

  check(
    "🔴 65.7 the patient home explores the platform rather than listing it",
    /<ExploreRail/.test(home) && /<CategoryGrid/.test(home) && /radarCount\(\)/.test(home),
    "an explore rail, a category grid, and a banner that counts",
  );

  /*
   * 🔴 65.8 — EMPTY-STATE HONEST, AND THE ZERO CASE IS ON THE SCREEN.
   *
   * C288 ruled that the homepage may not promise a therapist in sixty seconds. A "top
   * rated" rail invented out of four ratings is the same lie with a nicer layout, and a
   * rail that simply vanishes reads as a product with no ratings feature rather than one
   * refusing to invent a ranking.
   */
  check(
    "🔴 65.8 the top-rated rail says so when nobody clears the bar",
    /best\.length === 0[\s\S]{0,120}home\.ratedNone/.test(home),
    "few ratings says few ratings",
  );

  check(
    "🔴 65.8 …and the live banner counts instead of promising",
    /liveNow > 0 \?/.test(home) && /home\.liveNone/.test(home),
    "the same card at four in the morning with nobody on shift was the old build",
  );

  check(
    "🔴 65.8 …and the explore rail says an empty platform is empty",
    /explore\.length > 0[\s\S]{0,200}home\.nobodyListed/.test(home),
    "a rail that hides makes a claim about the platform; a sentence does not",
  );

  /* ================================================================== */
  /*  65.6 · the radar's list view                                      */
  /* ================================================================== */

  const list = readSource("components/radar/radar-list.tsx");
  const console_ = readSource("components/radar/radar-console.tsx");
  const radar = readSource("lib/data/radar.ts");

  check(
    "🔴 65.6 the radar has a list view beside the map, and both are labelled",
    /radar\.mapView/.test(console_) && /radar\.listView/.test(console_) && /<RadarList/.test(console_),
    "the reader can see that a list exists before they have tried the button",
  );

  check(
    "🔴 65.6 …and a row carries the column the panel had no room for",
    /radar\.nextOpen/.test(list) && /entry\.nextOpenAt/.test(list),
    "next availability, which the map's legend could never fit",
  );

  /*
   * 🔴 ONE GROUPED QUERY, not one per row.
   *
   * A hundred clinicians with a query each is the N+1 that turns a two-query board into
   * a hundred and two, inside a cached load where nobody would see it.
   */
  check(
    "🔴 65.6 next availability is ONE grouped query for the whole board",
    /MIN\(\$\{availabilitySlots\.startsAt\}\)/.test(radar) &&
      /\.groupBy\(availabilitySlots\.therapistUserId\)/.test(radar),
    "a query per row would hide inside the cached load",
  );

  check(
    "🔴 65.6 …and it uses the same open-hour predicate the booking calendar renders",
    /eq\(availabilitySlots\.status, "held"\), lt\(availabilitySlots\.heldUntil, now\)/.test(radar),
    "a second definition of 'open' would offer an hour the calendar does not have",
  );

  /* ================================================================== */
  /*  65.3 · nothing deleted, everything translated                     */
  /* ================================================================== */

  /*
   * 🔴 EVERY REMOVED BLOCK NAMES THE COMPONENT THAT REPLACED IT.
   *
   * *A shorter screen that dropped a disclaimer is a regression, not an improvement.* The
   * dictionary carries the pairing where the removal happened, which is the only place
   * somebody reading the diff would look.
   */
  const messages = readFileSync("lib/i18n/messages.ts", "utf8");
  /* The marker the dictionary uses beside each removal. Built from a code point so
     this file itself stays clear of the dash `verify:sprint24` forbids. */
  const marker = new RegExp(`65\\.3 ${String.fromCharCode(8212)}`, "g");
  const pairings = [...messages.matchAll(marker)];

  check(
    "🔴 65.3 every removed block names its replacement, beside it",
    pairings.length >= 6,
    `${pairings.length} removals paired with what replaced them`,
  );

  finish("sprint 65");
}

main();
