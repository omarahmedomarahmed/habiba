import { NextResponse } from "next/server";

import { endSession } from "@/lib/partner/platform";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-X02 — POST /api/partner/v1/sessions/[ref]/end
 *
 * *The session is over.* Their platform knows when a session ends and we do not:
 * the room is theirs. Until this call the session is live, its transcript may
 * still be arriving, and the copilot and the memory do not read it (C211).
 *
 * ## 🔴 `session:media`, AND IT IS THE ONE ROUTE THAT SHARES A SCOPE
 *
 * The key that sends the audio is the key that says the audio has stopped. A scope
 * of its own would be one nobody could use without the other, a checkbox that
 * means nothing.
 *
 * ### Response
 *
 * ```json
 * { "session": "S-1024", "ended_at": "2026-09-14T11:30:00Z" }
 * ```
 *
 * Idempotent: a second call answers with the first time.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "session:media");
  if ("response" in guard) return guard.response;

  const { ref } = await params;

  const ended = await endSession({ partnerId: guard.key.partnerId, externalSessionRef: ref });
  if (!ended) return fail("We have no session with that reference.", 404);

  return NextResponse.json({ session: ref, ended_at: ended.endedAt.toISOString() });
}
