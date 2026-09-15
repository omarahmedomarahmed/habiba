/**
 * 🔴 EVERY `verify:*` SCRIPT, IN ONE PASS, FOR THE THIRD TIME THIS LESSON COST US.
 *
 *   npm run verifiers
 *
 * ## WHY THIS EXISTS, AND WHY IT IS THE THIRD FILE OF ITS KIND
 *
 * `npm run gates` ran twelve checks. `package.json` wires **eighty-one**
 * `verify:*` scripts. So seventy-nine of them were reachable only by somebody
 * typing their exact name, and two of those seventy-nine had been RED for two
 * sprints:
 *
 *   - `verify:sprint1` asserted the tier prices as the literal `"9900,17900"`
 *     and went red the day of the reprice
 *   - `verify:synthetic` reports fixture identities on whatever database it is
 *     pointed at, and prints DO NOT COMMIT ANY OPERATOR FRAME when it finds
 *     them
 *
 * This is the same defect `scripts/suites.ts` was written to close a few hours
 * earlier, one level down. H20's quiet half: **an unrun gate is a gate nobody
 * reads**, and it does not matter how good the gate is.
 *
 * ## IT DISCOVERS THEM, IT DOES NOT LIST THEM
 *
 * From `package.json`, so a verifier added next sprint is run by a file nobody
 * edited. A hand-written list is a thing somebody forgets on the one sprint it
 * mattered, which is precisely how seventy-nine of these ended up unreachable.
 *
 * ## WHAT IT SKIPS, AND WHY EACH ONE
 *
 * Only two kinds, both named rather than pattern-matched:
 *
 *   - the twelve already in `npm run gates`, so the pass does not run them
 *     twice and a failure is reported once, in the place people look
 *   - `verify:synthetic`, because it is a property of a DATABASE rather than of
 *     the code. It is RIGHT to fail on the dev branch, which is full of
 *     fixtures called Mansour and Ellis, and it is run for real against the
 *     simulation branch immediately before any operator frame is committed.
 *     Running it here would teach people that a red line is normal, which is
 *     the exact habit H20 exists to prevent.
 *
 * ## IT NEEDS A DATABASE
 *
 * Most of these read one. Point `DATABASE_URL` at the dev branch. They are
 * read-only with one exception the pass names, and none of them writes to a
 * database it was not pointed at.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Already in `npm run gates`. Reported there, not twice. */
const IN_GATES = new Set([
  "prose",
  "verify:claims",
  "verify:principals",
  "verify:sprint37l",
  "verify:boundary",
  "smoke",
  "verify:finance",
  "verify:plan",
  "verify:rail",
  "verify:entitlement",
  "verify:board",
  "suites",
]);

/**
 * 🔴 A property of the DATABASE, not of the code. See the header: it is correct
 * for this to be red on a branch full of fixtures, and it is run for real
 * against the simulation branch before a single operator frame is committed.
 */
const DATABASE_SHAPED = new Set(["verify:synthetic"]);

function verifierNames(): string[] {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  return Object.keys(pkg.scripts)
    .filter((name) => name.startsWith("verify:"))
    .filter((name) => !IN_GATES.has(name) && !DATABASE_SHAPED.has(name))
    .sort();
}

function main() {
  const names = verifierNames();
  console.log(`\n🔴 Every verifier that is not already in npm run gates. ${names.length} of them.\n`);

  const failed: { name: string; detail: string[] }[] = [];

  for (const name of names) {
    const proc = spawnSync("npm", ["run", "--silent", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
    });

    const out = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
    const ok = proc.status === 0;

    if (!ok) {
      failed.push({
        name,
        detail: out
          .split("\n")
          .filter((line) => /^\s*FAIL|FAILED|Error:|error:/.test(line))
          .slice(0, 6)
          .map((line) => line.trim()),
      });
    }

    /* One character each, because eighty lines of "ok" is eighty lines nobody reads. */
    process.stdout.write(ok ? "." : "F");
  }

  console.log("\n");

  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`  FAIL  ${f.name}`);
      for (const line of f.detail) console.log(`          ${line}`);
    }
    console.log(`\n🔴 ${failed.length} of ${names.length} verifiers failed.\n`);
    process.exit(1);
  }

  console.log(`  all ${names.length} verifiers pass.\n`);
}

main();
