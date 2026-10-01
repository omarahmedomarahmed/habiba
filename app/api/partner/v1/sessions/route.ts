import { NextResponse } from "next/server";

import { writeBackSession } from "@/lib/partner/api";
import { readSessionBody } from "@/lib/partner/bodies";
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

  /* DD-2: read by the same function the docs' example is tested against. */
  const read = readSessionBody(body);
  if (!read.ok) return fail(read.error, 400);

  const result = await writeBackSession({
    key: guard.key,
    externalRef: read.value.subject,
    clinicianEmail: read.value.clinician,
    startedAt: read.value.startedAt,
    durationMinutes: read.value.durationMinutes,
    externalMeetingId: read.value.meetingId,
  });

  if ("error" in result) return fail(result.error, result.status);

  /* 201, and the id is ours: a partner's next call about this session names it. */
  return NextResponse.json(result, { status: 201 });
}
