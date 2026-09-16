/**
 * 🔴 76.30 — THE CHECKS THAT NEED A SERVER, WITH A SERVER.
 *
 *   npm run verify:served
 *
 * ## The gap, which is H20's quieter half a third time
 *
 * `verify:sprint31` holds six checks about localised routing that can only be
 * answered by a running product: that `/ar/pricing` is a page, that it serves
 * Arabic, that it lays out right to left, that a forged `x-locale` header
 * changes nothing, and that neither private path becomes a second address for a
 * record. Every one of them was `deferred to a running server` on every run
 * anybody ever did, because nothing started one.
 *
 * "A gate nobody runs is a gate nobody reads", and a check permanently deferred
 * is worse than a missing one: the pass line says `PASS (5 checks, 1 deferred)`
 * and a reader takes the PASS.
 *
 * ## What this does
 *
 * Boots the product on a spare port against whatever `DATABASE_URL` the caller
 * is already pointed at, waits for it to answer, runs the server-dependent
 * verifiers against it, and shuts it down in a `finally`.
 *
 * 🔴 IT DOES NOT BUILD. `next dev` compiles on demand, which is slower per page
 * and needs no build step, and the alternative is a gate that takes four
 * minutes and therefore is not run. Speed is a correctness property for a gate.
 *
 * 🔴 AND IT READS ONLY. Nothing here writes, so it is safe against any branch,
 * production included, which is the database whose routing most needs asking.
 */
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";

/** A port nothing else in this repository uses. */
const PORT = Number(process.env.SERVED_PORT ?? 3199);
const BASE = `http://localhost:${PORT}`;

/** Verifiers whose checks are deferred without one. */
const NEEDS_A_SERVER = ["verify:sprint31"];

async function answers(): Promise<boolean> {
  try {
    const response = await fetch(BASE, { signal: AbortSignal.timeout(4_000) });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  /*
   * 🔴 IF ONE IS ALREADY UP, USE IT. Somebody running this beside a dev server
   * should not wait forty seconds for a second copy, and a gate that is
   * annoying to run beside normal work is a gate that gets run less.
   */
  const existing = process.env.VERIFY_URL;
  let child: ReturnType<typeof spawn> | null = null;

  if (!existing) {
    console.log(`starting the product on ${PORT}…`);
    child = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      stdio: "ignore",
      env: {
        ...process.env,
        /*
         * The blob token is required in production and this is not production.
         * Without this the boot refuses, which is the guard working and is not
         * what this gate is asking about.
         */
        ALLOW_LOCAL_UPLOADS: "1",
        APP_URL: BASE,
      },
    });

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (await answers()) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }

    if (!(await answers())) {
      console.error(`nothing answered at ${BASE} within two minutes.`);
      child.kill("SIGTERM");
      process.exit(1);
    }
  }

  const url = existing ?? BASE;
  console.log(`serving at ${url}\n`);

  let failures = 0;
  try {
    for (const name of NEEDS_A_SERVER) {
      const run = spawnSync("npm", ["run", "--silent", name], {
        encoding: "utf8",
        env: { ...process.env, VERIFY_URL: url },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
      process.stdout.write(out);

      /*
       * 🔴 A DEFERRAL IS A FAILURE HERE, and that is the whole point of this
       * file. Everywhere else "deferred" means an honest "could not ask"; with
       * a server standing right there it means the check still did not run, and
       * a gate that tolerates that is the gate this one exists to replace.
       */
      if (run.status !== 0) failures += 1;
      if (/deferred to a running server/.test(out)) {
        console.error(`\n🔴 ${name} still deferred with a server at ${url}.`);
        failures += 1;
      }
    }
  } finally {
    child?.kill("SIGTERM");
  }

  console.log(
    failures === 0
      ? `\nserved: PASS (${NEEDS_A_SERVER.length} verifier${NEEDS_A_SERVER.length === 1 ? "" : "s"}, nothing deferred)`
      : `\nserved: ${failures} FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
