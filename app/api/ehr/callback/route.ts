import { NextResponse } from "next/server";

import { getClinicActor } from "@/lib/clinic-auth/session";
import { getActor } from "@/lib/auth/session";
import { completeConnection } from "@/lib/data/ehr";
import { env } from "@/lib/env";
import { takePending } from "@/lib/ehr/pending";
import { redeemCode } from "@/lib/ehr/smart";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 43.2 — GET /api/ehr/callback. THE ONLY PLACE A TOKEN IS EXCHANGED OR STORED.
 *
 * The hospital redirects the clinician's browser here after they approve. This is the mirror of
 * sprint 55's launch redemption and it is here for the same structural reason: `api/` is excluded
 * from the middleware matcher, so a request arriving mid-flow is not bounced by `routeDecision`
 * before the handler runs.
 *
 * ## 🔴 THE STATE IS CHECKED, AND THE COOKIE IS CONSUMED WHETHER OR NOT IT MATCHES
 *
 * `takePending` deletes the cookie on the way out, so one authorisation code gets one attempt. A
 * pending cookie that survived a failed callback would let a captured code be retried.
 *
 * ## 🔴 THE ORGANISATION COMES FROM THE LIVE SESSION, NOT FROM THE COOKIE
 *
 * The cookie carries it, and this refuses a mismatch rather than believing it. What that decides
 * is WHICH ORGANISATION a hospital's credential is attached to, and getting it wrong once means
 * one practice's Epic token stored under another practice's row: every clinician in the second
 * practice filing notes into the first one's charts.
 *
 * 🔴 Both principals are read because 43.1c is two homes for one flow: a clinic manager carries
 * `24t_clinic` and a solo clinician carries `24t_session`. Whichever is live must agree with the
 * cookie, and neither is allowed to stand in for the other — a clinician's session cannot complete
 * a connection a clinic manager started, because C266 makes that a different organisation.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pending = await takePending();

  /*
   * 🔴 WHO IS COMPLETING THIS, read before anything can fail, because the answer decides which of
   * 43.1c's two homes a failure returns to.
   *
   * A clinic manager bounced to `/settings/records` would land on a clinician screen their cookie
   * cannot open, so the error they get is a sign-in page rather than the sentence explaining what
   * went wrong.
   */
  const [clinicActor, clinicianActor] = await Promise.all([getClinicActor(), getActor()]);

  const home = clinicActor ? "/clinic/records" : "/settings/records";

  const fail = (why: string, reason: string) => {
    log.warn("ehr callback refused", { reason });
    /* Back to the screen they started on, with a sentence rather than a JSON body. */
    return NextResponse.redirect(`${env.appUrl}${home}?ehr=${why}`, 303);
  };

  if (!pending) return fail("expired", "no pending cookie, or it had expired");

  /*
   * 🔴 A vendor may redirect back with an error instead of a code. `access_denied` is a clinician
   * pressing Cancel, which is not a failure worth a warning, and everything else is theirs.
   */
  const vendorError = url.searchParams.get("error");
  if (vendorError) return fail("refused", `the vendor returned ${vendorError}`);

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!code) return fail("expired", "no code on the callback");
  /* Constant-time is unnecessary here: both strings are ours and a mismatch is not a secret. */
  if (state !== pending.state) return fail("expired", "the state did not match");

  /* 🔴 Whichever session is live, and it must agree with the cookie. Read above. */
  const sessionOrganizationId =
    clinicActor?.clinicOrganizationId ?? clinicianActor?.organizationId ?? null;

  if (!sessionOrganizationId) return fail("signedout", "no live session on the callback");

  if (sessionOrganizationId !== pending.organizationId) {
    /*
     * The one that matters. A cookie started under one organisation and a session belonging to
     * another would attach a hospital's credential to the wrong practice.
     */
    return fail("mismatch", "the session's organisation is not the one that started this");
  }

  const { grant, error } = await redeemCode({
    tokenUrl: pending.tokenUrl,
    code,
    verifier: pending.verifier,
  });

  if (error || !grant) return fail("refused", error ?? "the token exchange returned nothing");

  const stored = await completeConnection({
    organizationId: pending.organizationId,
    vendor: pending.vendor,
    fhirBaseUrl: pending.fhirBaseUrl,
    issuer: pending.issuer,
    accessToken: grant.accessToken,
    refreshToken: grant.refreshToken,
    expiresAt: grant.expiresAt,
    scopes: grant.scopes,
    /*
     * 🔴 No tenant label from the token response, deliberately.
     *
     * Some vendors return a display name for the tenant and some return the logged-in user's own
     * name. The second would put a person's name in a column described as an institution's, so
     * this stays null until an operator sets it: a wrong label on a connection screen is how
     * somebody disconnects the wrong hospital.
     */
    tenantLabel: null,
  });

  if (stored.error) return fail("refused", stored.error);

  return NextResponse.redirect(`${env.appUrl}${home}?ehr=connected`, 303);
}
