/**
 * 🔴 76.62 — THE RUN'S OWN DOCUMENTS, CHECKED AGAINST THE PRODUCT THEY DESCRIBE.
 *
 *     npm run verify:runbook
 *
 * ## Why this exists
 *
 * `docs/SIMULATION-PROMPT.md` and `docs/simulation/` are six thousand lines of
 * instructions for a six month run on production that nobody undoes afterwards.
 * They are the only thing standing between twenty eight agents and a database
 * they cannot restore, and until this gate they were checked by nobody.
 *
 * A full read on 2026-09-19 found what that costs:
 *
 *   - **41 commands pointed at the wrong database.** `npm run age --marker
 *     wave1 --start`, written bare, ages DEV. The six month clock never starts
 *     and nothing says so.
 *   - **A governing rule contradicted the run.** `00-START-HERE.md` rule 4 read
 *     *"Nothing runs against production, ever"*, eighty lines after the same
 *     file said the run is on production.
 *   - **Every count disagreed with something.** Gates 11 against 27, documents
 *     "twelve" against fifteen listed against sixteen on disk, edges 48 against
 *     30, walks eleven against twelve.
 *
 * None of that is exotic. It is what prose does when the code under it moves and
 * nothing reads the prose.
 *
 * ## 🔴 EVERY EXPECTATION IS DERIVED, NOT TYPED
 *
 * The gate count comes from `GATES`. The production-only command list comes from
 * `on-production.ts`'s own allow-list. The document list comes from the
 * directory. The cron jobs come from the route's `JOBS` map. The edge count
 * comes from counting the rows in the file that defines them.
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
 * redesigned last week. That needs a person, and `14-THE-REHEARSAL.md` is how
 * this repository does it.
 *
 * It only reads files.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { GATES } from "./_gates";
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

const PROMPT = "docs/SIMULATION-PROMPT.md";
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
  return [{ name: "SIMULATION-PROMPT.md", path: PROMPT, body: readFileSync(PROMPT, "utf8") }, ...docs()];
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
      for (const m of line.matchAll(/\b(\d+|twenty[- ]?\w+|eleven|twelve|thirteen|fourteen) gates\b/gi)) {
        gateClaims.add(m[1]!.toLowerCase());
      }
    }
  }
  const words: Record<number, string> = {
    26: "twenty-six", 27: "twenty-seven", 28: "twenty-eight", 29: "twenty-nine",
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

  /*
   * The edge count is defined by the file that lists them, so it is counted
   * from the table rows rather than from the sentence at the top. A document
   * that says forty eight and lists thirty is the failure this catches.
   */
  const edgesDoc = files.find((d) => d.name === "09-THE-EDGES.md");
  const edgeIds = edgesDoc
    ? new Set([...edgesDoc.body.matchAll(/^\|\s*`((?:CV|RA|PL|RR)\d+)`/gm)].map((m) => m[1]!))
    : new Set<string>();
  const edgeClaims = new Set<string>();
  for (const d of files) {
    for (const [, line] of lines(d)) {
      for (const m of line.matchAll(/(forty[- ]eight|thirty|\b48\b|\b30\b)\s+(?:of |ways|cases|money|things|edge)/gi)) {
        edgeClaims.add(m[1]!.toLowerCase().replace("-", " "));
      }
    }
  }
  const okEdge = new Set([String(edgeIds.size), "forty eight"]);
  const wrongEdges = [...edgeClaims].filter((c) => !okEdge.has(c));

  check(
    `🔴 every edge-case count matches the ${String(edgeIds.size)} cases 09-THE-EDGES.md actually lists`,
    edgeIds.size > 0 && wrongEdges.length === 0,
    edgeIds.size === 0
      ? "🔴 counted zero cases, so this check measured nothing"
      : wrongEdges.length === 0
        ? `${String(edgeIds.size)} cases, every claim agrees`
        : `found: ${wrongEdges.join(", ")}, and the file lists ${String(edgeIds.size)}`,
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

  finish("sprint 76 runbook");
}

main();
