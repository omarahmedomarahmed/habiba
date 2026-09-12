import { readdirSync, readFileSync } from "node:fs";

/**
 * Counting the region pins, STATICALLY. PLAN.md 30.1, C157.
 *
 * ## 🔴 Why this exists, and what it replaces
 *
 * Sprint 30 reported "47 pinned". The real figure is 85 call sites in 82
 * files, and the sprint report was wrong by 45 per cent.
 *
 * The cause is worth more than the number. `regionPins()` is a **runtime**
 * registry: a module registers its pin when something imports it, so the
 * verifier printed the modules that one execution happened to load. It
 * measured what it could reach rather than what is true — which is the same
 * defect as C84's checker matching its own helper and 18.8 passing vacuously
 * against no content. Third time in this repository, and the first two were
 * caught the same way: somebody counted the source by hand and got a different
 * answer.
 *
 * So the count is a property of the **source**, walked the way the C84 guard
 * walks files. A number that depends on which modules a script imported is not
 * a measurement of anything.
 *
 * ## And the ratchet
 *
 * A pin is debt. Debt that can grow quietly is how C89 kept coming back, so
 * the high-water mark is committed to `_region-pins.json` and the check fails
 * when the count goes **up**. Routing a module lowers it; adding a pin has to
 * be a deliberate edit to a checked-in number, which is a conversation rather
 * than a drift.
 */

export type Pin = { file: string; line: number; where: string; reason: string };

/** Where the definition lives, which is not itself a pin. */
const DEFINITION = "lib/db/region.ts";

const ROOTS = ["app", "lib", "scripts", "tests"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Every call site, from the source.
 *
 * Matches the call rather than the import, because a module can import the
 * function and not use it, and because the call is what carries the `where`
 * and the `reason` the report quotes.
 */
export function scanRegionPins(): Pin[] {
  const call = /pinnedToDefaultRegion\(\s*"([^"]+)"\s*,\s*"([^"]*)"/g;
  const pins: Pin[] = [];

  for (const root of ROOTS) {
    for (const file of walk(root)) {
      if (file === DEFINITION) continue;

      const source = readFileSync(file, "utf8");
      if (!source.includes("pinnedToDefaultRegion(")) continue;

      call.lastIndex = 0;
      for (let match = call.exec(source); match; match = call.exec(source)) {
        const line = source.slice(0, match.index).split("\n").length;
        pins.push({ file, line, where: match[1]!, reason: match[2]! });
      }
    }
  }

  return pins.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/**
 * 🔴 A pin whose `where` does not name its own file is a pin that will be
 * quoted against the wrong module in a report.
 *
 * Cheap to check and easy to get wrong: the label is a hand-written string
 * beside a path, and the two drift the moment a file is moved.
 */
export function mislabelled(pins: Pin[]): Pin[] {
  return pins.filter((pin) => pin.where !== pin.file);
}
