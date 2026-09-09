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
