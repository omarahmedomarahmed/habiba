/**
 * 🔴 65.24 — ONE PASS, SO A PAGE CANNOT BE PRETTIER AND LESS TRUTHFUL AT THE SAME TIME.
 *
 *   npm run gates
 *
 * > *The sweep, `verify:claims`, `verify:principals` and the Arabic render all run in
 * > the same pass, so a page cannot be prettier and less truthful at the same time.*
 *
 * ## 🔴 WHY THIS TICKET IS NOT BUREAUCRACY, AND THE EVIDENCE IS IN THIS SPRINT
 *
 * Sprint 65 ran `verify:sprint37l` for the first time since sprint 52 and found every
 * surface above its recorded floor: admin 459 against 420, shared 113 against 80, and
 * four English literals on a patient screen. Fifteen sprints had each run their own
 * verifier, and the gate that spans all of them was run by none of them.
 *
 * That is C182 landing on the instrument built to prevent C182, and H20 in one sentence:
 * *a known-failing gate is a gate nobody reads*, to which this sprint adds the quieter
 * version — **an unrun gate is a gate nobody reads either.** A verifier per sprint is a
 * verifier per author. This is the pass that belongs to the product.
 *
 * ## 🔴 WHAT IS IN IT, AND WHY THESE FOUR
 *
 * Each one catches a different way a redesign can be a regression:
 *
 *   - **prose** — the screen got shorter. That is the work.
 *   - **claims** — and it did not get shorter by dropping a claim that has to survive
 *     `verify:claims`. A claim rendered as a graphic is still a claim.
 *   - **principals** — and no component moved into a place that lets a principal read
 *     something it must not. A prettier screen that imports one more module is exactly
 *     how 58.6's matrix gets quietly widened.
 *   - **i18n (`verify:sprint37l`)** — and the Arabic half still exists. A new component
 *     is the commonest way English re-enters a translated product, which is what this
 *     sprint's own finding was.
 *
 * ## 🔴 IT RUNS ALL FOUR AND THEN REPORTS
 *
 * Not fail-fast. A pass that stops at the first failure teaches somebody to fix one
 * thing and re-run four times; this one tells them everything that is wrong in one go,
 * which is the difference between a gate people run and a gate people avoid.
 */
import { spawnSync } from "node:child_process";

const GATES = [
  { name: "prose", script: "prose", why: "the screens got shorter" },
  { name: "claims", script: "verify:claims", why: "and no claim was dropped to do it" },
  {
    name: "principals",
    script: "verify:principals",
    why: "and nothing moved into a place it must not reach",
  },
  {
    name: "i18n",
    script: "verify:sprint37l",
    why: "and the Arabic half still exists",
  },
  /*
   * 🔴 C353 / C354 — the two gates sprint 69 had to write, and why they belong
   * in the pass that belongs to the product rather than to a sprint.
   *
   * `/pricing` answered 500 to every visitor for seven sprints. Six lines
   * passed a function to a client component, which is a runtime rule that
   * `tsc` cannot see, that `npm run build` never rendered, and that sixty
   * sprint verifiers had no reason to look for. The one gate that DID see it,
   * `verify:sprint21r`, reported it red and the red line was explained away
   * every time it was read.
   *
   *   - **boundary** — nothing hands a function across the client boundary.
   *     Cheap, source-only, and catches that defect's exact shape.
   *   - **renders** — and the stupid question nobody was asking: does every
   *     public page actually come back 200 with words on it. Needs a build, and
   *     says so rather than passing when there is not one.
   */
  {
    name: "boundary",
    script: "verify:boundary",
    why: "and nothing hands a function across the client boundary",
  },
  {
    name: "renders",
    script: "smoke",
    why: "and every public page still answers with a page",
  },
  /*
   * 🔴 C360 — the forecast still cannot charge anybody.
   *
   * It belongs in the product's pass rather than in sprint 71's, because the
   * property it holds is about the module graph and the module graph is what
   * next sprint changes. One import added to `lib/finance/` in six months turns
   * a board pack into a billing system, and nothing else in this repository
   * would notice.
   */
  {
    name: "finance",
    script: "verify:finance",
    why: "and the forecast still cannot move a price",
  },
  /*
   * 🔴 The plan is a different gate from the forecast, and both belong here.
   *
   * `verify:finance` guards the ENGINE: pure, reconciling, unable to bill. This
   * guards the PLAN: that the offer modelled is the offer somebody intends to
   * run, that a cohort is priced off its own age, and that every guess still
   * says it is one. An unlabelled number is how a plan becomes evidence for
   * something nobody measured.
   */
  {
    name: "plan",
    script: "verify:plan",
    why: "and the plan still says which numbers are guesses",
  },
  /*
   * 🔴 The Egyptian rail has no processor behind it. No webhook confirms the
   * money, no chargeback reverses it, and the row in `manual_payments` is the
   * only record that anybody checked anything. That makes its invariants the
   * kind that belong in the product's own pass rather than one sprint's.
   */
  {
    name: "rail",
    script: "verify:rail",
    why: "and nothing is granted before a person confirms it",
  },
  /*
   * 🔴 76.20 — AND THE RAIL HAS A BANK ACCOUNT TO POINT AT, which is DATA.
   *
   * Every other gate in this pass reads code, and settings are not code.
   * Production ran for weeks holding the pre-sprint-26 prices with all fourteen
   * of these green, because nothing in the pass had ever asked a database what
   * it was actually configured with. It was found by accident.
   *
   * The failing condition is deliberately narrow: no transfer fields, or a
   * missing country. Those are the two that stop the product working. A stale
   * price prints loudly and does not fail, because an operator changing a price
   * is somebody doing their job and a gate that cannot tell the two apart is
   * one people switch off.
   *
   * 🔴 IT READS AND NEVER WRITES, so it can be pointed at production, which is
   * the database that most needed asking.
   */
  {
    name: "settings",
    script: "settings:check",
    why: "and the rail it runs on has a bank account to point at",
  },
  /*
   * 🔴 THE ONE GATE IN THIS PASS THAT WRITES.
   *
   * Every other line above reads files. All three defects sprint 74 found in
   * the entitlement loop were true of the source and false of the database: an
   * idempotency that leaned on a unique index the code could not trigger, a
   * sort that handed back a due obligation in place of a paid one, and an
   * `ON CONFLICT` about to meet its first null. Nothing that reads source could
   * have seen any of them.
   *
   * It writes to a throwaway organisation, asserts what comes back, and deletes
   * it in a `finally`. `writesTo()` refuses production by name.
   */
  {
    name: "entitlement",
    script: "verify:entitlement",
    why: "and paying for a plan actually puts you on it",
  },
  /*
   * 🔴 The board is the screen the founders run the company from, and a
   * dashboard is the easiest thing in a product to get wrong in a way nobody
   * notices: a wrong number and a right number look identical. This runs all
   * nine of its queries against a real database, checks that none of them
   * writes, and checks the one error that describes a richer company than we
   * have — counting invoiced money as collected.
   */
  {
    name: "board",
    script: "verify:board",
    why: "and the board a founder trusts is counting the right things",
  },
  /*
   * 🔴 THE THIRTY UNIT SUITES, AND THE REASON THEY ARE HERE IS EMBARRASSING.
   *
   * Sprint 75 repriced the product. `tests/seats.test.ts` went 7 red of 12 and
   * `tests/safety.test.ts` went 1 red of 55, every failure an assertion holding
   * a price the product no longer charges.
   *
   * They stayed red across two sprints of commits. Nothing printed it, because
   * this pass ran eleven verifiers and none of the thirty suites, so the only
   * way to see the failure was to type the one script nobody had a reason to
   * type.
   *
   * That is the quiet half of H20. The loud version is *a known-failing gate is
   * a gate nobody reads*; this is **an unrun gate is a gate nobody reads
   * either**, and it is the version that costs a sprint rather than an
   * afternoon. `scripts/suites.ts` discovers them from `package.json` rather
   * than listing them, so a suite added next sprint is run by a file nobody
   * edited.
   */
  {
    name: "suites",
    script: "suites",
    why: "and all thirty unit suites still agree with what we charge",
  },
  /*
   * 🔴 AND THE SEVENTY-NINE VERIFIERS THIS PASS WAS NOT RUNNING.
   *
   * `package.json` wires eighty-one `verify:*` scripts. This pass ran twelve.
   * So seventy-nine were reachable only by somebody typing their exact name,
   * and `verify:sprint1` had been RED among them since the reprice, asserting
   * the tier prices as the literal `"9900,17900"`.
   *
   * That is the third time in one day the same lesson arrived: the seats suite,
   * the safety suite, and now a whole shelf of sprint verifiers. **An unrun
   * gate is a gate nobody reads**, and the fix is never "remember to run it".
   * `scripts/verifiers.ts` discovers them from `package.json` and skips exactly
   * two things by name: the twelve already here, and `verify:synthetic`, which
   * is a property of a database rather than of the code and is correctly red on
   * a branch full of fixtures.
   */
  /*
   * 🔴 76.7 — every price a person reads can say what it is in pounds.
   *
   * It belongs in the product's own pass rather than a sprint's, because the
   * property is about every screen at once and every sprint adds screens. One
   * table shipped with a bare figure is a price with no answer, met by the one
   * person who had the question.
   */
  {
    name: "money",
    script: "verify:money",
    why: "and every dollar figure can say what it is in pounds",
  },
  {
    name: "verifiers",
    script: "verifiers",
    why: "and the seventy-nine sprint verifiers nobody was running",
  },
] as const;

/**
 * 🔴 76.2 — SAY WHICH DATABASE THIS IS BEFORE RUNNING A SINGLE GATE.
 *
 * ## The hour this cost
 *
 * Six of the thirteen gates need a database. Run without one they reported
 * `FAIL`, and the output underneath was a stack trace ending in `ECONNREFUSED
 * 127.0.0.1:443` — which reads exactly like a product defect and is nothing of
 * the kind. The gates were fine. The shell had no `DATABASE_URL`, because
 * nothing loaded `.env.local` for a plain node script, and six red lines are
 * indistinguishable from six broken things.
 *
 * Every script now loads `.env.local` through `--env-file-if-exists`, so the
 * common case simply works. This is the other half: when it still cannot work,
 * say so in one line at the top instead of thirteen lines of red at the bottom.
 *
 * 🔴 IT PRINTS THE HOST AND NEVER THE CREDENTIALS. Which database a gate ran
 * against is the first thing anybody asks when a result surprises them, and it
 * is the one fact this output never carried.
 */
function database(): { label: string; warn: string | null } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return {
      label: "none",
      warn:
        "No DATABASE_URL. Six gates need one and will report FAIL for that reason alone.\n" +
        "     Put it in .env.local, which every script in this repository now reads by itself.",
    };
  }

  const host = url.replace(/^.*@/, "").split("/")[0] ?? "unreadable";
  if (host.includes("ep-wild-lake")) {
    return {
      label: host,
      warn:
        "That is the PRODUCTION endpoint. The gates that write will refuse it by name,\n" +
        "     which is correct and is not a defect. Point .env.local at your own branch.",
    };
  }

  return { label: host, warn: null };
}

function main() {
  console.log("\n🔴 The gates that span the whole product, in one pass.\n");

  const db = database();
  console.log(`  database: ${db.label}`);
  if (db.warn) console.log(`\n  ⚠️  ${db.warn}`);
  console.log("");

  const failed: string[] = [];

  for (const gate of GATES) {
    const run = spawnSync("npm", ["run", "--silent", gate.script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const ok = run.status === 0;
    if (!ok) failed.push(gate.name);

    console.log(`  ${ok ? "ok  " : "FAIL"}  ${gate.name.padEnd(12)} ${gate.why}`);

    /*
     * 🔴 A FAILURE PRINTS ITS OWN OUTPUT, because "principals FAILED" is a gate somebody
     * has to re-run by hand to learn anything from, and a gate somebody re-runs by hand
     * is one they stop running.
     */
    if (!ok) {
      const detail = `${run.stdout ?? ""}${run.stderr ?? ""}`
        .split("\n")
        .filter((line) => /FAIL|Error|error|✗|rose|UP from/.test(line))
        .slice(0, 12);
      for (const line of detail) console.log(`          ${line.trim()}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n🔴 ${failed.length} of ${GATES.length} failed: ${failed.join(", ")}\n`);
    process.exit(1);
  }

  console.log(`\n  all ${GATES.length} pass.\n`);
}

main();
