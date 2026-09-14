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
] as const;

function main() {
  console.log("\n🔴 The gates that span the whole product, in one pass.\n");

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
