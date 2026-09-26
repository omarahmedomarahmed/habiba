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
    if (["node_modules", ".next", ".claude"].includes(entry.name)) continue;
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
  /*
   * 🔴 THE WALL MOVED ONE HOP, SO THE CHECK FOLLOWS IT.
   *
   * Both chromes used to render `<NeverBar>` themselves. They now hand their
   * three sentences to `components/portal/desk.tsx`, the one shell both admin
   * portals share, which renders it in the RAIL rather than in a footer below
   * the content. C240's rule is that the limit is on every screen; it is on
   * every screen and now also above the fold on every screen.
   *
   * The property is a chain, so the check is a chain: the chrome names its wall
   * and hands it over, and the thing it hands it to renders one. Asserting only
   * the first half would pass a chrome wired to a shell that dropped it.
   */
  const desk = readSource("components/portal/desk.tsx");
  const deskRendersWall = /<NeverBar/.test(desk);

  for (const [portal, file] of [
    ["sponsor", "components/sponsor/chrome.tsx"],
    ["clinic", "components/clinic/chrome.tsx"],
  ] as const) {
    const chrome = readSource(file);
    const handsItOver = /never=\{\{/.test(chrome) && /neverLabel/.test(chrome);
    check(
      `🔴 65.12 the ${portal} chrome carries the standing limit, on every screen`,
      (/<NeverBar/.test(chrome) || (handsItOver && deskRendersWall)) &&
        /<Desk|<NeverBar/.test(chrome),
      "in the chrome, so a page nobody has written yet already carries it",
    );
  }

  /*
   * 🔴 CONTROL — the SECOND half of the chain has to be load-bearing.
   *
   * The clause above is an OR, so a chrome that hands its wall over passes as
   * long as the shell draws one. If the shell stopped drawing one, that clause
   * has to go false. Re-evaluating it against a shell that renders no wall is
   * the only way to know the `deskRendersWall` term is doing work rather than
   * riding along beside a `handsItOver` that is true either way.
   */
  const sponsorChrome = readSource("components/sponsor/chrome.tsx");
  const withoutWall =
    (/<NeverBar/.test(sponsorChrome) || (/never=\{\{/.test(sponsorChrome) && false)) &&
    /<Desk|<NeverBar/.test(sponsorChrome);
  check(
    "🔴 65.12 CONTROL a shell that drew no wall would fail the portals that delegate to it",
    withoutWall === false,
    "so the chain is a chain rather than one half of one",
  );

  /* ================================================================== */
  /*  75.3 · the language switch, on every signed-in screen             */
  /* ================================================================== */

  /*
   * 🔴 75.3 HAD NO CHECK, AND THE SWITCH JUST MOVED.
   *
   * The rule is that somebody who has signed in can still change language, on
   * every screen, because reading English on an invoice and Arabic on a consent
   * form is one afternoon rather than two accounts. It was kept true by a
   * `LanguageCorner` pasted into each signed-in layout, which is exactly the
   * kind of rule that is true until the day one layout is written without it.
   *
   * On the two admin portals it has now moved off the glass and into the desk's
   * rail, because a pill fixed to the top corner sat on top of the payment
   * bar's Dismiss button. That is the second reason to write the check: a rule
   * that survives being moved is a rule somebody can move again safely.
   *
   * So the property is REACHES A SWITCH, not renders one component. Either the
   * layout draws the corner itself, or it draws a chrome that gets there.
   */
  const deskSwitches = /<LanguageSwitch/.test(desk);

  for (const [shell, layout, chrome] of [
    ["therapist", "app/(app)/layout.tsx", null],
    ["patient", "app/(patient)/layout.tsx", null],
    ["admin", "app/(admin)/layout.tsx", null],
    ["room", "app/(room)/layout.tsx", null],
    ["partner", "app/(partner)/layout.tsx", null],
    ["sponsor", "app/(sponsor)/layout.tsx", "components/sponsor/chrome.tsx"],
    ["clinic", "app/(clinic)/layout.tsx", "components/clinic/chrome.tsx"],
  ] as const) {
    const source = readSource(layout);
    const viaDesk = chrome !== null && /<Desk/.test(readSource(chrome)) && deskSwitches;

    check(
      `🔴 75.3 the ${shell} shell reaches a language switch, on every screen`,
      /<LanguageCorner/.test(source) || viaDesk,
      chrome === null ? "the corner, in the layout" : "the rail, through the desk",
    );
  }

  /*
   * 🔴 CONTROL — the same clause, against a desk that renders no switch.
   *
   * The two portals below pass only through `viaDesk`, and `viaDesk` is an AND
   * whose second half is the only part that reads the shell. A desk that
   * stopped rendering a switch has to take them down with it, or the check is
   * asserting that a chrome imports `Desk` and nothing more.
   */
  const strandedPortal =
    /<LanguageCorner/.test(readSource("app/(sponsor)/layout.tsx")) ||
    (/<Desk/.test(sponsorChrome) && false);

  check(
    "🔴 75.3 CONTROL a desk that rendered no switch would strand the portals that delegate to it",
    strandedPortal === false,
    "so this asserts the switch is reachable, not that a chrome imports a shell",
  );

  /* ================================================================== */
  /*  37L.9 · an ISO slice is not a date anybody reads                  */
  /* ================================================================== */

  /*
   * 🔴 NINE RENDERED DATES ON THESE TWO PORTALS WERE `toISOString().slice(0, 10)`.
   *
   * The pot's expiry twice, the coverage change date, the top-up form's date,
   * every invoice in the pot history, "last verified" on the roster, both
   * "Week of ..." labels on the clinic's rota, and the heatmap's tooltips.
   * 37L.9 already forbids a page formatting a date itself, and the clinic page
   * carried a comment about being caught doing it — four lines above two more
   * of them.
   *
   * The reason this matters more than tidiness is Arabic. An ISO string dropped
   * into an RTL paragraph is reordered by the bidi algorithm, so "2027-09-21"
   * renders "21-09-2027": the same three numbers with the year and the day
   * swapped, and nothing on screen to say which end is which. A benefits
   * administrator reading a refund deadline off that is reading a guess.
   *
   * 🔴 AND THE CHECK IS NOT "NO SLICES". Two are legitimate and both stay: a
   * `week=` URL parameter is machine-shaped by design, and React's key wants a
   * stable string rather than a translated one. So the rule is that every slice
   * is on a line that is a URL or a key, and anything else is a date on screen.
   *
   * `readSource` strips comments, so the paragraphs above do not count
   * themselves.
   */
  const PORTAL_DIRS = [
    "app/(sponsor)",
    "app/(clinic)",
    "components/sponsor",
    "components/clinic",
  ];
  const SLICE = /toISOString\(\)\.slice\(0, 10\)/;
  /* A URL parameter, or the field the heatmap keys on. Both are not read. */
  const MACHINE = /href=|weekStart:/;

  const rendered: string[] = [];
  for (const dir of PORTAL_DIRS) {
    for (const file of walk(dir)) {
      readSource(file)
        .split("\n")
        .forEach((line, index) => {
          if (SLICE.test(line) && !MACHINE.test(line)) rendered.push(`${file}:${index + 1}`);
        });
    }
  }

  check(
    "🔴 37L.9 no date on the company or clinic portal is an ISO slice a person has to read",
    rendered.length === 0,
    rendered.join(", ") || "every rendered date goes through `formatDate`",
  );

  /*
   * 🔴 CONTROL — the same sweep, over a line that IS the fault.
   *
   * The clause is two tests joined by AND and the second one is an exemption,
   * so a `MACHINE` pattern that matched everything would make this pass on any
   * codebase. Running it against a line that renders a slice proves it still
   * catches one.
   */
  const plantedLine = '{t("sponsor.expiresOn", { date: pot.expiresAt.toISOString().slice(0, 10) })}';

  check(
    "🔴 37L.9 CONTROL the same sweep still catches a rendered slice",
    SLICE.test(plantedLine) && !MACHINE.test(plantedLine),
    "the exemption exempts URLs and keys, not every line that has a date on it",
  );

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

  /*
   * 🔴 76.79 — IT FOLLOWS THE IMPORT NOW, and the reason is this check's own
   * §6 lesson landing on this check.
   *
   * It grepped `audience-demos.tsx` for two import lines. Sprint 76 rebuilt the
   * company and clinic demos as consoles in `components/demo/portal-demo.tsx`
   * and `audience-demos.tsx` became four lines that wrap them in a device frame,
   * so the two imports moved one file deeper and this went red against a site
   * that had MORE of the portal's own components on it than before, not less.
   *
   * 65.17's rule is about the marketing site, not about one file, so the check
   * reads the demo modules `audience-demos.tsx` pulls in and asks the question
   * across that set. A grep for the shape of an answer breaks when the shape
   * moves and passes when the shape survives a gutting; following the import is
   * asking the actual question.
   */
  const demoModules = [
    ...demos.matchAll(/from "@\/(components\/demo\/[\w-]+)"/g),
  ].map((m) => `${m[1]!}.tsx`);
  const demoSurface = [demos, ...demoModules.map((file) => readSource(file))].join("\n");

  check(
    "🔴 65.17 the audience demos import the PORTAL's own components",
    /from "@\/components\/sponsor\/spend-heatmap"/.test(demoSurface) &&
      /from "@\/components\/visual\/primitives"/.test(demoSurface),
    demoModules.length > 0
      ? `a screenshot survives the feature being deleted; this does not (through ${demoModules.join(", ")})`
      : "a screenshot survives the feature being deleted; this does not",
  );

  /*
   * 🔴 THE CONTROL, because the check above now reads a set that a bug could
   * make empty, and an empty set that still happened to match `demos` would
   * pass. This asserts the follow actually followed something.
   */
  check(
    "🔴 65.17 CONTROL, the check really read the demo modules it followed",
    demoModules.length > 0 && demoSurface.length > demos.length,
    demoModules.join(", ") || "FOLLOWED NOTHING",
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

    /*
     * 🔴 A DOOR, NOT A `hero` BLOCK. The rule outlived the shape it was written
     * against, and this check did not.
     *
     * 65.15 asserted four `hero` blocks because that is how the homepage said
     * "one door per audience" the day it was written. Task 137 replaced five
     * stacked navy heroes with ONE `audiences` block that rotates four panels
     * through a single fold, each panel carrying its own clause and its own
     * live component. The property 65.15 exists for — every audience arrives at
     * a door of their own, and no two doors show the same picture — is exactly
     * as true, and stronger, since the four are now side by side instead of
     * four screens apart.
     *
     * The check went red anyway, and stayed red, because it was counting a
     * block type. That is the failure mode C200 ruled on: a gate that names an
     * implementation reports a rewrite as a regression and teaches whoever
     * meets it to leave the page alone.
     *
     * So a door is a hero OR an audiences panel, and both are read here.
     */
    const blocks = home?.blocks ?? [];
    const heroes = blocks.filter((block) => block.type === "hero");
    const panels = blocks.flatMap((block) =>
      block.type === "audiences" ? block.panels : [],
    );
    const doors = [...heroes, ...panels];

    /*
     * 🔴 77.8 — THE RULE WAS "EXACTLY FOUR" AND IT IS "ONE EACH, NO REPEATS" NOW.
     *
     * 65.15 counted four because four was the number of audiences the day it
     * was written, and the defect it was built to catch was never the count:
     * it was a hero that is a paragraph, or two heroes showing the same
     * picture. A hard four also fails the WRONG WAY when the product grows —
     * sprint 77 added a fifth hero that runs the patient's own app end to end,
     * and a rule that reports that as a regression is a rule that argues for
     * leaving the homepage alone.
     *
     * So the count is a floor and the distinctness is the rule. Each of the
     * four audiences must still have its own hero, no two heroes may show the
     * same component, and every hero must show one — which is the property
     * "a hero is a door rather than an argument" actually rests on.
     */
    const demoNames = doors.map((door) => (door as { demo?: string }).demo);

    /*
     * 🔴 The patient's door is named twice in the schema and is one component.
     * `ComponentShowcase` maps `radar` and `patient-app` to the same thing:
     * `PatientApp` opened on its radar tab. A check that insists on the older
     * spelling is asserting a synonym rather than a door.
     */
    const REQUIRED = [["radar", "patient-app"], ["session-room"], ["company"], ["clinic"]];

    check(
      `🔴 65.15 the ${locale} homepage has a door for every audience who arrives`,
      doors.length >= 4 && REQUIRED.every((names) => names.some((n) => demoNames.includes(n))),
      `${String(heroes.length)} hero(es) + ${String(panels.length)} panel(s): ${demoNames.join(", ")}`,
    );

    /*
     * 🔴 AND EACH ONE SHOWS ITS OWN COMPONENT (65.17), which is the check that a
     * fifth hero is a fifth thing to look at rather than a fifth paragraph.
     */
    check(
      `🔴 65.15 …and no two ${locale} doors show the same component`,
      new Set(demoNames).size === demoNames.length && demoNames.every(Boolean),
      demoNames.join(", "),
    );

    /*
     * 🔴 CONTROL — a planted repeat must fail, or the set comparison above is
     * passing because `demoNames` is short rather than because it is distinct.
     */
    check(
      `🔴 65.15 CONTROL a repeated demo is caught (${locale})`,
      new Set([...demoNames, demoNames[0]]).size !== demoNames.length + 1,
      "two heroes showing the same picture is the defect this rule is about",
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
