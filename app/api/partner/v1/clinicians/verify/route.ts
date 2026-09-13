import { NextResponse } from "next/server";

import { clinicianVerification } from "@/lib/partner/api";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 55.5 — POST /api/partner/v1/clinicians/verify
 *
 * *Is this clinician verified with us, and by which body. A boolean and a source, never a
 * document.*
 *
 * A POST rather than a GET for the same reason as the employment endpoint: a clinician's
 * email in a URL is a clinician's email in every log between here and there.
 */
export async function POST(request: Request) {
  const guard = await withKey(request, "clinician:verify");
  if ("response" in guard) return guard.response;

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return fail("Send JSON.", 400);
  }

  if (typeof body.email !== "string") return fail("Send an email address.", 400);

  const result = await clinicianVerification({ key: guard.key, email: body.email });
  if ("error" in result) return fail(result.error, result.status);

  return NextResponse.json(result);
}
