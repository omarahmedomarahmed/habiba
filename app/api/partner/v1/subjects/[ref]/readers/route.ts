import { NextResponse } from "next/server";

import { whoMayRead } from "@/lib/partner/api";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 55.6 / C277 — GET /api/partner/v1/subjects/[ref]/readers
 *
 * WHO may read this person's record, which is a list of clinicians holding a live grant.
 * NOT the record.
 *
 * ## 🔴 THERE IS NO `/subjects/[ref]/record` ROUTE, AND THERE WILL NOT BE
 *
 * > *A partner's clinician reads a patient's record exactly as ours does, because they
 * > hold a grant the patient gave and can revoke. A partner is a clinician for access
 * > purposes, never a special case.*
 *
 * So reading happens through `accessFor`, from the ordinary session 42.3's launch mints,
 * with the CLINICIAN as the actor. A route that returned a record for a key would be a
 * partner reading a chart with a partner's credential, and the patient's revocation would
 * not reach it.
 *
 * 🔴 A GET here is safe where it was not for the other two: `[ref]` is the partner's OWN
 * reference for a person in their own system, which they already have in their own logs.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "record:read");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const result = await whoMayRead({ key: guard.key, externalRef: ref });
  if ("error" in result) return fail(result.error, result.status);

  return NextResponse.json(result);
}
