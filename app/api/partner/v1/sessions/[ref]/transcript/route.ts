import { NextResponse } from "next/server";

import { coverageSentence } from "@/lib/partner/consent";
import { transcriptFor } from "@/lib/partner/media";
import { mayAnswer } from "@/lib/partner/platform";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 68.5 — GET /api/partner/v1/sessions/[ref]/transcript
 *
 * *Transcript out, diarised, with the same source attribution `session_sources`
 * already carries.*
 *
 * ## 🔴 THE COVERAGE SENTENCE TRAVELS WITH THE TRANSCRIPT, ALWAYS
 *
 * A transcript that begins ten minutes into a session looks exactly like a transcript
 * of a session that started ten minutes late. Whoever reads it on the partner's side
 * has no way to tell, and the difference is whether the first ten minutes exist and
 * nobody agreed to them being recorded.
 *
 * So `coverage` is in the response body and it is not optional. It is the same
 * sentence the note carries and the same one the patient's summary carries, from one
 * function, because three surfaces saying three similar things about what was
 * recorded is how one of them ends up wrong.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "transcript:read");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const allowed = await mayAnswer({
    partnerId: guard.key.partnerId,
    externalSessionRef: ref,
  });
  if (!allowed.ok) return fail(allowed.error, allowed.status);

  const text = await transcriptFor(allowed.session.id);

  return NextResponse.json({
    session: ref,
    /* Null rather than an empty string: nothing has arrived is not an empty session. */
    transcript: text,
    recording_from_seconds: allowed.session.recordingFromSeconds,
    coverage: coverageSentence(allowed.session.recordingFromSeconds),
    /*
     * 🔴 SOURCE ATTRIBUTION, in the words 47.1 settled and for the same reason: the
     * wording is SOURCE, never QUALITY. A hand-written note is not weaker evidence,
     * it is differently sourced, and a partner's system showing "unverified" beside
     * a transcript would be making a claim about reliability we did not make.
     */
    source: "transcript",
  });
}
