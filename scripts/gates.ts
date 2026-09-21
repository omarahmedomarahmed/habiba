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

import { GATES } from "./_gates";

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
    /*
     * 🔴 AND WHEN THERE IS MORE THAN FITS, IT SAYS SO AND KEEPS THE LAST LINE.
     *
     * The slice was twelve lines and silent about it, and `verifiers` is the
     * gate that made that expensive: it runs seventy-nine scripts and prints
     * "N of 79 verifiers failed" as its FINAL line, so the one number that
     * would reveal the truncation is the first thing the truncation removes.
     *
     * A pass reported four failing verifiers. Six had failed. The other two
     * were fixed, the pass re-run, and the two survivors appeared as if they
     * were new, which cost an hour of attributing them to work that had
     * nothing to do with them. A summary that quietly drops the part saying
     * how much it dropped is worse than no summary.
     *
     * So: the first eleven matching lines, then the LAST one, then a count of
     * what was left out. The last line of a checker's output is where it puts
     * its total, which is exactly the line worth keeping.
     */
    if (!ok) {
      const lines = `${run.stdout ?? ""}${run.stderr ?? ""}`
        .split("\n")
        .filter((line) => /FAIL|Error|error|✗|rose|UP from/.test(line))
        .map((line) => line.trim());

      const shown = lines.length <= 12 ? lines : [...lines.slice(0, 11), lines.at(-1)!];
      for (const line of shown) console.log(`          ${line}`);
      if (lines.length > 12) {
        console.log(
          `          … and ${String(lines.length - 12)} more, run \`npm run ${gate.script}\` for all of it`,
        );
      }
    }
  }

  if (failed.length > 0) {
    console.log(`\n🔴 ${failed.length} of ${GATES.length} failed: ${failed.join(", ")}\n`);
    process.exit(1);
  }

  console.log(`\n  all ${GATES.length} pass.\n`);
}

main();
