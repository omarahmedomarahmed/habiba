/**
 * 🔴 80.1 — A PROMISE NOBODY WALKS IS A FAILING GATE, NOT A PARAGRAPH.
 *
 *     npm run verify:prove
 *
 * ## What this is holding
 *
 * `scripts/_value-statements.ts` is twenty-five things this product promises.
 * `docs/PROVE-IT.md` is eight people walking them on real devices against a
 * real database. The obvious way for those two to come apart is the quiet one:
 * a promise is added to the array, the walk is not extended, and the document
 * still reads as complete because nothing in it is wrong.
 *
 * That is the same failure `verify:runbook` was written after, where every
 * count in the simulation documents disagreed with something and none of them
 * looked broken. The fix there was to derive every expectation from the code,
 * and it is the fix here.
 *
 * ## 🔴 AND THE GENERATED HALF IS COMPARED, NOT TRUSTED
 *
 * `docs/VALUE-STATEMENTS.md` is written by `npm run prove`. A generated file
 * that nobody regenerates is a hand-maintained file with a misleading banner on
 * it, which is worse than one that admits it. So this rebuilds the document in
 * memory and fails if what is on disk differs.
 */
import { readFileSync } from "node:fs";

import { VALUE_STATEMENTS_PATH, document } from "./_prove-doc";
import {
  AUDIENCES,
  SCENARIOS,
  STATEMENT_IDS,
  TUNING,
  VALUE_STATEMENTS,
  type Audience,
} from "./_value-statements";
import { honestyProblems } from "../lib/content/honesty";
import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

const WALK = "docs/PROVE-IT.md";

function main(): void {
  /*
   * 🔴 `readSource`, NOT `readFileSync`. T1 in `docs/TRAPS.md`: a file that
   * EXPLAINS a rule reads, to a naive scan, exactly like one that follows it.
   * These are markdown rather than source so there are no comments to strip,
   * but the habit is the thing being kept: five gates have broken this rule and
   * `verify:traps` C205 refuses a literal path inside `readFileSync` outright.
   */
  const walk = readSource(WALK);

  /* ------------------------------------------ every promise is walked -- */

  /*
   * 🔴 THE ID HAS TO APPEAR AS A WHOLE WORD.
   *
   * `P1` is a substring of nothing here, but `C1` is a substring of `C12` and
   * `A2` of `A25`, and a naive `includes` would report a promise as walked
   * because a different one was. Found by writing the naive version first and
   * asking which ids it could not tell apart.
   */
  const unwalked = STATEMENT_IDS.filter(
    (id) => !new RegExp(`\\b${id}\\b`).test(walk),
  );

  check(
    `🔴 all ${String(STATEMENT_IDS.length)} promises are walked in ${WALK}`,
    unwalked.length === 0,
    unwalked.length > 0 ? `never walked: ${unwalked.join(", ")}` : "every one of them",
  );

  /*
   * 🔴 CONTROL — the detector has to be able to say the other word.
   *
   * A regex that matched everything would pass the check above for ever while
   * the document said nothing. An id that is deliberately not in any of these
   * files proves the scan can come back empty.
   */
  check(
    "🔴 CONTROL the scan can fail to find one",
    !new RegExp("\\bZ9\\b").test(walk),
    "a promise that does not exist is not reported as walked",
  );

  /* -------------------------------------- every position is reachable -- */

  const missingSections = SCENARIOS.filter(
    (s) => !new RegExp(`--scenario=${s.name}\\b`).test(walk),
  );
  check(
    "every position has a section that says how to seed it",
    missingSections.length === 0,
    missingSections.length > 0
      ? `no seed command for: ${missingSections.map((s) => s.name).join(", ")}`
      : `${String(SCENARIOS.length)} positions`,
  );

  /*
   * 🔴 AND THE VERIFIER IS NAMED BESIDE EVERY SEED.
   *
   * Reseeding without running `verify:demo` is how a position that failed to
   * apply gets walked as though it had: the flag is misspelled, the seed falls
   * back to nothing, and the walk below it describes a database nobody is
   * looking at. The command is the only thing that proves the reseed did what
   * was asked, so the document must carry it every time it carries the other.
   */
  const unverified = SCENARIOS.filter(
    (s) => !new RegExp(`verify:demo -- --scenario=${s.name}\\b`).test(walk),
  );
  check(
    "and every seed command is followed by the one that certifies it",
    unverified.length === 0,
    unverified.length > 0
      ? `seeded but never verified: ${unverified.map((s) => s.name).join(", ")}`
      : "all five",
  );

  /* --------------------------------- a position cannot promise a ghost -- */

  const ghosts = SCENARIOS.flatMap((s) =>
    s.proves.filter((id) => !STATEMENT_IDS.includes(id)).map((id) => `${s.name}:${id}`),
  );
  check(
    "no position claims to prove a promise that does not exist",
    ghosts.length === 0,
    ghosts.length > 0 ? ghosts.join(" · ") : "every id resolves",
  );

  /*
   * 🔴 AND EVERY PROMISE IS CLAIMED BY AT LEAST ONE POSITION.
   *
   * The check at the top says a promise appears in the walk. This says a
   * SEEDED position is responsible for it, which is a different fact: a promise
   * mentioned in the preamble and attached to no position is one nobody has a
   * database state for.
   */
  const claimed = new Set(SCENARIOS.flatMap((s) => s.proves));
  const orphans = STATEMENT_IDS.filter((id) => !claimed.has(id));
  check(
    "every promise belongs to a position somebody can seed",
    orphans.length === 0,
    orphans.length > 0 ? `claimed by no position: ${orphans.join(", ")}` : "all claimed",
  );

  /* -------------------------------------------- five per audience, and -- */

  const byAudience = new Map<Audience, number>();
  for (const s of VALUE_STATEMENTS) {
    byAudience.set(s.audience, (byAudience.get(s.audience) ?? 0) + 1);
  }
  const thin = AUDIENCES.filter((a) => (byAudience.get(a.id) ?? 0) < 3);
  check(
    "no audience is promised less than three things",
    thin.length === 0,
    thin.length > 0
      ? `${thin.map((a) => `${a.id} has ${String(byAudience.get(a.id) ?? 0)}`).join(" · ")}`
      : AUDIENCES.map((a) => `${a.id} ${String(byAudience.get(a.id) ?? 0)}`).join(" · "),
  );

  /* ------------------------------------------- the two refused claims -- */

  /*
   * 🔴 THE PROMISES GO THROUGH THE SAME CHECKER THE PUBLIC SITE DOES.
   *
   * `lib/content/honesty.ts` refuses two claim shapes at the door: that paid
   * sessions cover our fee, and any forecast of what a clinician will earn.
   * `savePage` stops an admin publishing one and `verify:sprint28` scans the
   * published rows.
   *
   * This file is neither. It is a list of promises written by hand, handed to
   * eight people, and pointed at by a document that tells them to go and prove
   * each one. A claim that could not be published is a claim that must not be
   * tested as though it were ours, so it goes through the same two patterns.
   */
  const dishonest = VALUE_STATEMENTS.flatMap((s) =>
    honestyProblems(s.id, `${s.says} ${s.proof}`),
  );
  check(
    "🔴 no promise makes a claim the product refuses to publish",
    dishonest.length === 0,
    dishonest.length > 0
      ? dishonest.map((h) => `${h.where} ${h.rule}: ${h.text}`).join(" · ")
      : "the fee claim and the earnings forecast are both absent",
  );

  check(
    "🔴 CONTROL the honesty checker still catches one",
    honestyProblems("control", "Paid sessions cover our fee and you will earn more.").length === 2,
    "planted, caught on both rules, and not stored",
  );

  /* ------------------------------------ the positions differ in money -- */

  /*
   * A set of five positions that were all funded and priced identically is
   * five copies of one position with different names. The walk would read
   * correctly and prove one thing five times.
   */
  const shapes = new Set(
    SCENARIOS.map((s) => {
      const t = TUNING[s.name];
      return `${String(t.coverageBps)}/${String(t.topUpCreditCents)}/${String(t.enrolTheSecondPatient)}`;
    }),
  );
  check(
    "the positions are not five copies of one",
    shapes.size >= 3,
    `${String(shapes.size)} distinct money shapes across ${String(SCENARIOS.length)} positions`,
  );

  /* ------------------------------------------ the generated half is current -- */

  /*
   * 🔴 AND THIS CHECK WAS UNFALSIFIABLE FOR ONE COMMIT, which is the reason
   * `_prove-doc.ts` exists as a file with no `main()` in it.
   *
   * The builder and the writer were one script, guarded by
   * `process.argv[1]?.endsWith("prove.ts")`. `scripts/verify-prove.ts` also
   * ends with `prove.ts`, so importing `document()` REWROTE the file a moment
   * before this line read it back, and it reported `current` on anything.
   *
   * §6: proved by planting the offender. A line deleted from the document by
   * hand now reads `STALE, run \`npm run prove\`` and the gate goes red, which
   * it could not do before the split.
   */
  const onDisk = readFileSync(VALUE_STATEMENTS_PATH, "utf8");
  const fresh = document().join("\n");
  check(
    `${VALUE_STATEMENTS_PATH} is what \`npm run prove\` would write`,
    onDisk === fresh,
    onDisk === fresh ? "current" : "STALE, run `npm run prove`",
  );

  /* ---------------------------------------- and the walk admits its limits -- */

  /*
   * 🔴 A TEST PLAN THAT DOES NOT SAY WHAT IT MISSES IS READ AS COVERING
   * EVERYTHING.
   *
   * Every person in this walk is seeded, with history behind them and a
   * password somebody wrote down. It proves nothing about a stranger signing
   * up, nothing about Arabic or a small phone, and nothing about what the
   * screen says when something fails. A green report that did not say so would
   * be read as a launch decision.
   */
  check(
    "the walk says what it cannot prove",
    /cannot prove/i.test(walk) && /Cycle 5/.test(walk) && /Cycle 9/.test(walk),
    "sign-up, Arabic and deliberate failure are named as out of scope",
  );

  finish("prove");
}

main();
