/**
 * 🔴 45.0 / C245 — no source file in this repository may contain a NUL byte.
 *
 *   npm run verify:nul
 *
 * ## Why this is its own gate rather than a line in a sprint verifier
 *
 * `lib/data/facts.ts` used a NUL as the separator in a composite Map key:
 * `` `${fact.domain}\0${fact.field}` ``. It was correct, it was cheap, and it
 * made the file **invisible**. A file containing a NUL is a binary file to
 * `grep`, which prints
 *
 *     grep: lib/data/facts.ts: binary file matches
 *
 * and no lines. Not an error. Not a warning anybody reads. It was the only
 * such file in the repository and it happened to be the clinical evidence
 * layer, so every grep-based audit ever run here silently skipped the module
 * that decides what the product believes about a person.
 *
 * That is how C214 came to be written backwards. The ruling said "verified
 * today: `lib/data/facts.ts` does not reference journals at all", which was
 * the honest report of a grep that had printed nothing. The file references
 * journals twenty-two times. A prohibition on journal-derived conclusions was
 * therefore written as a *prevention* when it was a *repair*, and the sprint
 * it belonged to was sequenced on that mistake.
 *
 * This is the eighth member of the §6 family — a check that passes by
 * measuring the wrong thing — and it is the one with the widest blast radius,
 * because it does not corrupt one check. It corrupts every future grep by
 * anybody, including the ones nobody has written yet.
 *
 * So the rule is not "remember that facts.ts is odd". It is: **a file with a
 * NUL byte does not exist as far as this repository's tooling is concerned,
 * and therefore may not exist at all.**
 *
 * ## Read as bytes
 *
 * Deliberately NOT through `readSource()`. Stripping comments is right for
 * every scan that hunts prose; it is wrong here, because a NUL inside a
 * comment blinds `grep` exactly as well as a NUL inside code. This reads the
 * raw buffer and looks at bytes.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { reporter } from "./_verify";

const { check, finish } = reporter();

/** Directories that are not ours to police. */
const SKIP = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
  "coverage",
]);

/**
 * Every `.ts` and `.tsx` under a root.
 *
 * Written here rather than reused from `_i18n-coverage.ts` because that
 * `walk()` returns **only** `.tsx` — which is the bug that made 37L.2's first
 * C205 ratchet scan nothing, find nothing, and pass. A helper whose filter is
 * a surprise is a helper that produces a vacuous check.
 */
function sources(root: string): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP.has(entry)) continue;
      const path = join(dir, entry);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) visit(path);
      else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) found.push(path);
    }
  };
  visit(root);
  return found;
}

/** Where a NUL is, in a form a person can act on. */
function nulSites(file: string): string[] {
  const buffer = readFileSync(file);
  const sites: string[] = [];
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] === 0) {
      // The line number, counted in the raw bytes so it matches the editor.
      let line = 1;
      for (let j = 0; j < i; j += 1) if (buffer[j] === 0x0a) line += 1;
      sites.push(`${file}:${line}`);
    }
  }
  return sites;
}

function main() {
  const roots = ["lib", "app", "components", "scripts", "tests", "middleware.ts"];

  const files = roots.flatMap((root) =>
    root.endsWith(".ts") || root.endsWith(".tsx") ? [root] : sources(root),
  );

  const offenders = files.flatMap(nulSites);

  /*
   * 🔴 The count is part of the assertion.
   *
   * "Zero files contain a NUL" is also what a scanner that found no files
   * reports, and that scanner passes forever. A real number of files scanned
   * is the half of this check that can fail for the right reason.
   */
  check(
    "🔴 45.0 / C245 no .ts or .tsx file contains a NUL byte",
    files.length > 400 && offenders.length === 0,
    offenders.length === 0
      ? `${files.length} source files scanned as bytes, none binary to grep`
      : offenders.join(", "),
  );

  /*
   * 🔴 CONTROL — the scanner is proved against a planted offender.
   *
   * A guard for an absent thing is worth exactly nothing until it has been
   * shown to catch the thing present. This writes a real NUL into a real file
   * in the system temp directory, runs the same `nulSites` the check above
   * runs, and asserts it is found at the right line. If this fails, the check
   * above is decorative regardless of what it printed.
   *
   * `String.fromCharCode(0)` rather than an escape in a template literal, so
   * that THIS file does not acquire the byte it exists to forbid — which
   * would be the §6 family closing the loop on itself for a ninth time.
   */
  const planted = join(tmpdir(), `nul-control-${process.pid}.ts`);
  let controlFound: string[] = [];
  try {
    writeFileSync(planted, `const a = 1;\nconst b = "x${String.fromCharCode(0)}y";\n`, "utf8");
    controlFound = nulSites(planted);
  } finally {
    try {
      unlinkSync(planted);
    } catch {
      // The control file is in tmp; a failure to remove it is not a failure of
      // the check, and swallowing it here keeps the real result visible.
    }
  }

  check(
    "🔴 CONTROL a planted NUL is caught, at the right line",
    controlFound.length === 1 && controlFound[0]!.endsWith(":2"),
    controlFound.length === 1
      ? `found at ${controlFound[0]!.replace(tmpdir(), "<tmp>")}`
      : `planted one NUL on line 2, scanner reported ${controlFound.length}`,
  );

  /*
   * The file that started it, named, so a regression reads as a regression
   * rather than as a new discovery. `facts.ts` is the clinical evidence layer
   * and the only file this has ever happened to.
   */
  check(
    "45.0 lib/data/facts.ts is readable by grep",
    nulSites("lib/data/facts.ts").length === 0 &&
      readFileSync("lib/data/facts.ts", "utf8").includes("JSON.stringify([fact.domain"),
    "composite key is JSON, which is unambiguous for any string and is text",
  );

  finish("45.0 · NUL bytes");
}

main();
