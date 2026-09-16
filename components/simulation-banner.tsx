import { SIMULATION_BRANCH, SIMULATION_ENDPOINT, SIMULATION_RUNNING, env } from "@/lib/env";

/**
 * 🔴 76.47 — THE SIMULATION SAYS SO, ON EVERY PAGE.
 *
 * ## Why this exists at all
 *
 * The six month run produces a deployment somebody signs into afterwards and
 * reads as a therapist, a patient, a clinic manager and an operator. Everything
 * in it looks exactly like the product, because it IS the product: the same
 * code, the same screens, the same money. The only thing that differs is that
 * every person in it was invented.
 *
 * A screen full of invented clinical records that does not say it is invented
 * is a screen somebody eventually quotes. Nothing else on the page can tell
 * them, because nothing else is different.
 *
 * ## 🔴 AND IT IS THE CONFIRMATION THAT THE WIRING IS RIGHT
 *
 * `lib/env.ts` refuses to boot when the branch and the database disagree, so a
 * simulation deployment that renders at all is already proof it reached
 * `simulation-q1`. This makes that proof visible rather than inferred: the
 * strip names the branch and the endpoint it is actually on, so confirming the
 * deployment is wired correctly is opening it once and reading one line.
 *
 * The endpoint is not a secret. `scripts/_environments.ts` says so and why: the
 * host is in HAZARDS.md, in the Neon console and in half the comments in
 * `scripts/`. The password is the secret and it lives in an environment
 * variable that never reaches a page.
 *
 * ## Where it renders, and the second case is deliberate
 *
 * On the simulation BRANCH, detected from `VERCEL_GIT_COMMIT_REF`, which Vercel
 * sets and a laptop does not. And on any deployment that declares
 * `SIMULATION_RUNNING`, which is how a run on PRODUCTION says so: that
 * arrangement has no branch to detect, because it is the real deployment on the
 * real database, put back afterwards by restoring a snapshot.
 *
 * 🔴 That second case is the one worth being loud about. A flag that changes
 * how production behaves is a flag somebody leaves on, and the mitigation is
 * not discipline: it is that every page grows a violet bar naming the database,
 * so a deployment left in this state announces itself.
 */
export function SimulationBanner() {
  /*
   * 🔴 TWO WAYS TO BE A SIMULATION, and they are different arrangements.
   *
   * The BRANCH is the standing one: a separate deployment on a separate
   * database, which anybody can open afterwards.
   *
   * `SIMULATION_RUNNING` is the temporary one: a run happening on PRODUCTION,
   * on the real deployment and the real database, undone afterwards by
   * restoring a snapshot. That arrangement has no branch to detect, so it is
   * declared, and while it is declared this strip is the thing that stops a
   * founder reading invented money as real money.
   */
  const onBranch = process.env.VERCEL_GIT_COMMIT_REF === SIMULATION_BRANCH;
  if (!onBranch && !SIMULATION_RUNNING) return null;

  /*
   * 🔴 THE ENDPOINT IS READ BACK OUT OF THE URL, not assumed from the branch.
   *
   * The boot guard has already refused anything else, so this can only ever
   * print the simulation's own endpoint. It reads it rather than printing the
   * constant, because a line that prints what it was told is a line that would
   * keep saying the right thing after the guard was weakened.
   */
  const on = env.databaseUrl.includes(SIMULATION_ENDPOINT)
    ? SIMULATION_ENDPOINT
    : env.databaseUrl.match(/@(ep-[a-z0-9-]+)/)?.[1] ?? "an unknown database";

  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-violet-700 px-3 py-1.5 text-center text-xs font-medium text-white"
    >
      <span>Simulation. Everybody here is invented.</span>
      <span className="font-mono text-[11px] text-violet-200">{on}</span>
    </div>
  );
}
