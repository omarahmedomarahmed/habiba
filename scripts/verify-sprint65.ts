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

import { GATES } from "./_gates";
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
  /*
   * 🔴 C205 — `readSource` STRIPS COMMENTS, `readFileSync` DOES NOT.
   *
   * This scan asked which files import the vocabulary and did it by reading raw source, so
   * a file that only MENTIONED `@/components/visual/primitives` in a comment counted as a
   * user of it. The rule exists because this repository's comments quote the code they are
   * about, constantly, and every scan that forgets it measures the prose.
   */
  const importers = walk("app")
    .concat(walk("components"))
    .filter((file) => readSource(file).includes("@/components/visual/primitives"));

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
    sinceOrigin?: Record<string, { words: number; why: string }>;
  };

  /**
   * 🔴 76.53 — A PORTAL MAY EXCEED ITS ORIGIN ONLY BY A NUMBER SOMEBODY WROTE
   * DOWN, IN THIS FILE, WITH A PARAGRAPH BESIDE IT.
   *
   * ## What broke, and why the rule needed a door rather than a bend
   *
   * Sprint 65's accept line was "half off every portal", and `origin` is what it
   * measures against. For seven portals that worked exactly as intended: the
   * walls of text came down and the numbers are 5% to 30% under where they
   * started.
   *
   * Admin never had walls. It is English by decision (37L.3), its prose is column
   * headings and one-line rulings, and `npm run prose --portal admin` reports
   * ZERO blocks of 25 words or more. It sat at 2554 against an origin of 2564:
   * ten words of headroom and nothing left to pay with. The same thing was
   * already true of the patient app in sprint 75, which this file records.
   *
   * So the rule had become "the admin console may never gain a screen", which is
   * not what 65.2 was for and is a rule that eventually gets switched off rather
   * than argued with. `/admin/actuals` is a table of what the company earned and
   * spent each month plus an editable payroll, asked for because the forecast had
   * no measured counterpart. Its rendered prose, after three rounds of cutting,
   * is column headings, four sentences and the form labels.
   *
   * ## Why an ALLOWANCE and not a higher origin
   *
   * Raising `origin` would rewrite history: every percentage on that file would
   * silently re-base and "5% off 2564" would become "0% off 2658". The
   * measurement sprint 65 took stays exactly where it was. What this adds is a
   * separate, named number, per portal, that has to carry its own argument, so
   * the next person can read what was bought and disagree with the price.
   */
  const allowance = (portal: string): number => ratchet.sinceOrigin?.[portal]?.words ?? 0;

  check(
    "🔴 65.2 every portal has an origin and a baseline, and none is above its origin",
    Object.keys(ratchet.baseline).every(
      (portal) =>
        typeof ratchet.origin[portal] === "number" &&
        ratchet.baseline[portal]! <= ratchet.origin[portal]! + allowance(portal),
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
   * 🔴 AND AN ALLOWANCE THAT IS NOT BEING USED IS DELETED, not left lying about.
   *
   * The same rule `verify:reachable` applies to a stale exemption: a permission
   * that has stopped being needed reads as a considered decision while covering
   * nothing, and the next rise slips under it unremarked.
   */
  const entries = Object.entries(ratchet.sinceOrigin ?? {});
  const slack = entries.filter(
    ([portal, entry]) => ratchet.baseline[portal]! <= ratchet.origin[portal]! + entry.words - 1,
  );

  check(
    "🔴 65.2 every allowance above origin is EXACTLY what is being used, and says why",
    entries.every(([, entry]) => entry.words > 0 && entry.why.split(/\s+/).length >= 20) &&
      slack.length === 0,
    entries.length === 0
      ? "none, every portal is under its own origin"
      : slack.length > 0
        ? `${slack.map(([p]) => p).join(", ")}: the allowance is larger than the rise. Lower it`
        : entries.map(([p, e]) => `${p} +${String(e.words)}`).join(" · "),
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

  /*
   * 🔴 76.31 — ASKED OF THE LIST, NOT OF THE FILE THAT USED TO HOLD IT.
   *
   * This read `scripts/gates.ts` as text and looked for four quoted strings.
   * The list moved into `_gates.ts` so that `verifiers.ts` could read it too,
   * and all four checks went red on a pass that had not changed at all: the
   * gates still ran, the grep just had the wrong file.
   *
   * That is §6 from the other side. A check that greps for the SHAPE of an
   * answer breaks when the shape moves and passes when the shape survives a
   * gutting. Reading the exported list asks the actual question: is `prose` in
   * the pass. It is the same ruling as C200 about copy.
   */
  const inGates = new Set<string>(GATES.map((gate) => gate.script));
  for (const gate of ["prose", "verify:claims", "verify:principals", "verify:sprint37l"]) {
    check(
      `🔴 65.24 \`npm run gates\` runs ${gate}`,
      inGates.has(gate),
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
   * *A shorter screen that dropped a disclaimer is a regression, not an improvement.*
   *
   * 🔴 AND THE RECORD IS DATA RATHER THAN A COMMENT, which C205 is the reason for. The
   * first build of this check counted a marker in `lib/i18n/messages.ts`'s comments, so
   * it read TypeScript source without stripping it and the rule caught it. The deeper
   * problem is the one the rule exists to point at: a record only a comment holds is a
   * record no check can verify. `evals/prose.json` carries it now, so both halves are
   * assertable.
   */
  const removed = (ratchet as { translated?: { removed?: Record<string, string> } }).translated
    ?.removed;

  const { DICTIONARIES: DICT } = await import("../lib/i18n/messages");
  const en = DICT.en as Record<string, string>;
  const ar = DICT.ar as Record<string, string>;

  const stillThere = Object.keys(removed ?? {}).filter((key) => key in en || key in ar);

  check(
    "🔴 65.3 every block recorded as removed is genuinely gone from BOTH dictionaries",
    Boolean(removed) && Object.keys(removed!).length >= 20 && stillThere.length === 0,
    stillThere.join(", ") || `${Object.keys(removed ?? {}).length} removals recorded`,
  );

  /*
   * 🔴 C364 — AND THE TOOL THAT WRITES THIS FILE CANNOT DELETE THE RECORD ABOVE.
   *
   * Sprint 71 lowered the admin baseline, ran the documented `npm run prose --
   * --write`, and watched it rebuild `evals/prose.json` from four named fields:
   * `comment`, `origin`, `baseline`, `measuredOn`. Everything else went, which
   * in this file is `translated.removed` — the 25 removals the check directly
   * above reads — plus the written arguments for two raised floors.
   *
   * So the supported way to record an improvement destroyed the evidence behind
   * three gates, and it had gone unnoticed because nobody had run `--write`
   * since sprint 65 put data in the file. That is C205's rule aimed at a writer:
   * a record a tool can quietly drop is a record no check can rely on.
   *
   * Asserted on the SOURCE rather than by running the writer, because running it
   * would rewrite the file this verifier is reading.
   */
  const sweepSource = readSource("scripts/prose-sweep.ts");
  const writeBlock = sweepSource.slice(
    sweepSource.indexOf("if (write)"),
    sweepSource.indexOf("if (rose)"),
  );

  check(
    "🔴 C364 --write carries the whole file forward instead of rebuilding it from four fields",
    /\.\.\.\(ratchet as Record<string, unknown>\)/.test(writeBlock),
    "the writer spreads what it parsed, so an unknown key survives a baseline update",
  );

  /*
   * 🔴 CONTROL, in the direction that matters: a writer built from a fixed list
   * of keys must fail this. Without it the check passes on any file containing
   * the word "ratchet" and asserts nothing about the writer at all.
   */
  const pretendWriter = `if (write) { writeFileSync(RATCHET, JSON.stringify({ comment, origin: ratchet.origin, baseline: byPortal })) }`;
  check(
    "🔴 CONTROL …and a writer that names its fields instead is caught",
    !/\.\.\.\(ratchet as Record<string, unknown>\)/.test(pretendWriter),
    "watched failing on the shape it was written to reject",
  );

  /*
   * 🔴 AND WHAT REPLACED IT EXISTS, which is the half that makes the record a pairing
   * rather than a list of deletions.
   */
  const missingReplacement = Object.entries(removed ?? {}).filter(([, into]) => {
    const path = into.split(" ")[0]!;
    if (!path.includes("/")) return false; /* a key rather than a file, checked below */
    try {
      readSource(path);
      return false;
    } catch {
      return true;
    }
  });

  check(
    "🔴 65.3 …and the component named beside each one exists",
    missingReplacement.length === 0,
    missingReplacement.map(([key]) => key).join(", ") || "every replacement resolves",
  );

  const keyReplacements = Object.values(removed ?? {})
    .filter((into) => !into.includes("/"))
    .map((into) => into.split(",")[0]!.trim());

  check(
    "🔴 65.3 …and a block replaced by ANOTHER KEY points at one that exists",
    keyReplacements.length > 0 && keyReplacements.every((key) => key in en),
    keyReplacements.join(", "),
  );

  finish("sprint 65");
}

main();
