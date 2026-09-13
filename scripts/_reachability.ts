import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 51.6 — can a HUMAN reach it? PLAN.md 51.6, 37R.21, 37R.22, C179.
 *
 * ## What this measures, and the version of it that was wrong
 *
 * The first draft asked whether each drizzle table identifier appeared
 * anywhere under `app/` or `components/`. It reported forty-eight orphans,
 * every one of them false: this codebase layers pages onto `lib/data/*`, so a
 * page correctly never names a table. It was measuring "is the schema imported
 * by a component" while claiming to measure "can somebody get to it".
 *
 * The second draft fixed that with transitive imports and still counted
 * `app/api/**` as a surface. `session_sources` came back reachable, because an
 * ingest ROUTE reads it. A route is not a page a human can reach, and 51.6 is
 * about people rather than about code being referenced somewhere. That is the
 * §6 family twice inside one scanner.
 *
 * So: a table is reachable when some module that names it is imported,
 * transitively, by a file under `app/` that is not an API route, or under
 * `components/`.
 *
 * ## The allowlist, and why it has to carry reasons
 *
 * Some tables are machinery and correctly have no screen: a session-cookie
 * table, a rate-limit counter. An allowlist with no reason beside each entry
 * becomes the place orphans go to be forgotten, so each one says why, and the
 * verifier fails if an entry stops being an orphan (a stale exemption is a
 * rule nobody is checking any more).
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "drizzle", "public"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

export type Orphan = { table: string; ident: string; holders: string[] };

export function scanReachability(): { tables: number; orphans: Orphan[] } {
  const schema = readFileSync(join(ROOT, "lib/db/schema.ts"), "utf8");
  const tables = [...schema.matchAll(/export const (\w+) = pgTable\(\s*\n?\s*"(\w+)"/g)].map(
    (m) => ({ ident: m[1]!, table: m[2]! }),
  );

  const files = walk(ROOT).map((f) => f.slice(ROOT.length + 1));
  const body = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));

  /* 🔴 An API route is not a page a human can reach. */
  const isSurface = (f: string) =>
    (f.startsWith("app/") && !f.startsWith("app/api/")) || f.startsWith("components/");

  function importersOf(mod: string): string[] {
    const base = mod.replace(/\.tsx?$/, "");
    const specs = ["@/" + base];
    // A directory index is imported as "@/lib/settings", not ".../index".
    if (base.endsWith("/index")) specs.push("@/" + base.slice(0, -"/index".length));
    return files.filter((f) => f !== mod && specs.some((s) => body.get(f)!.includes(s)));
  }

  const memo = new Map<string, boolean>();
  function reaches(mod: string, seen = new Set<string>()): boolean {
    if (isSurface(mod)) return true;
    if (memo.has(mod)) return memo.get(mod)!;
    if (seen.has(mod)) return false;
    seen.add(mod);
    const result = importersOf(mod).some((i) => reaches(i, seen));
    memo.set(mod, result);
    return result;
  }

  const orphans: Orphan[] = [];
  for (const { ident, table } of tables) {
    const holders = files.filter(
      (f) =>
        f !== "lib/db/schema.ts" &&
        !f.startsWith("scripts/") &&
        !f.startsWith("tests/") &&
        new RegExp(`\\b${ident}\\b`).test(body.get(f)!),
    );
    if (!holders.some((h) => reaches(h))) orphans.push({ table, ident, holders });
  }

  return { tables: tables.length, orphans };
}

/**
 * Tables that correctly have no human surface, each with the reason.
 *
 * 🔴 "Either a screen exists or a ticket owns it. No third option." These are
 * the ones where the answer is "a screen would be wrong", which is neither of
 * 51.6's two options and so has to be argued rather than assumed.
 */
export const NO_SCREEN_BY_DESIGN: Record<string, string> = {
  patient_auth_sessions:
    "Session cookies. A screen listing somebody's live sessions is a feature (sign out everywhere) and not this table's absence of one; when that feature exists it will read this table and this entry goes.",
  /*
   * 🔴 55.2 — THE ONE EXEMPTION IN THIS FILE WHOSE ABSENCE IS THE FEATURE.
   *
   * Every other entry here is a table that has no screen YET. This one must never get one.
   *
   * `partner_subjects` maps a partner's own reference for a person to ours, inside a flow that
   * partner started. A screen listing them would be a list of the people an integrator has
   * referred into therapy: the roster that C255 and three separate enrolment designs were spent
   * removing, rebuilt as a table with a search box on it. The partner portal's navigation has
   * four tabs and `verify:sprint55` asserts that none of them is this.
   *
   * So the exemption is not "not built". It is the design, and the day somebody adds the screen
   * this entry becomes stale and the CONTROL in `verify:sprint51` fails, which is exactly the
   * right way for that change to be noticed.
   */
  partner_subjects:
    "55.2 / C255. A partner's reference for a person, resolved only inside a flow they started. A screen listing them IS the roster three enrolment designs were spent removing, so this table must never acquire one: the exemption is the design rather than a gap.",
};
