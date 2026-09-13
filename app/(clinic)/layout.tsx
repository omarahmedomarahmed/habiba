import { ClinicChrome } from "@/components/clinic/chrome";
import { getClinicActor } from "@/lib/clinic-auth/session";

/**
 * The clinic shell. PLAN.md 54.12, §3f, C259.
 *
 * ## 🔴 54.12 — "THE THERAPIST PORTAL MINUS EVERY CLINICAL SURFACE" IS A DIFFERENT
 *   PRODUCT, NOT THE SAME ONE WITH THINGS HIDDEN
 *
 * That distinction is the whole ticket. Reusing `(app)`'s layout with conditionals
 * would mean the clinician's shell asking "is this a practice manager?" on every
 * render, and the day somebody adds a nav item without reading the conditional, a
 * practice manager has a link to a caseload. Hidden is one bug away from visible.
 *
 * So this route group shares nothing with `(app)`. It has its own layout, its own
 * chrome, its own three destinations, and no import path that reaches a clinical
 * component. There is nothing to hide because there is nothing here.
 *
 * ## 🔴 AND NO CRISIS ORB, for the same reason the sponsor shell has none
 *
 * This is an administrator at a desk. The orb is on every PATIENT screen, and putting
 * a crisis line on a practice manager's dashboard would say something untrue about
 * whose screen it is.
 *
 * `getClinicActor` rather than `requireClinic`, because this layout also wraps the
 * sign-in, the enquiry and the invited clinician's own screen. A layout that
 * redirected would redirect the door.
 */
export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const actor = await getClinicActor();

  return (
    <ClinicChrome nav={actor !== null} clinicName={actor?.clinicName ?? null}>
      {children}
    </ClinicChrome>
  );
}
