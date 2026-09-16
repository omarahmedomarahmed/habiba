import { SIMULATION_BRANCH, SIMULATION_ENDPOINT, env } from "@/lib/env";

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
 * ## It renders nowhere else
 *
 * `VERCEL_GIT_COMMIT_REF` is set by Vercel and absent on a laptop, so this is
 * null in development, null in production and null on every other branch. A
 * banner that could appear on the real product would be a banner somebody has
 * to write a rule about.
 */
export function SimulationBanner() {
  if (process.env.VERCEL_GIT_COMMIT_REF !== SIMULATION_BRANCH) return null;

  /*
   * 🔴 THE ENDPOINT IS READ BACK OUT OF THE URL, not assumed from the branch.
   *
   * The boot guard has already refused anything else, so this can only ever
   * print the simulation's own endpoint. It reads it rather than printing the
   * constant, because a line that prints what it was told is a line that would
   * keep saying the right thing after the guard was weakened.
   */
  const on = env.databaseUrl.includes(SIMULATION_ENDPOINT) ? SIMULATION_ENDPOINT : "an unknown database";

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
