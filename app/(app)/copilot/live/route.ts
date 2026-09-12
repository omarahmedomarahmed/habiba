import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/guard";
import { liveSessionForPatient } from "@/lib/data/sessions";

export const dynamic = "force-dynamic";

/**
 * Is this patient in a session right now? PLAN.md 48.9.
 *
 * ## Polling, not websockets
 *
 * The founder's ruling, and it holds on its own terms: this is one clinician's
 * own screen refreshing a boolean about their own caseload. A websocket would
 * be a connection to keep alive, authenticate, reconnect and reason about for
 * the rest of the product's life, in exchange for latency nobody can perceive
 * on a question whose answer changes twice an hour.
 *
 * ## It returns a boolean and an id, and nothing else
 *
 * Deliberately not the session, the patient, or anything about either. The
 * caller already knows which patient it asked about; what it does not know is
 * whether a room is open. `liveSessionForPatient` is scoped to the actor's own
 * caseload and bounded by the session clock (C224), so this cannot be used to
 * learn that somebody else's patient is in a session, and a room left open
 * does not report live forever.
 */
export async function GET(request: Request) {
  const actor = await requireUserApi();
  const patientId = new URL(request.url).searchParams.get("patient");

  if (!patientId) {
    return NextResponse.json({ live: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const live = await liveSessionForPatient(actor, patientId);

  return NextResponse.json(
    { live: Boolean(live), sessionId: live?.id ?? null },
    // A cached answer to "is somebody in a session" is worse than no answer.
    { headers: { "Cache-Control": "no-store" } },
  );
}
