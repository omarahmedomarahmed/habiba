import { SIMULATION_BRANCH, SIMULATION_RUNNING } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

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
 * ## 🔴 IT NAMES NO INFRASTRUCTURE (B1)
 *
 * It used to print the database endpoint as proof of the wiring. During a run
 * on PRODUCTION that put production's database host in front of every visitor,
 * signed in or not. The page never needed the proof: `lib/env.ts` refuses to
 * boot when the branch and the database disagree, so a simulation deployment
 * that renders at all already reached `simulation-q1`. The strip says the
 * people are invented and nothing else, and `tests/safety.test.ts` fails if
 * this file reads the connection string again.
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
 * not discipline: it is that every page grows a violet bar, so a deployment
 * left in this state announces itself.
 */
/** One line of 1rem plus 0.375rem above and below. Board 884. */
export const SIM_BANNER_HEIGHT = "1.75rem";

export async function SimulationBanner() {
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
  const { t } = await getI18n();

  return (
    <>
      {/*
        🔴 Board 884: the floating language switch and bell sat on top of this
        line at phone width and hid it. The banner is one line of a known
        height, and it says so to the page, so \`LanguageCorner\` starts below it.
      */}
      <style>{`:root{--sim-banner-h:${SIM_BANNER_HEIGHT}}`}</style>
      <div
        role="note"
        className="truncate bg-violet-700 px-3 py-1.5 text-center text-xs leading-4 font-medium whitespace-nowrap text-white"
      >
        {t("sim.banner")}
      </div>
    </>
  );
}
