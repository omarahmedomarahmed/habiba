import { PartnerChrome } from "@/components/partner/chrome";
import { getPartnerActor } from "@/lib/partner-auth/session";
import { headers } from "next/headers";

import { LanguageCorner } from "@/components/i18n/language-corner";
import { PARTNER_SIGN_IN } from "@/lib/routing";

/**
 * The partner developer shell. PLAN.md 55.2, 55.3, C264.
 *
 * ## 🔴 ITS OWN ROUTE GROUP, SHARING NOTHING WITH `(app)`
 *
 * The same argument sprint 54 made for the clinic, and it is stronger here. `(app)`'s
 * layout is the clinical product's chrome; reusing it with conditionals would mean the
 * clinician's shell asking "is this a developer at another company?" on every render, and
 * the day somebody adds a nav item without reading the conditional, a developer has a link
 * to a caseload.
 *
 * There is nothing to hide in here because there is nothing here. Four destinations, none
 * of which is a patient, a session or a note.
 *
 * ## 🔴 AND NO CRISIS ORB
 *
 * This is an engineer at a desk. The orb is on every PATIENT screen; putting a crisis line
 * on a developer's dashboard would say something untrue about whose screen it is. The same
 * reasoning as the sponsor's shell and the clinic's, for the third time.
 *
 * `getPartnerActor` rather than `requirePartner`, because this layout also wraps the
 * sign-in and the enquiry. A layout that redirected would redirect the door.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const [actor, head] = await Promise.all([getPartnerActor(), headers()]);

  /*
   * 🔴 The door brings the site's own header and footer now, so this shell
   * steps aside for it. Task 154.
   *
   * `bare` drops only the `max-w-4xl` column: a full width site header dropped
   * into an 896px column is a header floating in the middle of a grey page.
   * The layout still WRAPS the door, which is the part that matters and is
   * unchanged. `LanguageCorner` goes with it, because the site header already
   * carries the switch and two of them in one corner is what 75.3 was fixing.
   */
  const door = (head.get("x-pathname") ?? "") === PARTNER_SIGN_IN;

  return (
    <PartnerChrome bare={door} nav={actor !== null} partnerName={actor?.partnerName ?? null}>
      {/* 🔴 75.3 — the language switch, in the same corner of every screen. */}
      {door ? null : <LanguageCorner />}
      {children}
    </PartnerChrome>
  );
}
