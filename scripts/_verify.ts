/**
 * The shared reporting for every acceptance script. PLAN.md 19.0, C90.
 *
 * ## 🔴 Why a skip exists at all
 *
 * Two verifiers were permanently red against production, for one known reason:
 * they read content that sprint 22 publishes, and 22 has not run. Every one of
 * those five-of-fourteen failures was correct in the narrow sense and useless
 * in the practical one — **a gate that is red for a known reason is a gate
 * everybody learns to skim, and the next real failure hides inside it.**
 *
 * So a check that depends on something a later sprint delivers is SKIPPED with
 * its reason printed, and never FAILED:
 *
 *     --  17.9 deferred to 22.8b: pricing content not yet published
 *
 * ## The rules that keep a skip honest
 *
 * A skip is a hole in a gate, so it is deliberately hard to hide one:
 *
 *   1. A skip must name **what it is waiting for** — a ticket number, not a
 *      mood. `deferredTo` is required.
 *   2. Skips are **counted and printed in the summary**, so "sprint 17: PASS
 *      (9 checks, 5 deferred)" can never read as a clean run.
 *   3. A skip is only legitimate when the *precondition* is genuinely absent.
 *      `skipUnless` takes the condition: when the content IS there, the check
 *      runs normally, which is how sprint 22 flips these back on without
 *      anybody editing a file.
 */

export type Reporter = {
  check: (label: string, ok: boolean, detail?: string) => void;
  /** Run `fn` only when `ready`; otherwise record a skip naming what it awaits. */
  skipUnless: (
    ready: boolean,
    deferredTo: string,
    reason: string,
    fn: () => void | Promise<void>,
  ) => Promise<void>;
  /** Print the summary and exit. Non-zero only on a real failure. */
  finish: (sprint: string) => never;
  counts: () => { checks: number; failures: number; skips: number };
};

export function reporter(): Reporter {
  let checks = 0;
  let failures = 0;
  let skips = 0;

  const check = (label: string, ok: boolean, detail = "") => {
    checks += 1;
    if (!ok) failures += 1;
    console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? `, ${detail}` : ""}`);
  };

  const skipUnless = async (
    ready: boolean,
    deferredTo: string,
    reason: string,
    fn: () => void | Promise<void>,
  ) => {
    if (ready) {
      await fn();
      return;
    }
    skips += 1;
    console.log(`  --    deferred to ${deferredTo}: ${reason}`);
  };

  const finish = (sprint: string): never => {
    const deferred = skips > 0 ? `, ${skips} deferred` : "";
    console.log(
      `\n${failures === 0 ? `${sprint}: PASS` : `${sprint}: ${failures} FAILED`} (${checks} checks${deferred})`,
    );
    process.exit(failures === 0 ? 0 : 1);
  };

  return { check, skipUnless, finish, counts: () => ({ checks, failures, skips }) };
}

/* ------------------------------------------------------- the operator's half */

/**
 * 🔴 The endpoint nothing in this directory may write to.
 *
 * A Neon connection string names a compute endpoint, not a branch, so "is this
 * a preview?" is unanswerable from the string alone. What *is* answerable is
 * whether it is the one endpoint we must never touch: the read-write compute
 * on `main`. It is refused by name.
 *
 * One constant rather than one per script, which is the whole reason this
 * moved here: sprint 6 and sprint 10 each carried their own copy, sprints 25,
 * 26 and 27 were written without one, and a rule that has to be remembered by
 * every new file is a rule that lasts until somebody is in a hurry.
 */
const PRODUCTION_ENDPOINT = "ep-wild-lake-a6tgm2r6";

/**
 * Every verifier that WRITES starts here. PLAN.md C147.
 *
 * It prints the host either way, so a wrong database shows up in the output
 * rather than in the data, and it refuses production by name.
 */
export function writesTo(): string {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";

  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log(`writing to ${host}\n`);

  if (host.includes(PRODUCTION_ENDPOINT)) {
    console.error("Refusing to run: that is the production endpoint. Point at your branch.");
    process.exit(1);
  }

  return host;
}

/**
 * 🔴 A missing fixture is an OPERATOR mistake, and must read like one.
 *
 * Sprints 25, 26 and 27 each selected a therapist and dereferenced it without
 * checking. Against the purged production database, which has one seeded admin
 * and no therapist, all three died with
 *
 *     TypeError: Cannot read properties of undefined (reading 'organizationId')
 *
 * which tells the person running it that the code is broken. It is not: they
 * pointed a verifier at a database with nothing in it. This says so, names
 * what was missing, and exits 1 without a stack trace.
 */
export function required<T>(row: T | undefined | null, what: string): T {
  if (row === undefined || row === null) {
    console.error(
      `\nRefusing to run: this database has no ${what}.\n` +
        "That is an empty or freshly purged database rather than a failure. " +
        "Point at a branch with seeded data, or run `npm run db:seed` against it first.",
    );
    process.exit(1);
  }
  return row;
}
