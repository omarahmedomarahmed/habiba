import { NextResponse } from "next/server";

import { writeBackSession } from "@/lib/partner/api";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 55.7 — POST /api/partner/v1/sessions
 *
 * *A session held on the partner's platform lands in our record, source-attributed,
 * through the door 36 built.*
 *
 * ## 🔴 WHAT THE BODY MAY CONTAIN, AND WHY IT IS SO SHORT
 *
 * A subject reference, a clinician's email, a start time, a duration, and their own
 * meeting id. Five fields, and there is no sixth: no note, no transcript, no summary, no
 * price, no consent. Each of those is refused by `recordExternalSession`'s signature
 * rather than by validation here, so a future route cannot pass one by accident.
 *
 * Content in a chart needs a named clinician who approved that exact text (§7's first
 * hard rule). A partner's server is not one, and no header or field makes it one.
 */
export async function POST(request: Request) {
  const guard = await withKey(request, "session:write");
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Send JSON.", 400);
  }

  const ref = body.subject;
  const email = body.clinician;
  const startedAt = body.started_at;
  const minutes = body.duration_minutes;
  const meetingId = body.meeting_id;

  if (
    typeof ref !== "string" ||
    typeof email !== "string" ||
    typeof startedAt !== "string" ||
    typeof minutes !== "number" ||
    typeof meetingId !== "string"
  ) {
    return fail(
      "Send subject, clinician, started_at, duration_minutes and meeting_id.",
      400,
    );
  }

  const result = await writeBackSession({
    key: guard.key,
    externalRef: ref,
    clinicianEmail: email,
    startedAt: new Date(startedAt),
    durationMinutes: minutes,
    externalMeetingId: meetingId,
  });

  if ("error" in result) return fail(result.error, result.status);

  /* 201, and the id is ours: a partner's next call about this session names it. */
  return NextResponse.json(result, { status: 201 });
}
