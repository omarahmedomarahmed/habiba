import { SponsorChrome } from "@/components/sponsor/chrome";
import { getSponsorActor } from "@/lib/sponsor-auth/session";
import { headers } from "next/headers";

import { SPONSOR_SIGN_IN } from "@/lib/routing";
import { PendingBar } from "@/components/billing/pending-bar";
import { pendingPaymentFor } from "@/lib/billing/pending";
import { getI18n } from "@/lib/i18n/server";
import { localeTag } from "@/lib/i18n/config";

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
  const [actor, { t, locale }, head] = await Promise.all([
    getSponsorActor(),
    getI18n(),
    headers(),
  ]);

  /*
   * 🔴 The door brings the site's own header and footer now, so this shell
   * steps aside for it. Task 154.
   *
   * `bare` drops only the `max-w-4xl` column: a full width site header dropped
   * into an 896px column is a header floating in the middle of a grey page.
   * The layout still WRAPS the door, which is the part that matters and is
   * unchanged; only the container changes.
   *
   * 🔴 AND THE SWITCH IS NOT RENDERED HERE AT ALL ANY MORE.
   *
   * It was a `LanguageCorner`, fixed to the top corner of the glass. On this
   * portal the first thing on the page is the payment bar, so the pill landed
   * on top of that bar's Dismiss button. It now rides in the desk's rail with
   * Sign out, which is the same place on every screen of this portal without
   * being on top of one. The door needs no line either way: the site header it
   * brings carries its own switch.
   */
  const door = (head.get("x-pathname") ?? "") === SPONSOR_SIGN_IN;

  /*
   * 🔴 76.4 — a company's transfer sits in the queue for hours, and a finance
   * team that cannot see it emails to ask. Only for a signed-in sponsor: this
   * layout also wraps the sign-in and enquiry doors, where there is nobody to
   * have a payment.
   */
  const pending = actor
    ? await pendingPaymentFor({ kind: "sponsor", sponsorId: actor.sponsorId }, t, localeTag(locale))
    : null;

  return (
    <SponsorChrome
      bare={door}
      nav={actor !== null}
      sponsorName={actor?.sponsorName ?? null}
      role={actor?.role ?? null}
    >
      {pending ? (
        <div className="mb-6 empty:hidden print:hidden">
        <PendingBar
          what={pending.what}
          amount={pending.amount}
          href={pending.href}
          stage={pending.stage}
          paymentId={pending.paymentId}
          storageKey={pending.storageKey}
        />
        </div>
      ) : null}
      {children}
    </SponsorChrome>
  );
}
