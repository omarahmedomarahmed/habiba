/**
 * 🔴 76.62 — THE RUN'S OWN DOCUMENTS, CHECKED AGAINST THE PRODUCT THEY DESCRIBE.
 *
 *     npm run verify:runbook
 *
 * ## Why this exists
 *
 * `docs/simulation/` is the instruction set for a month of agents acting on
 * production. Prose rots under code that moves, and the failures are silent: a
 * command written without `on:production` operates on dev, a cron job named
 * wrongly answers 404, a page nobody listed is a page nobody tests.
 *
 * So the documents are read here against the code: the production-only commands
 * from the allow-list, the cron jobs from the route's own map, the page list from
 * `app/`, and the step and edge ids from the files that define them.
 *
 * ## 🔴 EVERY EXPECTATION IS DERIVED, NOT TYPED
 *
 * The gate count comes from `GATES`. The production-only command list comes from
 * `on-production.ts`'s own allow-list. The document list comes from the
 * directory. The cron jobs come from the route's `JOBS` map. The page list
 * comes from `app/`. The step and edge ids come from the tables that define them.
 *
 * A checker holding its own copy of a number is a checker that stops matching
 * the day somebody tunes the real one, and then it is green about a number
 * nothing enforces. That is the §6 family and this repository has found it
 * eight times.
 *
 * ## What it does not do
 *
 * It cannot read for sense. A document can be internally consistent, correctly
 * numbered, pointed at the right database, and still describe a screen that was
 * redesigned last week. That needs a person reading the flows against the
 * live site, which is what round 0 of the run is.
 *
 * It only reads files.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { GATES } from "./_gates";
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

const DIR = "docs/simulation";

/**
 * 🔴 WHERE HISTORY IS ALLOWED TO LIVE, AND IT IS EXACTLY ONE FILE.
 *
 * The run needs to know what people hit before it. It does not need to know
 * what a document used to say. Those are different things and mixing them puts
 * the reader's first attention on a correction rather than on a fact.
 */
const LESSONS = "00-LESSONS.md";

type Doc = { name: string; path: string; body: string };

function docs(): Doc[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((name) => ({ name, path: join(DIR, name), body: readFileSync(join(DIR, name), "utf8") }));
}

function all(): Doc[] {
  return docs();
}

/** Lines of a document, one-indexed, for an error somebody can act on. */
function lines(d: Doc): [number, string][] {
  return d.body.split("\n").map((l, i) => [i + 1, l] as [number, string]);
}

function main() {
  const files = all();

  /* ------------------------------------- A · the database every command names */

  /*
   * 🔴 THE ALLOW-LIST IS THE SOURCE OF TRUTH FOR WHAT IS PRODUCTION-ONLY.
   *
   * A command on `on-production.ts`'s allow-list is a command that means
   * something against the run's database and nothing against dev. Written bare
   * in a runbook, it silently operates on the wrong one: `spend` reports dev's
   * zero against a $10 budget, `baseline` compares dev to production's mark,
   * and `age` leaves the six month clock unstarted.
   *
   * `gates`, `build` and `probe` are deliberately NOT on that list, so they are
   * unaffected and stay bare, which is correct: they prove the code.
   */
  const onProd = readSource("scripts/on-production.ts");
  const productionOnly = new Set(
    [...onProd.matchAll(/^\s*"?([a-z0-9:\-]+)"?:\s*\{\s*writes:/gm)].map((m) => m[1]!),
  );

  const bare: string[] = [];
  for (const d of files) {
    for (const [n, line] of lines(d)) {
      if (line.includes("on:production")) continue;
      for (const m of line.matchAll(/npm run ([a-z0-9:\-]+)/g)) {
        if (productionOnly.has(m[1]!)) bare.push(`${d.name}:${n} npm run ${m[1]!}`);
      }
    }
  }

  check(
    "🔴 every production-only command in the run's documents names production",
    bare.length === 0,
    bare.length === 0
      ? `${String(productionOnly.size)} commands on the allow-list, none written bare in ${String(files.length)} documents`
      : `${String(bare.length)} would hit DEV:\n       ` + bare.slice(0, 8).join("\n       ") +
        (bare.length > 8 ? `\n       … and ${String(bare.length - 8)} more` : ""),
  );

  check(
    "🔴 CONTROL …and the allow-list was actually read, so 'none found' cannot mean 'nothing to find'",
    productionOnly.size >= 10 && productionOnly.has("age") && productionOnly.has("spend"),
    `${String(productionOnly.size)} production commands discovered, including age and spend`,
  );

  /* --------------------------------------------- B · counts, against the code */

  const gateCount = GATES.length;
  const gateClaims = new Set<string>();
  for (const d of files) {
    for (const [, line] of lines(d)) {
      for (const m of line.matchAll(/\b(\d+|twenty[- ]?\w+|thirty[- ]?\w*|eleven|twelve|thirteen|fourteen) gates\b/gi)) {
        gateClaims.add(m[1]!.toLowerCase());
      }
    }
  }
  /*
   * 🔴 AND THE MAP HAS TO OUTRUN THE GATE LIST, or the check goes quiet.
   *
   * It stopped at 29. Adding the thirtieth gate took the spelled-out form past
   * the end of this map, and the regex above did not know the word "thirty"
   * either, so a document saying "thirty gates" was not wrong — it was
   * INVISIBLE. A counter that silently stops counting is worse than one that
   * is off by one, because the off-by-one announces itself.
   */
  const words: Record<number, string> = {
    26: "twenty-six", 27: "twenty-seven", 28: "twenty-eight", 29: "twenty-nine",
    30: "thirty", 31: "thirty-one", 32: "thirty-two", 33: "thirty-three",
    34: "thirty-four", 35: "thirty-five", 36: "thirty-six", 37: "thirty-seven",
    38: "thirty-eight", 39: "thirty-nine", 40: "forty", 41: "forty-one", 42: "forty-two",
  };
  const okGate = new Set([String(gateCount), words[gateCount] ?? "", (words[gateCount] ?? "").replace("-", " ")]);
  const wrongGates = [...gateClaims].filter((c) => !okGate.has(c));

  check(
    `🔴 every "N gates" claim matches the ${String(gateCount)} gates that exist`,
    wrongGates.length === 0,
    wrongGates.length === 0
      ? `all claims read ${String(gateCount)}`
      : `found: ${wrongGates.join(", ")}, and the real number is ${String(gateCount)}`,
  );

  /* ------------------------------------- C · every document reference resolves */

  const present = new Set(readdirSync(DIR).filter((f) => f.endsWith(".md")));
  const missing: string[] = [];
  for (const d of files) {
    for (const [n, line] of lines(d)) {
      for (const m of line.matchAll(/`?(\d\d-[A-Z0-9\-]+\.md)`?/g)) {
        if (!present.has(m[1]!)) missing.push(`${d.name}:${String(n)} -> ${m[1]!}`);
      }
    }
  }
  check(
    "🔴 every simulation document named by another one exists",
    missing.length === 0,
    missing.length === 0
      ? `${String(present.size)} documents, every reference resolves`
      : missing.slice(0, 6).join("; "),
  );

  /* --------------------------- C2 · every PATH a document points at is real */

  /*
   * 🔴 THE README IS A MAP, AND A MAP WITH A ROAD THAT IS NOT THERE IS WORSE
   * THAN NO MAP.
   *
   * It exists so somebody arriving with no context knows what to read, and it
   * does that by naming files. Every rename in this repository is a chance for
   * one of those names to stop resolving, and the failure is silent: the table
   * still looks authoritative, and the person following it loses an hour
   * before concluding the document is stale and ignoring all of it.
   *
   * Check C above does this for the simulation folder's own `NN-NAME.md`
   * cross references and stops there. This covers any repository path a
   * document points at, in the README and in `docs/`, which is where the
   * orientation for a new session actually lives.
   *
   * The pattern is deliberately narrow: a backticked token starting with a
   * real top-level directory. `npm run gates` is a command, `p=none` is a DNS
   * value, and neither is a path, so neither is checked.
   */
  /**
   * 🔴 A PATH A DOCUMENT PROMISES IS NOT A PATH A DOCUMENT IS WRONG ABOUT.
   *
   * `docs/simulation-run/` is where the six month run WRITES its output. It
   * does not exist because the run has not happened, and the prompt naming it
   * is correct: that is the instruction for where to put the report.
   *
   * Listed rather than pattern-matched, so a genuinely dead path cannot hide
   * behind a rule like "anything under docs/ that looks like output". Each
   * entry carries why, and the check below fails if one starts existing, which
   * is the same stale-exemption rule `verify:reachable` applies to its own
   * allow-list.
   */
  const NOT_YET: Record<string, string> = {
    "docs/simulation-run/":
      "Where the one month run writes its board, bugs, shots and report. The documents name it as an instruction, and it appears the day the run posts its first row.",
  };

  const POINTERS = /`((?:app|components|lib|scripts|docs|drizzle|evals|tests)\/[A-Za-z0-9._/()[\]-]+)`/g;
  const docFiles = [
    { name: "README.md", body: readFileSync("README.md", "utf8") },
    ...readdirSync("docs")
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ name: `docs/${f}`, body: readFileSync(join("docs", f), "utf8") })),
  ];

  const dangling: string[] = [];
  let pointers = 0;
  for (const doc of docFiles) {
    for (const [n, line] of lines(doc as never)) {
      for (const m of line.matchAll(POINTERS)) {
        pointers += 1;
        /*
         * `docs/INVENTORY.md` is generated and lists a component as
         * `components/admin/actuals-table`, because that is how the page
         * imports it. The file on disk carries the extension. Trying both is
         * the difference between a checker that reads what documents actually
         * contain and one that reports two hundred false findings on its first
         * run, which is a checker somebody switches off.
         */
        const target = m[1]!;
        const promised = Object.keys(NOT_YET).some((prefix) => target.startsWith(prefix));
        const resolves =
          promised ||
          existsSync(target) ||
          existsSync(`${target}.tsx`) ||
          existsSync(`${target}.ts`);
        if (!resolves) dangling.push(`${doc.name}:${String(n)} -> ${target}`);
      }
    }
  }

  check(
    "🔴 every repository path a document points at exists",
    dangling.length === 0,
    dangling.length === 0
      ? `${String(pointers)} pointers across ${String(docFiles.length)} documents, all resolve`
      : dangling.slice(0, 6).join("; "),
  );

  /*
   * 🔴 CONTROL — a scan that matched nothing would report the same green line
   * as a scan that matched everything and found no fault. It also has to
   * refuse a path that is not there, or "all resolve" means "none were asked".
   */
  check(
    "🔴 CONTROL the pointer scan found real paths and would catch a dead one",
    pointers > 20 && existsSync("scripts/_gates.ts") && !existsSync("scripts/_gates-not-a-file.ts"),
    `${String(pointers)} paths were actually looked up`,
  );

  /*
   * 🔴 AND A PROMISE THAT HAS BEEN KEPT STOPS BEING AN EXEMPTION.
   *
   * The moment the run writes its output, `docs/simulation-run/` is an
   * ordinary path and this entry covers nothing while reading as a considered
   * decision. That is the shape every stale allow-list in this repository has
   * had, and the rule that catches it is the same one `verify:reachable` uses.
   */
  const kept = Object.keys(NOT_YET).filter((path) => existsSync(path));
  check(
    "🔴 no 'not yet written' exemption outlives the thing it was waiting for",
    kept.length === 0 && Object.values(NOT_YET).every((why) => why.split(/\s+/).length >= 12),
    kept.length > 0
      ? `${kept.join(", ")} exists now. Delete its entry.`
      : `${String(Object.keys(NOT_YET).length)} promised path(s), none of them written yet`,
  );

  /* ------------------------------------------------- D · the cron jobs are real */

  /*
   * 🔴 THE PROMPT NAMED A JOB THAT DOES NOT EXIST. `sessions` was in the list
   * for weeks. An unknown name answers 404 `unknown_job` AFTER the secret has
   * been checked, so a wrong name and a wrong secret look nothing alike and
   * neither reads as a broken route. Read the route's own map.
   */
  const route = readSource("app/api/cron/[job]/route.ts");
  const jobs = new Set([...route.matchAll(/^\s{2}async ([a-z]+)\(\)/gm)].map((m) => m[1]!));
  const namedJobs = new Set<string>();
  for (const d of files) {
    for (const [, line] of lines(d)) {
      for (const m of line.matchAll(/\/api\/cron\/([a-z]+)/g)) namedJobs.add(m[1]!);
    }
  }
  const ghosts = [...namedJobs].filter((j) => !jobs.has(j));

  check(
    "🔴 every cron job the documents name is in the route's own JOBS map",
    jobs.size > 0 && ghosts.length === 0,
    jobs.size === 0
      ? "🔴 found no jobs at all, so this check measured nothing"
      : ghosts.length === 0
        ? `${String(jobs.size)} jobs exist (${[...jobs].sort().join(", ")}), ${String(namedJobs.size)} named, none invented`
        : `named but nonexistent: ${ghosts.join(", ")}`,
  );

  /* ------------------------------ D2 · every cron job has a place in the month */

  /*
   * A job the month never fires is a job whose effect nobody sees: a reminder
   * that never went, a hold that never swept. The rounds are where time passes,
   * so every job in the route's map has to be named there.
   */
  const month = files.find((d) => d.name === "02-THE-MONTH.md");
  const unfired = [...jobs].filter((j) => !month?.body.includes(`/api/cron/${j}`));
  check(
    "🔴 every cron job in the route's map is fired somewhere in 02-THE-MONTH.md",
    !!month && unfired.length === 0,
    !month ? "02-THE-MONTH.md is missing" : unfired.length === 0 ? `${String(jobs.size)} jobs, all fired` : `never fired: ${unfired.join(", ")}`,
  );

  /* ------------------------------ G · every page in the product is walked */

  /*
   * 🔴 THE PAGE LIST COMES FROM `app/`, SO A NEW PAGE IS UNCOVERED UNTIL SOMEBODY
   * PLACES IT. A route template (`/patients/[id]`, route groups removed) must
   * appear in `03-THE-FLOWS.md`, or in `08-COVERAGE.md` with the reason it is not
   * walked on the live site.
   */
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") {
        const route = "/" + full.split("/").slice(1, -1).filter((seg) => !/^\(.*\)$/.test(seg)).join("/");
        pages.push(route === "/" ? "/" : route.replace(/\/$/, ""));
      }
    }
  };
  walk("app");
  const flowsDoc = files.find((d) => d.name === "03-THE-FLOWS.md")?.body ?? "";
  const coverageDoc = files.find((d) => d.name === "08-COVERAGE.md")?.body ?? "";
  const named = (route: string, body: string) =>
    new RegExp("`" + route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "`").test(body);
  const unwalked = pages.filter((r) => !named(r, flowsDoc) && !named(r, coverageDoc));
  check(
    `🔴 every one of the ${String(pages.length)} pages in app/ is a step, or excused in 08-COVERAGE.md`,
    pages.length > 100 && unwalked.length === 0,
    unwalked.length === 0
      ? `${String(pages.length)} pages, every one placed`
      : `${String(unwalked.length)} not placed: ${unwalked.slice(0, 12).join(", ")}${unwalked.length > 12 ? " …" : ""}`,
  );
  check(
    "🔴 CONTROL the page scan found the pages it must",
    pages.includes("/patient/login") && pages.includes("/sessions/[id]/room") && pages.includes("/"),
    `${String(pages.length)} page files read from app/`,
  );

  /* ------------------------------ H · every step and edge id resolves */

  /*
   * The board, the record and the coverage map all name steps by id. An id that
   * is not defined is a wait nobody can satisfy.
   */
  const defined = new Set<string>();
  for (const d of files.filter((f) => f.name === "03-THE-FLOWS.md" || f.name === "04-THE-EDGES.md")) {
    for (const m of d.body.matchAll(/^\|\s*`?([A-Z]{2}\d+(?:\.\d+)?)`?\s*\|/gm)) defined.add(m[1]!);
  }
  const ID = /`([A-Z]{2}\d+(?:\.\d+)?)`/g;
  const dangling_ids: string[] = [];
  for (const d of files) {
    for (const [n, line] of lines(d)) {
      for (const m of line.matchAll(ID)) {
        if (/^(PA|TH|CL|CO|AD|PT|WB|PE|TE|CE|EE|AE|ME)/.test(m[1]!) && !defined.has(m[1]!)) {
          dangling_ids.push(`${d.name}:${String(n)} ${m[1]!}`);
        }
      }
    }
  }
  check(
    "🔴 every step or edge id a document names is defined in 03-THE-FLOWS.md or 04-THE-EDGES.md",
    defined.size > 50 && dangling_ids.length === 0,
    dangling_ids.length === 0 ? `${String(defined.size)} ids defined, every reference resolves` : dangling_ids.slice(0, 8).join("; "),
  );

  /* ------------------------------ E · nothing tells the run production is barred */

  /*
   * 🔴 THE LANDMINE CLASS, AND THE ONLY ONE HERE A SCAN NEARLY MISSED.
   *
   * `00-START-HERE.md` rule 4 read "Nothing runs against production, ever" in a
   * runbook for a run that happens entirely on production, and `06-AGEING.md`
   * said the ageing script refuses production when the code allows it. Both are
   * flat denials of the run's own shape, and an agent that believes either one
   * either stops or invents a way around the guard.
   *
   * Phrases rather than sentiment, because a regex cannot read. These are the
   * exact shapes that were there.
   */
  const absolute = [
    /nothing runs against production,? ever/i,
    /never runs? against production/i,
    /the run has its own branch/i,
  ];
  /*
   * 🔴 "REFUSES PRODUCTION BY NAME" IS TRUE AND MUST STAY SAYABLE.
   *
   * Every write script does refuse production, and saying so is half of why the
   * arrangement is trustworthy. It becomes a landmine only when the sentence
   * stops there, because then it reads as "and therefore this run cannot
   * happen". `06-AGEING.md` said exactly that about a script whose code passes
   * `productionIsAllowed: true`.
   *
   * So the rule is not "do not say it". It is "say what opens it", within a
   * line either side, which is where a reader's eye already is.
   */
  const refusal = /refuses? production by name/i;
  const door = /on:production|I_MEAN_PRODUCTION|allow-list|opens the door|unless the caller|typed override/i;

  const found: string[] = [];
  for (const d of files) {
    if (d.name === LESSONS) continue;
    const ls = lines(d);
    for (const [n, line] of ls) {
      for (const rx of absolute) {
        if (rx.test(line)) found.push(`${d.name}:${String(n)} "${line.trim().slice(0, 60)}"`);
      }
      if (refusal.test(line)) {
        const near = [ls[n - 2]?.[1] ?? "", line, ls[n]?.[1] ?? "", ls[n + 1]?.[1] ?? ""].join(" ");
        if (!door.test(near)) {
          found.push(`${d.name}:${String(n)} refusal with no door named`);
        }
      }
    }
  }

  check(
    "🔴 no document tells the run that production is off limits, because it is the whole run",
    found.length === 0,
    found.length === 0
      ? "no denial of the run's own shape in any document"
      : `${String(found.length)}:\n       ` + found.slice(0, 5).join("\n       "),
  );

  check(
    "🔴 CONTROL …and the same scan catches the sentence it bans",
    absolute.some((rx) => rx.test("Nothing runs against production, ever.")) &&
      refusal.test("Refuse production by name.") &&
      !door.test("Refuse production by name."),
    "watched the matcher find the exact rule that was in 00-START-HERE.md",
  );

  /* ------------------------------------- F · history lives in one file, not all */

  /*
   * A runbook that opens with what it used to say makes the reader carry a
   * correction before they can act. The history is worth keeping and it belongs
   * in one place the run reads once.
   */
  const retro = [
    /an earlier version/i, /this document (said|named|told|implied)/i,
    /used to (say|read|be|call)/i, /THIS TABLE USED TO BE WRONG/i,
    /until somebody (tried|listed|looked)/i,
  ];
  const archaeology: string[] = [];
  for (const d of files) {
    if (d.name === LESSONS) continue;
    for (const [n, line] of lines(d)) {
      for (const rx of retro) if (rx.test(line)) archaeology.push(`${d.name}:${String(n)}`);
    }
  }

  check(
    `🔴 the run's instructions carry no archaeology, which lives in ${LESSONS}`,
    archaeology.length === 0,
    archaeology.length === 0
      ? "every document states what is true, not what it used to say"
      : `${String(archaeology.length)} passage(s): ${archaeology.slice(0, 8).join(", ")}` +
        (archaeology.length > 8 ? " …" : ""),
  );

  check(
    `🔴 CONTROL …and ${LESSONS} exists to hold it`,
    present.has(LESSONS),
    present.has(LESSONS)
      ? `${LESSONS} is present, so the history has somewhere to be`
      : `🔴 ${LESSONS} is missing. Banning archaeology without a home for it deletes it`,
  );

  finish("simulation runbook");
}

main();
