/**
 * The checks GitHub runs on every pull request, with no database and no secret.
 *
 *     npm run ci
 *
 * It is the static half of `npm run gates`: typecheck, every unit suite that
 * needs no database, the prose ratchet, and every verifier that reads only the
 * repository. The other half (the dev database, a running build, the three
 * environments) still runs locally through `npm run gates` before a deploy,
 * because it needs credentials that do not belong on GitHub.
 *
 * Both lists are written down rather than guessed, and checked here: a suite
 * or verifier added later is run by default, so a new database-bound one fails
 * in CI until it is named below, which is the honest outcome.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/* Unit suites that open a database connection. Run by `npm run gates`. */
const NEEDS_DATABASE_SUITES = new Set([
  "test:account-links-db",
  "test:admin-lists",
  "test:cms-draft",
  "test:console-round2-db",
  "test:db",
  "test:ledger",
  "test:partner-console",
  "test:rail-exceptions-db",
  "test:sponsor-invoice",
  "test:support-console",
  "test:e2e",
]);

/* Verifiers that read only the repository. Probed with no database on 2026-10-01. */
const STATIC_VERIFIERS = [
  "verify:sprint65", "verify:nul", "verify:sprint51", "verify:runbook", "verify:sprint37l2",
  "verify:sprint37l", "verify:sprint35r", "verify:sprint32", "verify:sprint31", "verify:palette",
  "verify:contrast", "verify:machines", "verify:traps", "verify:csp", "verify:email-dns",
  "verify:claims", "verify:reachable", "verify:principals", "verify:sprint59", "verify:sprint60",
  "verify:sprint61", "verify:boundary", "verify:sprint77", "verify:finance", "verify:plan",
  "verify:rail", "verify:blobs", "verify:whatsapp", "verify:launch", "verify:qualified",
  "verify:orb", "verify:money", "verify:notices", "verify:prove",
];

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
