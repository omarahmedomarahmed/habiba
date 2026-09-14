import { NextResponse } from "next/server";

import { coverageSentence } from "@/lib/partner/consent";
import { approveNote, draftNote, noteFor } from "@/lib/partner/notes";
import { mayAnswer } from "@/lib/partner/platform";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 68.6 — THE NOTE, AND THE APPROVAL IS THEIR THERAPIST'S.
 *
 *   GET  /api/partner/v1/sessions/[ref]/note   the draft, for their clinician to read
 *   POST /api/partner/v1/sessions/[ref]/note   the text a named human approved
 *
 * ## 🔴 THE SCOPE IS `note:review`, NOT `note:write`, AND THAT IS THE WHOLE DESIGN
 *
 * > *§7's first hard rule is unchanged across a commercial boundary: content in a
 * > chart needs a named clinician who approved that exact text, and a partner's
 * > server is not one.*
 *
 * The scope names the act it permits, which is SUBMITTING A HUMAN'S APPROVAL. A scope
 * called `note:write` would describe a system writing into a chart, and an integrator
 * reading the scope list would reasonably build exactly that.
 *
 * ## 🔴 THE POST CARRIES THE TEXT, NOT A BOOLEAN
 *
 * "I approve" against a draft the server holds is a signature on a document the
 * signer cannot be shown to have read the final version of. So the body carries what
 * the clinician actually approved, which may differ from our draft in any way
 * including entirely, and the clinician's version is the note.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "note:review");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const allowed = await mayAnswer({
    partnerId: guard.key.partnerId,
    externalSessionRef: ref,
  });
  if (!allowed.ok) return fail(allowed.error, allowed.status);

  /*
   * 🔴 DRAFTED ON FIRST READ, from the transcript, rather than by a job somebody has
   * to poll. An integration asking for the note is an integration whose clinician is
   * looking at a screen, which is the moment it is worth spending a model call.
   */
  const existing = await noteFor(allowed.session.id);

  if (existing && !existing.draft && !existing.approvedText) {
    const { transcriptFor } = await import("@/lib/partner/media");
    const transcript = await transcriptFor(allowed.session.id);

    if (transcript) {
      const { writeSessionNote } = await import("@/lib/partner/draft");
      const text = await writeSessionNote(transcript);
      if (text) {
        await draftNote({
          partnerSessionId: allowed.session.id,
          text,
          recordingFromSeconds: allowed.session.recordingFromSeconds,
        });
      }
    }
  }

  const note = await noteFor(allowed.session.id);

  return NextResponse.json({
    session: ref,
    /* What we wrote. Not a chart entry, and the field name says so. */
    draft: note?.draft ?? null,
    /* What a human approved, or null. The only one of the two that is a note. */
    approved: note?.approvedText ?? null,
    approved_by: note?.approvedByRef ?? null,
    approved_at: note?.approvedAt?.toISOString() ?? null,
    coverage: coverageSentence(allowed.session.recordingFromSeconds),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "note:review");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const allowed = await mayAnswer({
    partnerId: guard.key.partnerId,
    externalSessionRef: ref,
  });
  if (!allowed.ok) return fail(allowed.error, allowed.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Send JSON.", 400);
  }

  const text = body.text;
  const clinician = body.approved_by;

  if (typeof text !== "string" || typeof clinician !== "string") {
    return fail(
      "Send text and approved_by. `approved_by` is your id for the person who read this note and stands behind it, never a service account.",
      400,
    );
  }

  const result = await approveNote({
    partnerSessionId: allowed.session.id,
    text,
    clinicianRef: clinician,
  });

  if (result.error) return fail(result.error, 409);

  return NextResponse.json({ session: ref, approved: true });
}
