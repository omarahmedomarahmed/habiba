import { ClinicChrome } from "@/components/clinic/chrome";
import { getClinicActor } from "@/lib/clinic-auth/session";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { CLINIC_COOKIE, isClinicDoor, orgExpiredLanding } from "@/lib/routing";

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
  const [actor, head] = await Promise.all([getClinicActor(), headers()]);

  /*
   * 🔴 The door brings the site's own header and footer now, so this shell
   * steps aside for it. Task 154.
   *
   * `bare` drops only the `max-w-4xl` column: a full width site header dropped
   * into an 896px column is a header floating in the middle of a grey page.
   * The layout still WRAPS the door, which is the part that matters and is
   * unchanged — it calls `getClinicActor` rather than `requireClinic` because
   * a layout that redirected would redirect the door.
   *
   * 🔴 AND THE SWITCH IS NOT RENDERED HERE AT ALL ANY MORE.
   *
   * It was a `LanguageCorner`, fixed to the top corner of the glass, which on
   * this portal meant a pill sitting on top of the first thing on the page. It
   * now rides in the desk's rail with Sign out, where it is in the same place
   * on every screen of this portal without being on top of one. The door needs
   * no line of its own either way: the site header it brings carries its own
   * switch.
   */
  /* 🔴 W2-C07: every door, not only the sign-in, and no rail over one. */
  const path = head.get("x-pathname") ?? "";
  const door = isClinicDoor(path);

  /*
   * 🔴 Board 651: A STALE COOKIE GOES TO THE DOOR FROM HERE, IN ONE REDIRECT.
   *
   * The page's own guard found it first, but the page sits under a loading
   * screen, so its redirect came from inside a streamed response and the
   * browser followed it on the client: five navigations and ten seconds to
   * reach the sign-in form. A layout above the loading boundary redirects
   * before anything is flushed, and middleware clears the cookie at the
   * landing (`orgCookieToClear`). Never on a door, which this layout wraps.
   */
  if (!actor && !door && path.startsWith("/clinic") && (await cookies()).get(CLINIC_COOKIE)?.value) {
    redirect(orgExpiredLanding("clinic"));
  }

  return (
    <ClinicChrome
      bare={door}
      nav={actor !== null && !door}
      clinicName={actor?.clinicName ?? null}
      capabilities={actor?.capabilities ?? []}
      linked={Boolean(actor?.linkedUserId)}
    >
      {children}
    </ClinicChrome>
  );
}
