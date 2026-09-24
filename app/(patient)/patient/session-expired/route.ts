import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { destroyPatientSession } from "@/lib/patient-auth/session";

export const dynamic = "force-dynamic";

/**
 * 🔴 W2-P01: the patient's graceful end of an expired session.
 *
 * The same loop `app/session-expired/route.ts` ended for clinicians: the
 * cookie outlives the session, middleware sends a cookie holder at
 * `/patient/login` back to `/patient`, and `/patient` sent them to the login
 * page again. Only a route handler may delete a cookie, so this is one. The
 * session row is revoked, the cookie goes, and `expired=1` lets the sign-in
 * page render, with the page they were on kept as `next`.
 */
export async function GET(request: Request) {
  await destroyPatientSession();

  const next = new URL(request.url).searchParams.get("next");
  const target = new URL("/patient/login", env.appUrl);
  target.searchParams.set("expired", "1");
  // A path on this origin only: an absolute URL here is an open redirect.
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/patient/session-expired")) {
    target.searchParams.set("next", next);
  }

  return NextResponse.redirect(target);
}
