/**
 * 🔴 EVERY UNIT SUITE, IN ONE PASS, BECAUSE TWO OF THEM WERE RED FOR TWO SPRINTS.
 *
 *   npm run suites
 *
 * ## WHY THIS EXISTS
 *
 * Sprint 75 repriced the product. `tests/seats.test.ts` went **7 red of 12** and
 * `tests/safety.test.ts` went **1 red of 55**, every failure an assertion holding
 * a price the product no longer charges: $179 for two seats, $99 for the solo
 * plan, a band boundary at three.
 *
 * They stayed red across every commit of two sprints, and nothing printed it.
 * `npm run gates` runs eleven verifiers and none of the thirty unit suites, so
 * the only way to see the failure was to type the one script nobody had a reason
 * to type.
 *
 * That is H20 in its quieter form. The loud version is *a known-failing gate is
 * a gate nobody reads*; this is **an unrun gate is a gate nobody reads either**,
 * and it is the version that costs a sprint rather than an afternoon.
 *
 * ## WHAT IT DOES
 *
 * Discovers every `test*` script in `package.json` rather than listing them, so
 * a suite added next sprint is run by a file nobody edited. That is the same
 * rule `scripts/age.ts` follows about columns and for the same reason: a list is
 * a thing somebody forgets to update.
 *
 * `test:e2e` is excluded by name. It drives a browser against a running server
 * and belongs to `npm run smoke`, not here.
 *
 * ## IT RUNS ALL OF THEM AND THEN REPORTS
 *
 * Not fail fast. A pass that stops at the first failure teaches somebody to fix
 * one thing and re-run five times, which is the difference between a gate people
 * run and a gate people avoid.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Drives a browser against a running server. `npm run smoke` owns that. */
const NOT_HERE = new Set(["test:e2e"]);

type Result = { name: string; ok: boolean; pass: number; fail: number; detail: string[] };

function suiteNames(): string[] {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  return Object.keys(pkg.scripts)
    .filter((name) => (name === "test" || name.startsWith("test:")) && !NOT_HERE.has(name))
    .sort();
}

function run(name: string): Result {
  const proc = spawnSync("npm", ["run", "--silent", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const out = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
  const num = (re: RegExp) => Number(out.match(re)?.[1] ?? "0");

  /*
   * 🔴 THE EXIT CODE IS NOT ENOUGH ON ITS OWN. A suite that fails to START
   * exits non-zero with no TAP counts at all, and a suite that reports
   * `# fail 0` may still have crashed before the first test ran. Both are
   * failures and both must be told apart from a real pass, which is why the
   * counts are read as well as the status.
   */
  const pass = num(/^# pass (\d+)/m);
  const fail = num(/^# fail (\d+)/m);
  const ok = proc.status === 0 && fail === 0 && pass > 0;

  const detail = out
    .split("\n")
    .filter((line) => /^not ok |^\s+(expected|actual|operator):|Cannot find|SyntaxError|Error:/.test(line))
    .slice(0, 8)
    .map((line) => line.trim());

  return { name, ok, pass, fail, detail };
}

function main() {
  const names = suiteNames();
  console.log(`\n🔴 Every unit suite, in one pass. ${names.length} of them.\n`);

  const results = names.map(run);
  let pass = 0;
  let fail = 0;

  for (const r of results) {
    pass += r.pass;
    fail += r.fail;
    const counts = r.pass > 0 || r.fail > 0 ? `${r.pass} pass, ${r.fail} fail` : "no tests ran";
    console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(20)} ${counts}`);
    for (const line of r.detail) console.log(`          ${line}`);
  }

  const broken = results.filter((r) => !r.ok);
  if (broken.length > 0) {
    console.log(`\n🔴 ${broken.length} of ${results.length} suites failed: ${broken.map((r) => r.name).join(", ")}\n`);
    process.exit(1);
  }

  console.log(`\n  all ${results.length} suites pass. ${pass} assertions, ${fail} failures.\n`);
}

main();
