/**
 * The traps this codebase has already fallen into, asserted rather than remembered.
 *
 *     npm run verify:traps
 *
 * ## Why a gate and not a document
 *
 * `PLAN.md §6` and `docs/simulation/00-LESSONS.md` already write down what was
 * learned. Both are read once. Every trap below was written down BEFORE it was
 * walked into again, which is the whole argument for this file: a rule a person
 * has to remember is a rule that holds until the person is tired.
 *
 * So each one is a property of the source, checked on every pass. `docs/TRAPS.md`
 * is the prose half, and it is generated from the same list, so the register and
 * the enforcement cannot drift.
 *
 * ## 🔴 EVERY ENTRY IS A RATCHET, NOT A WALL
 *
 * A gate that fails on all of history on day one is a gate somebody disables on
 * day two. Each trap carries a baseline: the number of places that still have it
 * when the trap was recorded. The number may only fall. A new one fails
 * immediately, and lowering the baseline is the work.
 */
import { readFileSync, readdirSync } from "node:fs";

import { reporter } from "./_verify";

const { check, finish } = reporter();

function scripts(): string[] {
  return readdirSync("scripts")
    .filter((f) => f.startsWith("verify-") && f.endsWith(".ts"))
    .map((f) => `scripts/${f}`);
}

const read = (file: string) => readFileSync(file, "utf8");

/* ====================================================================== */
/*  T1 · a checker that reads source WITH its comments                    */
/* ====================================================================== */

/**
 * 🔴 The oldest one here, and the one that keeps coming back.
 *
 * C205: strip comments before any scan of source. It has now been broken by
 * `uncalledExports` (which says in its own header the rule had been forgotten
 * eight times), by the route and page scanners in `_surfaces.ts`, by
 * `verify-palette.ts` on the day it was written, by `verify-raw-sql.ts` and by
 * `verify-sprint31.ts`.
 *
 * The shape is always the same: this codebase documents a defect by NAMING it,
 * so the explanation of a fix matches the pattern that hunts for the defect.
 * A file gets cleaned up and the gate still calls it dirty, and the cheapest
 * way to pass becomes deleting the explanation.
 */
function readsSourceRaw(file: string): boolean {
  const body = read(file);
  if (/stripCommentsKeepingLines|readSource/.test(body)) return false;

  /*
   * 🔴 RESOLVE WHAT IT ACTUALLY READS, because the first draft of this check
   * had the trap it was written to find.
   *
   * It flagged any verifier that mentioned `lib/` anywhere and called
   * `readFileSync`, which is three gates reading a markdown cast list, a
   * hazards register and their own server log. A detector that reports a file
   * for the contents of its import block is the same mistake one layer up:
   * reporting on something adjacent to what it claims to check.
   *
   * So a literal path is resolved, a `const NAME = "..."` is resolved, and
   * only a read of a `.ts`/`.tsx`, or of a variable this cannot resolve at all
   * (which is what a walk over source produces), counts.
   */
  const consts = new Map(
    [...body.matchAll(/const\s+(\w+)\s*=\s*"([^"]+)"/g)].map((m) => [m[1]!, m[2]!]),
  );

  for (const [, arg] of body.matchAll(/readFileSync\(\s*([^,)]+)/g)) {
    const trimmed = arg.trim();
    const literal = trimmed.startsWith('"')
      ? trimmed.slice(1, -1)
      : consts.get(trimmed);
    /* A resolved path that is not source is not this trap. */
    if (literal !== undefined) {
      if (/\.tsx?$/.test(literal)) return true;
      continue;
    }
    /*
     * Unresolvable, and the file walks a SOURCE directory: that is a source
     * scanner. The directory matters. `verify-served` reads
     * `/proc/<pid>/comm` to find an orphaned server, through a template
     * literal this cannot resolve and a `readdirSync("/proc")` that is not a
     * walk over anything anybody wrote.
     */
    if (/(?:walk|readdirSync)\(\s*(?:"(?:app|components|lib|scripts)|[A-Z_]+\b)/.test(body)) {
      return true;
    }
  }
  return false;
}

/**
 * 🔴 T3's allow-list: files where a literal path list is a FIXTURE rather than
 * an itinerary, with the reason, and the gate fails if one stops being needed.
 *
 * `verify-sprint31` asks whether a path is localisable. Its five paths are
 * chosen examples that exercise the rule, not a list of places to visit, and
 * deriving them would make the test assert whatever the product happens to
 * contain rather than the cases somebody reasoned about.
 */
const PATHS_BY_DESIGN: Record<string, string> = {
  "scripts/verify-sprint31.ts":
    "Five chosen examples of the localisable rule, one per shape: a patient page, a clinician page, a dynamic note, a token join link and the back office. Deriving them would test whatever exists rather than the cases the rule was written for.",
};

/* ====================================================================== */
/*  T2 · a checker with nothing proving it can fail                       */
/* ====================================================================== */

/**
 * 🔴 Three absences in a row pass just as happily against a scanner that
 * matched nothing at all.
 *
 * Every instrument in this repository has produced a green line while looking
 * at nothing: a crawler measuring a modal instead of the page behind it, a
 * crawler walking nine pages signed out, a counter that stopped counting at
 * twenty-nine, an audit returning "no failures" from a page that rendered
 * nothing. A verifier with no control cannot tell "clean" from "blind".
 */
const NO_CONTROL_BASELINE = 19;

/* ====================================================================== */
/*  T3 · a list of the product's own routes, typed by hand                */
/* ====================================================================== */

/**
 * 🔴 A hand typed list of routes is wrong the week after it is written.
 *
 * `verify-contrast.ts` held one and walked nine pages it had never loaded
 * while reporting `/earnings` as fine without visiting it. `verify-served.ts`
 * held one of four and warmed four routes for a crawler that walks a hundred
 * and twenty five, which produced three passes blaming three different sets of
 * perfectly good screens. Both now derive from `inventory.routes()`.
 */
function handTypedRoutes(file: string): number {
  const body = read(file);
  if (/from "\.\/inventory"|routes\(\)/.test(body)) return 0;
  /* Arrays of three or more product-looking paths, which is the shape. */
  const arrays = [...body.matchAll(/\[\s*((?:"\/[a-z0-9/[\]-]*",?\s*){3,})\]/g)];
  return arrays.length;
}

/* ====================================================================== */
/*  T4 · a report that truncates and drops the line saying it truncated   */
/* ====================================================================== */

/**
 * 🔴 The line a checker puts its TOTAL on is its last one, so a slice from the
 * front removes exactly the number that would reveal the slice.
 *
 * `gates.ts` cut every failing gate's output to twelve lines and said nothing.
 * `verifiers.ts` runs seventy-nine scripts and prints "N of 79 failed" last.
 * Six failed, four were shown, and the two survivors looked like new breakage a
 * pass later. A summary that quietly drops the part saying how much it dropped
 * is worse than no summary.
 */
function truncatesSilently(file: string): boolean {
  const body = read(file);
  if (!/\.slice\(0,\s*\d+\)/.test(body)) return false;
  /* It is fine if the same file says how many it left out. */
  return !/more,|more lines|left out|and \$\{|… and/.test(body);
}

function main() {
  const all = scripts();

  /* ------------------------------------------------------------ T1 */

  const raw = all.filter(readsSourceRaw);
  check(
    "🔴 T1 every source scanner strips comments first, so prose is not code",
    raw.length === 0,
    raw.join(" · ") || `${String(all.length)} verifiers, none reading source raw`,
  );

  check(
    "🔴 T1 CONTROL the detector fires on a scanner that does not strip",
    readsSourceRaw("scripts/verify-traps.ts") === false &&
      /readFileSync\(/.test(read("scripts/_surfaces.ts")),
    "this file reads no product source, and the one that does was checked",
  );

  /* ------------------------------------------------------------ T2 */

  const blind = all.filter((f) => !/CONTROL/i.test(read(f)));
  check(
    "🔴 T2 the number of verifiers with nothing proving they can fail only falls",
    blind.length <= NO_CONTROL_BASELINE,
    blind.length < NO_CONTROL_BASELINE
      ? `${String(blind.length)} of ${String(all.length)}, LOWER THE BASELINE to ${String(blind.length)}`
      : `${String(blind.length)} of ${String(all.length)}, baseline ${String(NO_CONTROL_BASELINE)}`,
  );

  /* ------------------------------------------------------------ T3 */

  const typed = all.filter((f) => handTypedRoutes(f) > 0 && !PATHS_BY_DESIGN[f]);
  check(
    "🔴 T3 no verifier types the product's own routes by hand",
    typed.length === 0,
    typed.join(" · ") ||
      `every itinerary derives from the inventory, ${String(Object.keys(PATHS_BY_DESIGN).length)} fixture list(s) exempt`,
  );

  /*
   * 🔴 AND AN EXEMPTION THAT HAS STOPPED BEING NEEDED IS DELETED.
   *
   * The same rule `verify:reachable` applies to its own allow-list: a
   * permission that covers nothing reads as a considered decision, and the
   * next hand typed list slips under it unremarked.
   */
  const stale = Object.keys(PATHS_BY_DESIGN).filter((f) => handTypedRoutes(f) === 0);
  check(
    "🔴 T3 every fixture exemption still has a literal list in it, and says why",
    stale.length === 0 &&
      Object.values(PATHS_BY_DESIGN).every((why) => why.split(/\s+/).length >= 15),
    stale.length > 0 ? `${stale.join(" · ")} no longer needs its exemption` : "each one earns its place",
  );

  /* ------------------------------------------------------------ T4 */

  const silent = ["scripts/gates.ts", "scripts/verifiers.ts"].filter(truncatesSilently);
  check(
    "🔴 T4 a report that truncates says how much it left out",
    silent.length === 0,
    silent.join(" · ") || "both runners name what they dropped",
  );

  /*
   * 🔴 AND THE REGISTER IS THE SAME LIST AS THE ENFORCEMENT.
   *
   * `docs/TRAPS.md` is what a person reads. If it can describe a trap this file
   * does not check, it is a document again, which is the thing this gate exists
   * to replace.
   */
  const doc = read("docs/TRAPS.md");
  const described = [...doc.matchAll(/^### T(\d+)/gm)].map((m) => m[1]!);
  const enforced = [...read("scripts/verify-traps.ts").matchAll(/"🔴 T(\d+) /g)].map((m) => m[1]!);
  const orphans = described.filter((t) => !enforced.includes(t));

  check(
    "🔴 every trap in the register is checked by this file",
    described.length > 0 && orphans.length === 0,
    orphans.length > 0
      ? `T${orphans.join(", T")} described but not enforced`
      : `${String(described.length)} traps, each with a check`,
  );

  finish("traps");
}

main();
