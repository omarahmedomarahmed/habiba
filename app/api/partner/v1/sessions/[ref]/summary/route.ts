import { NextResponse } from "next/server";

import { writePatientSummary } from "@/lib/partner/draft";
import { transcriptFor } from "@/lib/partner/media";
import { deliverSummary, noteFor } from "@/lib/partner/notes";
import { mayAnswer } from "@/lib/partner/platform";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 68.9 — THE PATIENT SUMMARY, DELIVERED TO THEIR PATIENT.
 *
 *   GET  /api/partner/v1/sessions/[ref]/summary   the draft, for their clinician
 *   POST /api/partner/v1/sessions/[ref]/summary   the text their clinician approved
 *
 * *Reviewed and edited by their therapist before anybody sees it, like ours.*
 *
 * ## 🔴 THE ORDER IS ENFORCED IN THREE PLACES AND THAT IS NOT ONE TOO MANY
 *
 * A summary may not be delivered until the note is approved:
 *
 *   1. `deliverSummary` refuses it with a sentence an integrator can act on.
 *   2. A database CHECK refuses the row.
 *   3. This route refuses the draft too, below, so nobody builds a flow that
 *      generates a summary and then discovers it cannot be sent.
 *
 * The rule is that a patient does not hear about their own therapy from a model with
 * nobody in between, and it is the one rule in this API that a well-meaning
 * integration would break by accident: delivering the summary is the last step, so it
 * is the one somebody wires up first while testing.
 *
 * ## 🔴 AND THE SUMMARY IS NOT THE NOTE
 *
 * The SOAP note is a professional document full of differential impressions and risk
 * language. Sending it to the person it is about is how a clinician ends up
 * explaining the word "guarded" over the phone. The draft here is written from
 * `patientBrief` and `patientSteps`, addressed to the patient, in their words.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "summary:deliver");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const allowed = await mayAnswer({
    partnerId: guard.key.partnerId,
    externalSessionRef: ref,
    environment: guard.key.environment,
  });
  if (!allowed.ok) return fail(allowed.error, allowed.status);

  const note = await noteFor(allowed.session.id);

  if (!note?.approvedAt) {
    /*
     * 🔴 REFUSED AT THE DRAFT, not only at the delivery.
     *
     * An integrator who can fetch a summary draft will put it on a screen, and a
     * summary on a screen is a summary somebody reads. The order matters before the
     * text exists, not after.
     */
    return fail(
      "Nobody has approved this session's note yet. The summary is written from the session and reviewed by the same clinician, so it does not exist until they have read the note.",
      409,
    );
  }

  const transcript = await transcriptFor(allowed.session.id);
  const draft = transcript ? await writePatientSummary(transcript) : null;

  return NextResponse.json({ session: ref, draft });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "summary:deliver");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const allowed = await mayAnswer({
    partnerId: guard.key.partnerId,
    externalSessionRef: ref,
    environment: guard.key.environment,
  });
  if (!allowed.ok) return fail(allowed.error, allowed.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Send JSON.", 400);
  }

  if (typeof body.text !== "string") {
    return fail("Send text: what your clinician approved for their patient to read.", 400);
  }

  const result = await deliverSummary({
    partnerSessionId: allowed.session.id,
    text: body.text,
  });

  if (result.error) return fail(result.error, 409);

  return NextResponse.json({ session: ref, delivered: true });
}
