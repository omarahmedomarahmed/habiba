/**
 * The database suites, against a throwaway Postgres on this machine.
 *
 *     DATABASE_URL=postgres://postgres:postgres@localhost:5432/ci \
 *     DATABASE_WS_PROXY=localhost:5488 npm run ci:db
 *
 * The second CI job (`.github/workflows/ci.yml`, "Database checks") runs this
 * after `db:migrate`, `settings:seed` and `db:seed` against a Postgres service
 * container with Neon's WebSocket proxy in front of it. No secret is involved.
 *
 * It runs every suite in `NEEDS_DATABASE_SUITES` except `test:e2e`, which
 * builds and serves the app through `tests/run-e2e.sh`. It refuses any database that is not
 * on this machine: these suites plant fixtures, and dev belongs to
 * `npm run gates`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { databaseHost, isLocalDatabaseHost } from "../lib/db/local-proxy";
import { NEEDS_DATABASE_SUITES } from "./_ci-lists";

/** Builds and serves the app; not part of this pass yet. */
const OWN_JOB = new Set(["test:e2e"]);

function main(): void {
  const host = databaseHost(process.env.DATABASE_URL);
  if (!host || !isLocalDatabaseHost(host)) {
    console.error(
      `ci:db: refusing to run against ${host ?? "(no DATABASE_URL)"}. ` +
        "These suites plant fixtures; point DATABASE_URL at a local Postgres.",
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_WS_PROXY) {
    console.error("ci:db: DATABASE_WS_PROXY is not set, so the driver cannot reach a plain Postgres.");
    process.exit(1);
  }

  const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> })
    .scripts;
  const suites = [...NEEDS_DATABASE_SUITES].filter((name) => !OWN_JOB.has(name)).sort();

  const missing = suites.filter((name) => !(name in scripts));
  if (missing.length > 0) {
    console.error(`ci:db: these suites are listed but not in package.json: ${missing.join(", ")}`);
    process.exit(1);
  }

  const failed: string[] = [];
  for (const suite of suites) {
    const started = Date.now();
    const run = spawnSync("npm", ["run", "-s", suite], { encoding: "utf8", env: process.env });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    /* A suite that crashed before its first test exits 0 with nothing to count. */
    const passed = Number(out.match(/^# pass (\d+)/m)?.[1] ?? "0");
    if (run.status === 0 && passed > 0) {
      console.log(`  ok    ${suite} (${String(passed)} passed, ${seconds}s)`);
    } else {
      failed.push(suite);
      console.log(`  FAIL  ${suite} (${seconds}s)`);
      for (const line of out.split("\n").filter((l) => /not ok|error|Error/.test(l)).slice(0, 20)) {
        console.log(`          ${line.trim()}`);
      }
    }
  }

  console.log(
    failed.length === 0
      ? `\nci:db: all ${String(suites.length)} database suites pass.`
      : `\nci:db: ${String(failed.length)} of ${String(suites.length)} failed: ${failed.join(", ")}`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
