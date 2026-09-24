import { NextResponse } from "next/server";

import { sessionMaterial, subjectRefusal } from "@/lib/partner/copilot";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 68.8 — GET /api/partner/v1/subjects/[ref]/memory
 *
 * *The memory layer and the facts, so a therapist on their platform gets the same
 * continuity ours does.*
 *
 * ## 🔴 THE MEMORY IS THEIR OWN SESSIONS, AND THAT IS THE RULING RATHER THAN A LIMIT
 *
 * A therapist on their platform who saw this person in March and again in June gets
 * March's note when they open June's session. That is what continuity means and it is
 * what this returns.
 *
 * What it does NOT return is anything from our tenancy. If this person also has a
 * record with us — a therapist of their own, journals, documents, facts — none of it
 * appears here, under any parameter, because it belongs to them and they did not give
 * it to this platform. Sprints 26 and 27 built the mechanism for that: a PATIENT
 * claims and moves their own record, and no clinician moves it for them.
 *
 * ## 🔴 THE APPROVED NOTE, NEVER THE DRAFT
 *
 * A draft is what our model wrote. A note is what a clinician stood behind. Continuity
 * built from drafts would mean a therapist reading, as a fact about a patient's March,
 * a sentence no human ever approved.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "memory:read");
  if ("response" in guard) return guard.response;

  const { ref } = await params;
  if (!ref) return fail("Send a subject reference.", 400);

  /* 🔴 W1-18: consent and revocation, before any session material is read. */
  const refused = await subjectRefusal({ partnerId: guard.key.partnerId, externalSubjectRef: ref });
  if (refused) return fail(refused.error, refused.status);

  const material = await sessionMaterial({
    partnerId: guard.key.partnerId,
    externalSubjectRef: ref,
  });

  return NextResponse.json({
    subject: ref,
    sessions: material.map((session) => ({
      session: session.ref,
      ended_at: session.endedAt?.toISOString() ?? null,
      /*
       * 🔴 The approved note only. A transcript is raw material for a clinician
       * reviewing their own session, which is the `transcript:read` route; it is not
       * continuity, and putting it here would make a therapist's summary of a
       * previous session a wall of speech.
       */
      note: session.note,
    })),
    /*
     * 🔴 SAID IN THE RESPONSE, because an integrator will ask.
     *
     * The obvious question on reading this endpoint is "why is there so little here
     * for a patient who has been in therapy for years", and the answer is not an
     * omission. It is stated rather than left for a support conversation.
     */
    scope:
      "The sessions this platform ran with this person. Anything they hold with 24Therapy directly is theirs and is not here.",
  });
}
