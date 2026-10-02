/**
 * The checks GitHub runs on every pull request, with no database and no secret.
 *
 *     npm run ci
 *
 * It is the static half of `npm run gates`: typecheck, every unit suite that
 * needs no database, the prose ratchet, and every verifier that reads only the
 * repository. The database suites run in the second CI job through
 * `npm run ci:db`, against a throwaway Postgres. The rest (the dev database, a
 * running build, the three environments) still runs locally through
 * `npm run gates` before a deploy.
 *
 * Both lists live in `scripts/_ci-lists.ts`, written down rather than guessed:
 * a suite or verifier added later is run here by default, so a new
 * database-bound one fails in CI until it is named there.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { NEEDS_DATABASE_SUITES, STATIC_VERIFIERS } from "./_ci-lists";

const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> })
  .scripts;

const suites = Object.keys(scripts)
  .filter((name) => (name === "test" || name.startsWith("test:")) && !NEEDS_DATABASE_SUITES.has(name))
  .sort();

const steps: string[] = ["typecheck", ...suites, "prose", ...STATIC_VERIFIERS];

const missing = STATIC_VERIFIERS.filter((name) => !(name in scripts));
if (missing.length > 0) {
  console.error(`ci: these verifiers are listed but not in package.json: ${missing.join(", ")}`);
  process.exit(1);
}

const failed: string[] = [];
for (const step of steps) {
  const started = Date.now();
  const run = spawnSync("npm", ["run", "-s", step], { encoding: "utf8", env: process.env });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (run.status === 0) {
    console.log(`  ok    ${step} (${seconds}s)`);
  } else {
    failed.push(step);
    console.log(`  FAIL  ${step} (${seconds}s)`);
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split("\n");
    for (const line of output.filter((l) => /FAIL|not ok|error/i.test(l)).slice(0, 20)) {
      console.log(`          ${line.trim()}`);
    }
  }
}

console.log(
  failed.length === 0
    ? `\nci: all ${String(steps.length)} checks pass.`
    : `\nci: ${String(failed.length)} of ${String(steps.length)} failed: ${failed.join(", ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
