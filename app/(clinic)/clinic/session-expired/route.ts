import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { orgExpiredLanding } from "@/lib/routing";
import { revokeClinicSession } from "@/lib/clinic-auth/session";

export const dynamic = "force-dynamic";

/**
 * 🔴 Board 249 / 327 / 330: this portal's graceful end of a dead session.
 *
 * The loop `app/session-expired/route.ts` ended for clinicians and W2-P01 for
 * patients: the cookie outlives its session (aged out, or revoked by a password
 * reset), the guard sent the holder to the sign-in page, and middleware sent a
 * cookie holder at that door home again, forever. Only a route handler may
 * delete a cookie, so this is one: the row is revoked, the cookie goes, and
 * `expired=1` lets the sign-in form render.
 */
export async function GET() {
  await revokeClinicSession();
  return NextResponse.redirect(new URL(orgExpiredLanding("clinic"), env.appUrl));
}
