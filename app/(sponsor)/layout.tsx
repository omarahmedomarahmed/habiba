import { SponsorChrome } from "@/components/sponsor/chrome";
import { getSponsorActor } from "@/lib/sponsor-auth/session";

/**
 * The sponsor shell. PLAN.md 53.4, C230, C259, C264.
 *
 * ## 🔴 Its own route group, sharing nothing with `(app)` or `(patient)`
 *
 * `(app)`'s layout calls `requireUser()` and reads `actor.organizationId`.
 * Rendering a sponsor inside it would need that layout to answer "is this an
 * employer?", which is the conditional C230 exists to make impossible: a sponsor
 * is never an `Actor` and a `SponsorActor` does not fit where one is expected.
 *
 * ## 🔴 There is no crisis orb here, and that is not an omission
 *
 * Every patient screen carries the SOS orb and the reasoning is in
 * `components/patient/chrome.tsx`. This is an HR administrator at a desk, and
 * putting a crisis line on their screen would say something untrue about whose
 * screen it is. C235's rule is that the PATIENT's crisis path never depends on
 * money; it is not a rule about decorating a payer's dashboard.
 *
 * `getSponsorActor` rather than `requireSponsor`, because this layout wraps the
 * sign-in and enquiry pages too. A layout that redirected would redirect the
 * door.
 */
export default async function SponsorLayout({ children }: { children: React.ReactNode }) {
  const actor = await getSponsorActor();

  return (
    <SponsorChrome
      nav={actor !== null}
      sponsorName={actor?.sponsorName ?? null}
      role={actor?.role ?? null}
    >
      {children}
    </SponsorChrome>
  );
}
