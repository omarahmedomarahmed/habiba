/**
 * Can a HUMAN reach it? The second half. PLAN.md 58.1 to 58.5, C335, C356.
 *
 * ## What `_reachability.ts` measures, and what it does not
 *
 * That file asks whether every TABLE has a screen. It is careful, it has a
 * documented history of being wrong twice, and it explicitly excludes
 * `app/api/**` because a route is not a page a human can reach.
 *
 * It therefore cannot see three things, and this file is those three:
 *
 *   1. An exported **server action** with no button. It compiles, it is typed,
 *      it is covered by a unit test, and no screen calls it.
 *   2. An **API route** nothing calls. Same shape, plus an attack surface.
 *   3. A **page** nothing links to. Reachable by typing a URL and by no other
 *      means, which for a patient in distress is the same as absent.
 *
 * The founder asked whether every backend, route and action has a page and a
 * button behind it. The honest answer was that nobody could tell, because no
 * gate in this repository measured it. This is the gate.
 *
 * ## 🔴 C356 — reachable from a PAGE, never "imported by a component"
 *
 * `_reachability.ts`'s own header records this bug: its first draft asked
 * whether a table identifier appeared anywhere under `app/` or `components/`
 * and reported forty-eight orphans, every one false. Its second draft counted
 * `app/api/**` as a surface and called a table reachable because an ingest
 * route read it.
 *
 * A component imported by nothing is not a surface. So a module is reachable
 * only when some chain of imports from it ends at a `page.tsx` or a
 * `layout.tsx`, which are the two files Next actually renders.
 *
 * ## The allowlist carries reasons, and a stale entry FAILS
 *
 * An allowlist with no reason beside each line is where orphans go to be
 * forgotten. Worse, an entry that stops being an orphan is a rule nobody is
 * checking any more. Both are the rule `_reachability.ts` already applies to
 * tables, reused here rather than reinvented.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { stripCommentsKeepingLines } from "./_dashes";

const ROOT = process.cwd();

/*
 * 🔴 The skip list is anchored at the ROOT, and the first version was not.
 *
 * `["node_modules", ".next", "public", ...].includes(entry)` skips ANY directory
 * with one of those names, at any depth. This repository has
 * `components/public/`, which holds the marketing blocks, the pricing cards and
 * the contact form. The scanner was blind to all of it and reported
 * `submitContact` as an orphan while the form that calls it sat in the
 * directory it had skipped.
 *
 * That is the §6 family inside the gate written to catch the §6 family, and it
 * was caught by a real finding looking wrong rather than by reading. The
 * control at the bottom of `verify:reachable` now asserts the count of files
 * under `components/public` for exactly this reason.
 */
const SKIP_AT_ROOT = ["node_modules", ".git", ".claude", "drizzle", "public", ".render", ".vercel"];

/**
 * 🔴 77.7 — ANY NEXT BUILD DIRECTORY, not the one called `.next`.
 *
 * `.next` was named and `.next-dev` was not, and `NEXT_DIST_DIR=.next-dev` is
 * how a second dev server runs beside a build. Next writes a typed route stub
 * per route into `<dist>/types/app/**`, each one a real `.ts` file containing
 * the route's own path — so the scan found `/api/cron` inside a generated file
 * and concluded the route had an in-repo caller. 58.4 then failed the
 * allowlist entry as stale, which is the gate reporting on a build artefact
 * and calling it coverage.
 *
 * A prefix rather than a second name: the next person to set `NEXT_DIST_DIR`
 * will not think to come here.
 */
function isBuildDir(entry: string): boolean {
  return entry.startsWith(".next");
}

function walk(dir: string, out: string[] = [], depth = 0): string[] {
  for (const entry of readdirSync(dir)) {
    if (depth === 0 && (SKIP_AT_ROOT.includes(entry) || isBuildDir(entry))) continue;
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out, depth + 1);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

export type Surfaces = {
  files: string[];
  body: Map<string, string>;
  /**
   * 🔴 THE SAME FILES WITH THE COMMENTS TAKEN OUT, and every "is this thing
   * mentioned anywhere" question has to use it.
   *
   * A sentence naming a route, a page or a function is not a caller of it. The
   * export scanner below already learned this, in its own words, after the rule
   * had been forgotten eight times. It had not been applied to routes or to
   * pages, and that is the ninth: a doc comment in `lib/lifecycle/machines.ts`
   * saying where the cron is proved made `/api/cron` look called.
   *
   * The false FAIL is the harmless half. The dangerous half is the false PASS:
   * an orphaned API route with a public URL, masked for ever because somebody
   * mentioned its path in a paragraph. Which is why this is a field on the
   * shared object rather than a local map each scanner has to remember to
   * build, and it keeps line numbers so nothing downstream shifts.
   */
  code: Map<string, string>;
  /** True when a chain of imports from this module ends at a page or a layout. */
  reachesPage: (mod: string) => boolean;
};

/** A file Next actually renders. Everything else is reachable only through one. */
function isRendered(file: string): boolean {
  return /^app\/.*\/(page|layout)\.tsx$/.test(file) || /^app\/(page|layout)\.tsx$/.test(file);
}

export function loadSurfaces(): Surfaces {
  const files = walk(ROOT).map((f) => f.slice(ROOT.length + 1));
  const body = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));

  /*
   * Who imports this module, by the `@/` alias this codebase uses everywhere.
   *
   * Relative imports inside one directory are also real, so a bare basename is
   * accepted when the importer sits in the same folder. Missing those is the
   * difference between "no importer" and "no importer I looked for", and this
   * file exists to refuse exactly that kind of answer.
   */
  function importersOf(mod: string): string[] {
    const base = mod.replace(/\.tsx?$/, "");
    const dir = base.slice(0, base.lastIndexOf("/"));
    const leaf = base.slice(base.lastIndexOf("/") + 1);
    const aliases = ["@/" + base];
    if (base.endsWith("/index")) aliases.push("@/" + base.slice(0, -"/index".length));

    return files.filter((f) => {
      if (f === mod) return false;
      const src = body.get(f)!;
      if (aliases.some((a) => src.includes(`"${a}"`) || src.includes(`'${a}'`))) return true;
      // `./thing` or `../thing`, only from a file that could resolve it.
      const sameDir = f.slice(0, f.lastIndexOf("/")) === dir;
      return sameDir && (src.includes(`"./${leaf}"`) || src.includes(`'./${leaf}'`));
    });
  }

  const memo = new Map<string, boolean>();
  function reachesPage(mod: string, seen = new Set<string>()): boolean {
    if (isRendered(mod)) return true;
    if (memo.has(mod)) return memo.get(mod)!;
    if (seen.has(mod)) return false;
    seen.add(mod);
    const result = importersOf(mod).some((i) => reachesPage(i, seen));
    // Only memoise a definite answer: a `false` produced by hitting the `seen`
    // guard is a cycle, not a verdict, and caching it poisons every sibling.
    if (result) memo.set(mod, true);
    return result;
  }

  const code = new Map(
    files.map((f) => [f, stripCommentsKeepingLines(body.get(f)!)] as const),
  );

  return { files, body, code, reachesPage: (mod) => reachesPage(mod) };
}

/* ------------------------------------------------------- server actions -- */

export type ActionRef = { file: string; name: string };

/**
 * Every exported function in a `"use server"` file.
 *
 * The directive has to be at the top of the file for Next to honour it, so a
 * loose `"use server"` deeper in a string is not a false positive worth
 * engineering around: the check below reads the first few lines only.
 */
export function serverActions(s: Surfaces): ActionRef[] {
  const out: ActionRef[] = [];
  for (const file of s.files) {
    if (!file.startsWith("app/") && !file.startsWith("lib/")) continue;
    const src = s.body.get(file)!;
    const head = src.slice(0, 400);
    if (!/^\s*["']use server["']/m.test(head)) continue;
    for (const m of src.matchAll(/export\s+async\s+function\s+(\w+)/g)) {
      out.push({ file, name: m[1]! });
    }
  }
  return out;
}

/**
 * An action is WIRED when its name appears in a module that reaches a page.
 *
 * Not "appears anywhere": an action called only by another action, or only by a
 * test, is exactly the orphan this looks for. The action's own file is excluded
 * because a file naming its own export proves nothing.
 */
export function unwiredActions(s: Surfaces, actions: ActionRef[]): ActionRef[] {
  return actions.filter((action) => {
    const pattern = new RegExp(`\\b${action.name}\\b`);
    const callers = s.files.filter(
      (f) =>
        f !== action.file &&
        !f.startsWith("scripts/") &&
        !f.startsWith("tests/") &&
        pattern.test(s.body.get(f)!),
    );
    return !callers.some((c) => s.reachesPage(c));
  });
}

/* ----------------------------------------------------------- API routes -- */

/** `app/api/foo/[id]/route.ts` becomes `/api/foo`, which is what a caller types. */
export function routePath(file: string): string {
  const path = file.replace(/^app/, "").replace(/\/route\.tsx?$/, "");
  const dynamic = path.indexOf("/[");
  const stem = dynamic === -1 ? path : path.slice(0, dynamic);
  return stem.replace(/\/\([^)]+\)/g, "") || "/";
}

export function apiRoutes(s: Surfaces): string[] {
  return s.files.filter((f) => /^app\/api\/.*\/route\.tsx?$/.test(f));
}

/**
 * A route is CALLED when its path appears somewhere that is not its own file.
 *
 * A route called only from another route, or only from a script, still counts
 * here: unlike an action, a route has legitimate non-page callers (a cron, a
 * provider's webhook), and those are what the allowlist is for. What this
 * catches is a route NOTHING mentions, which is dead code with a public URL.
 */
export function uncalledRoutes(s: Surfaces, routes: string[]): string[] {
  return routes.filter((file) => {
    const path = routePath(file);
    return !s.files.some(
      (f) =>
        f !== file &&
        /*
         * 🔴 `scripts/` does not count, and the first version let it.
         *
         * `verify-reachable.ts` allowlists `/api/stripe/webhook` by name, so the
         * allowlist string itself made the route look called, the route stopped
         * being an orphan, and 58.4 then failed the entry as stale. A gate whose
         * own source is part of what it measures reports on itself.
         *
         * The same exclusion already applies to actions, for the same reason: a
         * verifier naming a thing is not a person reaching it.
         */
        !f.startsWith("scripts/") &&
        !f.startsWith("tests/") &&
        /* A comment naming the path is prose, not a caller. See `code` above. */
        s.code.get(f)!.includes(path),
    );
  });
}

/* ---------------------------------------------------------------- pages -- */

/** `app/(app)/sessions/[id]/page.tsx` becomes `/sessions`. Route groups vanish. */
export function pagePath(file: string): string {
  const path = file.replace(/^app/, "").replace(/\/page\.tsx?$/, "");
  const dynamic = path.indexOf("/[");
  const stem = dynamic === -1 ? path : path.slice(0, dynamic);
  return stem.replace(/\/\([^)]+\)/g, "") || "/";
}

export function pages(s: Surfaces): string[] {
  return s.files.filter((f) => /^app\/.*page\.tsx$/.test(f) || f === "app/page.tsx");
}

/**
 * A page is LINKED when its path appears in some other file.
 *
 * `href`, `redirect()`, `router.push()`, a middleware table, an email body: all
 * of them are ways a person gets there and none of them is worth a separate
 * pattern. What is not a link is the page's own file, and what is not a link is
 * a longer path that merely starts with this one, which is why the match is
 * anchored on the closing quote or a following slash.
 */
export function unlinkedPages(s: Surfaces, all: string[]): string[] {
  return all.filter((file) => {
    const path = pagePath(file);
    if (path === "/") return false; // the root is reachable by definition
    const anchored = new RegExp(`${path.replace(/\//g, "\\/")}(?:["'\`/?]|\\$\\{)`);
    return !s.files.some(
      (f) =>
        f !== file &&
        !f.startsWith("scripts/") &&
        !f.startsWith("tests/") &&
        /* Same rule as routes: a sentence about a page is not a link to it. */
        anchored.test(s.code.get(f)!),
    );
  });
}


/* ------------------------------------------------- exported library code -- */

/**
 * 🔴 C369 — the gap four auditors found independently, one layer below actions.
 *
 * `verify:reachable` shipped at 13/13 over 233 server actions, 26 API routes and
 * 114 pages, and could not see a single one of these:
 *
 *   lib/partner/api.ts       `upsertSubject`, the ONLY way a `partner_subjects`
 *                            row can exist. Zero callers, so three of the five
 *                            documented partner API use cases are unreachable.
 *   lib/partner/webhooks.ts  `queueWebhook`. Zero callers. The registration UI
 *                            is built and no event has ever fired.
 *   lib/data/sponsors.ts     `potBalance`, the anti-differencing floor C229 was
 *                            written for. Zero callers, so both sponsor screens
 *                            render the raw balance and a sponsor can infer that
 *                            one named person had a session today.
 *   lib/data/enrolment-verify.ts  `unpause`, C247's promised one-step manual
 *                            unpause. Zero callers.
 *
 * Every one is a SAFETY function. That is not a coincidence: a safety function
 * is exactly the kind that gets written to satisfy a ruling, passes a
 * source-reading verifier, and is never wired to anything, because nothing
 * fails when it is absent.
 *
 * So the rule widens: an exported function in a safety-critical module is
 * reachable, or it is an allowlisted decision with a reason. The module list is
 * explicit rather than "all of lib", because `lib` also holds helpers, types and
 * pure arithmetic whose call sites are legitimately narrow.
 */
export const SAFETY_MODULES = [
  "lib/data/",
  "lib/partner/",
  "lib/billing/",
  "lib/crisis/",
  "lib/console/",
  "lib/access/",
  "lib/ehr/",
  /*
   * 🔴 76.38 — `lib/ai/` ADDED, AFTER A CLINICIAN FOUND WHAT WAS HIDING IN IT.
   *
   * `diariseSession` works out who said what on a one-microphone session. It
   * was exported, unit-tested, benchmarked, given a backfill script, described
   * in a comment in `session-room.tsx` as the thing that resolves `unknown`
   * lines afterwards, and **called by nothing in the product**. Every offline
   * transcript read `unknown` for ever, which the panel renders as "Speaker" on
   * every line, and the note was generated over lines attributing nothing to
   * anybody.
   *
   * This scanner could not see it, because `lib/ai/` was not on this list.
   *
   * The omission had a reason and the reason was wrong. The list was written as
   * "safety-critical modules", and the four findings that produced it were all
   * about disclosure and money. But the argument two paragraphs up is not about
   * safety, it is about a KIND of function: one written to satisfy a ruling,
   * which passes a source-reading verifier, and which nothing fails without.
   * `lib/ai/` is full of exactly that kind. It holds the diariser, the note
   * writer, the risk classifier and the profile builder, and a clinical record
   * that silently stops attributing speech is the same defect shape as a
   * sponsor screen that silently stops suppressing a balance.
   *
   * 🔴 IT COST 12 MORE DEAD EXPORTS on the ratchet, and every one of them is
   * debt that was always there and was not being counted.
   */
  "lib/ai/",
];

export function libraryExports(s: Surfaces): ActionRef[] {
  const out: ActionRef[] = [];
  for (const file of s.files) {
    if (!SAFETY_MODULES.some((m) => file.startsWith(m))) continue;
    if (file.endsWith(".d.ts")) continue;
    const src = s.body.get(file)!;
    // A `"use server"` file is already covered by `serverActions`.
    if (/^\s*["']use server["']/m.test(src.slice(0, 400))) continue;
    for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) {
      out.push({ file, name: m[1]! });
    }
  }
  return out;
}

/**
 * An exported function is CALLED when its name appears in another non-test,
 * non-script file. Deliberately looser than the action rule: a library function
 * called by another library function is legitimately wired, and demanding a path
 * to a page would flag every helper in the codebase.
 *
 * What this catches is the one that nothing anywhere calls, which is the shape
 * all four findings had.
 */
export function uncalledExports(s: Surfaces, fns: ActionRef[]): ActionRef[] {
  /*
   * 🔴 COMMENTS STRIPPED FIRST, and the first version of this did not.
   *
   * C205 is a standing rule of this repository: strip comments before any scan
   * of source, without exception, because seven checkers have now matched the
   * prose describing the defect they hunt. This file broke it immediately:
   * `queueWebhook` has no caller, and the scan called it wired because
   * `app/(partner)/partner/webhooks/actions.ts` mentions it IN A COMMENT
   * explaining why the payload is not configurable.
   *
   * A rule forgotten eight times is not a rule, it is a hope. So it stopped
   * being a local map here, where only this scanner could remember it, and
   * became `s.code`, which is built once and is what the route and page
   * scanners now read too. The ninth time was this file's own neighbours.
   */
  const code = s.code;

  return fns.filter((fn) => {
    const pattern = new RegExp(`\\b${fn.name}\\b`);
    /*
     * 🔴 A CALL IN ITS OWN FILE IS A CALL. The declaration is one mention; a
     * second one (comments are already stripped) is the module using it, as
     * when a rule is split into a small exported function so a test can pin it
     * and the module's own write path calls it. Counting that as "no caller"
     * made every such seam read as dead safety code, which it is not.
     */
    const own = code.get(fn.file) ?? "";
    if ((own.match(new RegExp(`\\b${fn.name}\\b`, "g")) ?? []).length >= 2) return false;
    return !s.files.some(
      (f) =>
        f !== fn.file &&
        !f.startsWith("scripts/") &&
        !f.startsWith("tests/") &&
        pattern.test(code.get(f)!),
    );
  });
}
