import { NextResponse } from "next/server";

import { deliverableNote } from "@/lib/partner/api";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 55.8 — GET /api/partner/v1/notes/[sessionId]
 *
 * *A finished, clinician-approved note is pushed to their system. NEVER A DRAFT, NEVER
 * MODEL OUTPUT NOBODY SIGNED.*
 *
 * ## 🔴 PULLED, NOT PUSHED, AND THAT IS 42.4's DOING
 *
 * The ticket says "pushed", and the webhook is what tells them there is something to
 * collect. What crosses the wire in the push is an event and an id, because a leaked
 * webhook URL must leak nothing; the note itself is collected HERE, with a key we can
 * revoke, over a connection we authenticate.
 *
 * So the two tickets together describe one flow: `note.approved` goes out carrying an id,
 * and this route answers for it. Pushing the note in the webhook body would have been
 * simpler and would have put clinical content in a partner's proxy logs.
 *
 * 🔴 The approval condition is three columns in the WHERE clause of
 * `deliverableNote`, and the subject scope is a join rather than a check, so a key cannot
 * fetch a note by guessing a session id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const guard = await withKey(request, "note:deliver");
  if ("response" in guard) return guard.response;

  const { sessionId } = await params;

  const result = await deliverableNote({ key: guard.key, sessionId });
  if ("error" in result) return fail(result.error, result.status);

  return NextResponse.json(result);
}
