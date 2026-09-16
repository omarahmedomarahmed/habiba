/**
 * 🔴 C353 — NOTHING HANDS A FUNCTION TO A CLIENT COMPONENT.
 *
 *   npm run verify:boundary
 *
 * ## The outage this exists because of
 *
 * `/pricing` answered **500 to every visitor, in production**, from the day the
 * seat ladder shipped in sprint 62 until sprint 69 went looking for something
 * else. The cause was six lines in `components/public/pricing-tiers.tsx`:
 *
 * ```
 *   strings={{
 *     seats: (count: number) => count === 1 ? t("…One") : t("…", { count }),
 *   }}
 * ```
 *
 * with a comment above it explaining that the plural belongs where the
 * dictionary is. The reasoning was correct. The mechanism cannot work: React
 * serialises props across the server/client boundary and throws
 * *"Functions cannot be passed directly to Client Components"* when it meets
 * one, so the page threw while rendering and Next returned 500.
 *
 * ## 🔴 Why nothing caught it, which is the part worth fixing
 *
 * Every existing instrument was blind to it by construction:
 *
 * | | |
 * |---|---|
 * | `tsc` | The prop is typed `(count: number) => string` and the call site matches. It is a type error nowhere; it is a runtime rule |
 * | `npm run build` | `/pricing` is `dynamicParams` and rendered on demand, so the build never rendered it |
 * | Every `verify:sprint*` | Reads source for the rules its own sprint wrote. None of them knows what a client boundary is |
 * | `verify:sprint21r` | **Saw it.** It reads the live site, found no tier cards on `/pricing`, and reported red. For seven sprints that red line was read as "the dev branch has no published pricing page" and skipped past |
 *
 * The last row is the real lesson and it is H20's, again: a gate that fails for
 * a reason somebody has explained to themselves is a gate nobody reads.
 *
 * ## What this checks
 *
 * For every module that begins `"use client"`, find each place a server module
 * renders it and look at the props. A prop whose value is an arrow function, a
 * `function` keyword, or a bare identifier known to be a function is refused.
 *
 * **Event handlers are the exception and are allowed nowhere else.** `onClick`,
 * `onChange` and their kind are only legal inside a client component, so a
 * SERVER file passing one is the same defect with a familiar name. This scan is
 * over server files only, so any function prop it finds is a defect regardless
 * of what it is called.
 *
 * ## What it deliberately does not do
 *
 * It does not parse TypeScript. A full AST pass over 400 components to catch a
 * rule with one shape is a week of work and a second thing to maintain; this is
 * a scan with an explicit control for every pattern it claims to catch, which is
 * this repository's standard for an absence assertion (§6).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

const ROOTS = ["app", "components"];

/** Every `.tsx` under the roots. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * Is this module a client component?
 *
 * Read RAW rather than through `readSource`, because `readSource` strips
 * comments (C205) and a file whose first line is a comment would otherwise have
 * its directive moved. The directive has to be at the top of the module, so
 * looking at the first 400 characters of the real bytes is both correct and the
 * only reading that matches what the bundler does.
 */
function isClient(file: string): boolean {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*)?["']use client["']/.test(
    readFileSync(file, "utf8").slice(0, 2000),
  );
}

/**
 * The default export's name, and every named export, so a JSX tag can be traced
 * back to the file it came from. Import aliases are resolved at the call site.
 */
function exportedNames(file: string): string[] {
  const src = readSource(file);
  const names = new Set<string>();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]\w*)/g)) names.add(m[1]!);
  for (const m of src.matchAll(/export\s+const\s+([A-Z]\w*)/g)) names.add(m[1]!);
  return [...names];
}

/**
 * 🔴 A prop whose value is a function, written out.
 *
 * Three shapes and no more, because these are the three that exist in this
 * codebase and a pattern that tries to be clever about a fourth starts matching
 * type annotations, which is the phantom family `literalsIn` has been corrected
 * for three times.
 *
 *   name={() => …}          an inline arrow
 *   name={(a, b) => …}      an inline arrow with arguments
 *   name={function …}       the keyword
 *   name={(a: T) => …}      typed arguments, which is how the seat ladder's was
 */
const FUNCTION_PROP =
  /(\w+)=\{\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::\s*[\w<>[\]|., ]+\s*)?=>|\w+\s*=>)/g;

/**
 * The same three shapes inside an OBJECT passed as a prop, which is what the
 * outage actually looked like: the function was not a prop, it was a key of the
 * `strings` object that was the prop.
 *
 * This is the shape a scan written from the error message alone would miss, and
 * the CONTROL below feeds it the exact six lines that took `/pricing` down.
 */
const FUNCTION_IN_OBJECT_PROP =
  /^\s*(\w+):\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::\s*[\w<>[\]|., ]+\s*)?=>|\w+\s*=>)/gm;

/**
 * The props of every `<Tag …>` in `src`: the slice between the tag name and the
 * `>` that closes its opening element.
 *
 * A hand walk rather than a regex, because a regex for balanced braces is the
 * kind of thing that silently matches half a file and then reports nothing,
 * which is the failure mode this whole file exists to answer.
 */
function propWindows(src: string, tag: string): string[] {
  const out: string[] = [];
  for (const match of src.matchAll(new RegExp(`<${tag}(?![\\w])`, "g"))) {
    const start = match.index! + match[0].length;
    let depth = 0;
    let end = start;
    while (end < src.length) {
      const c = src[end]!;
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
      end++;
    }
    out.push(src.slice(start, end));
  }
  return out;
}

/** Every function-valued prop in one opening element, direct or inside an object. */
function offencesIn(props: string): string[] {
  return [
    ...[...props.matchAll(FUNCTION_PROP)].map((m) => m[1]!),
    ...[...props.matchAll(FUNCTION_IN_OBJECT_PROP)].map((m) => m[1]!),
  ];
}

function main() {
  const files = ROOTS.flatMap((root) => tsxFiles(root));
  const client = files.filter(isClient);
  const server = files.filter((file) => !isClient(file));

  check(
    "the scan found both halves of the product to compare",
    client.length > 20 && server.length > 20,
    `${client.length} client components, ${server.length} server files`,
  );

  /* Every tag name that resolves to a client component. */
  const clientTags = new Map<string, string>();
  for (const file of client) for (const name of exportedNames(file)) clientTags.set(name, file);

  check(
    "…and it knows the name of every client component it is looking for",
    clientTags.size > 20,
    `${clientTags.size} exported client component names`,
  );

  /*
   * 🔴 The scan itself. For each server file, find the JSX for a client tag and
   * read the props between the tag name and the end of the opening element.
   */
  type Offence = { file: string; tag: string; prop: string };
  const offences: Offence[] = [];

  for (const file of server) {
    const src = readSource(file);
    for (const [tag] of clientTags) {
      for (const props of propWindows(src, tag)) {
        for (const prop of offencesIn(props)) offences.push({ file, tag, prop });
      }
    }
  }

  check(
    "🔴 C353 no server component hands a function to a client component",
    offences.length === 0,
    offences.length === 0
      ? `${server.length} server files, ${clientTags.size} client components, nothing crosses`
      : offences.map((o) => `${o.file} <${o.tag}> ${o.prop}`).join(" · "),
  );

  /* ================================================================== */
  /*  CONTROLS · an absence assertion is worth nothing until it is       */
  /*  watched finding the thing it exists to find                        */
  /* ================================================================== */

  /*
   * 🔴 THE CONTROL THAT MATTERS: the scan, whole, over the code that was live.
   *
   * The regex controls below prove the patterns match. This one proves the
   * PIPELINE does: the same `propWindows` walk and the same `offencesIn` pass,
   * over `components/public/pricing-tiers.tsx` exactly as it stood before C353,
   * including the comment that argued for the mistake.
   *
   * A check that only ever exercises its regexes in isolation is a check that
   * can pass while the walk that feeds them returns an empty window, which is
   * the specific way an absence assertion becomes decorative.
   */
  const asItWas = [
    "            <SeatLadder",
    "              rows={seatRows}",
    "              monthlyByCount={monthlyByCount}",
    "              rateMicro={egpRate}",
    "              locale={tag}",
    "              strings={{",
    '                headSeats: t("pricing.seatsHeadSeats"),',
    '                headRate: t("pricing.seatsHeadRate"),',
    '                headMonthly: t("pricing.seatsHeadMonthly"),',
    '                sliderLabel: t("pricing.seatsSlider"),',
    "                seats: (count: number) =>",
    "                  count === 1",
    '                    ? t("pricing.seatsCountOne")',
    '                    : t("pricing.seatsCount", { count }),',
    "              }}",
    "            />",
  ].join("\n");

  const caught = propWindows(asItWas, "SeatLadder").flatMap(offencesIn);

  check(
    "🔴 CONTROL the whole scan, run over /pricing as it stood, finds the one prop that took it down",
    caught.length === 1 && caught[0] === "seats",
    caught.length === 1
      ? "seats, and nothing else in the same element"
      : `${caught.length} found: ${caught.join(", ") || "none"}`,
  );

  check(
    "🔴 CONTROL the scan catches a bare inline handler",
    [...'<Thing onSelect={() => {}} />'.matchAll(FUNCTION_PROP)].length === 1,
    "the commonest shape, and the one C199 was about",
  );

  check(
    "🔴 CONTROL …and one with typed arguments, which is what took /pricing down",
    [...'<SeatLadder render={(count: number) => count} />'.matchAll(FUNCTION_PROP)].length === 1,
    "a type annotation between the parentheses must not hide the arrow",
  );

  check(
    "🔴 CONTROL …and one nested inside an object prop, which is EXACTLY the outage",
    [
      ...`
                sliderLabel: t("pricing.seatsSlider"),
                seats: (count: number) =>
                  count === 1 ? t("pricing.seatsCountOne") : t("pricing.seatsCount", { count }),
      `.matchAll(FUNCTION_IN_OBJECT_PROP),
    ].length === 1,
    "the function was a key of the prop, not the prop, and a scan written from the error message misses it",
  );

  check(
    "🔴 CONTROL …and the `function` keyword",
    [...'<Thing make={function () { return 1; }} />'.matchAll(FUNCTION_PROP)].length === 1,
    "three shapes, all three watched catching",
  );

  /*
   * 🔴 The other direction, and it is the half that makes the check usable.
   *
   * A pattern that flags everything would pass every assertion above and make
   * the gate useless within a week. These four are the shapes that look like
   * function props and are not: a string, a number, a resolved call, and a type
   * annotation on the component's own props.
   */
  check(
    "🔴 CONTROL the scan CLEARS the shapes that merely look like one",
    [
      ...'<Thing label={t("a.b")} count={3} rows={rows.map((r) => r.id)} when={fn()} />'.matchAll(
        FUNCTION_PROP,
      ),
    ].length === 0 &&
      [
        ...`
                headSeats: t("pricing.seatsHeadSeats"),
                monthly: money(band.perSeatCents),
                rows: bands.map((b) => b.from),
        `.matchAll(FUNCTION_IN_OBJECT_PROP),
      ].length === 0,
    "a resolved call, an array built by map, and a translated string are all legal and all stay legal",
  );

  /*
   * 🔴 THE FALSE POSITIVE THIS SCAN WOULD OTHERWISE HAVE, NAMED RATHER THAN DENIED.
   *
   * `seats: (count: number) => string;` inside a `type` block is a TYPE
   * ANNOTATION and is identical, character for character, to the offence when
   * read by a regex. Both patterns match it and no amount of tightening can
   * separate them, because they are the same text.
   *
   * What separates them is WHERE they are read. The scan only ever looks at the
   * slice between `<Tag` and the `>` that closes its opening element, and a type
   * declaration cannot appear there. So the check below asserts the property the
   * scan actually depends on — that the window is the opening element and
   * nothing else — rather than pretending the pattern is cleverer than it is.
   */
  const windowProof = [
    "type Props = {",
    "  seats: (count: number) => string;",
    "};",
    "export function Server() {",
    '  return <Thing label="x" />;',
    "}",
  ].join("\n");
  const opening = windowProof.slice(
    windowProof.indexOf("<Thing") + "<Thing".length,
    windowProof.indexOf("/>"),
  );

  check(
    "🔴 CONTROL a type annotation is identical text, and is never in the window the scan reads",
    [...windowProof.matchAll(FUNCTION_IN_OBJECT_PROP)].length === 1 &&
      [...opening.matchAll(FUNCTION_IN_OBJECT_PROP)].length === 0,
    "the pattern cannot tell them apart and does not have to: it only reads between the tag and its close",
  );

  check(
    "🔴 CONTROL …and it looks at SERVER files only, so a client component's own handlers are untouched",
    isClient("components/public/seat-ladder.tsx") &&
      !isClient("components/public/pricing-tiers.tsx"),
    "onChange inside a client component is the point of client components",
  );

  /* ================================================================== */
  /*  A verifier that RENDERS runs on the real React, and stubs early     */
  /* ================================================================== */

  /*
   * 🔴 76.8 — THE BUG CLASS `verify:sprint17` COST AN AFTERNOON TO, TWICE.
   *
   * A script that renders real components has to replace two modules that
   * cannot load outside a renderer, and the replacement has to be installed
   * BEFORE the script's own static imports resolve. A helper called from
   * `main()` is already too late: `lib/db/index.ts` begins with `import
   * "server-only"` and throws while the import graph is still loading.
   *
   * The workaround for that was `--conditions=react-server`, which silences
   * `server-only` and silently swaps React for its server build. That build
   * has no `createContext`, so the day a rendered component reached for the
   * i18n provider the verifier died on an import — and the tempting fix was a
   * stub for that one provider, which answers one component and waits for the
   * next.
   *
   * Two properties close it for good, and this checks both:
   *
   *   - a rendering script PRELOADS the substitutions with `--import`
   *   - and none of them carries `--conditions=react-server`, because a
   *     renderer needs the React that can render
   */
  const pkg = JSON.parse(readSource("package.json")) as {
    scripts: Record<string, string>;
  };

  /* A script is a renderer when it pulls in the shared harness or react-dom. */
  const renderers = Object.entries(pkg.scripts).filter(([, cmd]) => {
    const file = cmd.split(/\s+/).find((a) => a.startsWith("scripts/"));
    if (!file) return false;
    let src = "";
    try {
      src = readSource(file);
    } catch {
      return false;
    }
    return /from "\.\/_render"|react-dom\/server/.test(src);
  });

  const unpreloaded = renderers
    .filter(([, cmd]) => !cmd.includes("_render-preload.mjs"))
    /*
     * `verify:sprint45` spawns a CHILD to do its rendering and only scans
     * source in its own process, so the parent needs nothing. It is named
     * rather than pattern-matched, so the day it renders in-process this goes
     * red instead of quietly excusing it.
     */
    .filter(([name]) => name !== "verify:sprint45")
    .map(([name]) => name);

  check(
    "🔴 every script that renders components installs its module stubs BEFORE its imports",
    unpreloaded.length === 0,
    unpreloaded.join(", ") || `${renderers.length} renderers, all preloaded or delegating`,
  );

  const serverConditioned = renderers
    .filter(([name, cmd]) => cmd.includes("--conditions=react-server") && name !== "verify:sprint45")
    .map(([name]) => name);

  check(
    "🔴 …and none of them runs on the React build that cannot render",
    serverConditioned.length === 0,
    serverConditioned.join(", ") ||
      "react-server has no createContext, so any client component in the tree is an import error",
  );

  check(
    "🔴 CONTROL the preload replaces both modules a renderer trips over",
    /next\/link/.test(readSource("scripts/_render-preload.mjs")) &&
      /server-only/.test(readSource("scripts/_render-preload.mjs")),
    "a preload that stubbed only one would move the failure rather than remove it",
  );

  finish("boundary");
}

main();
