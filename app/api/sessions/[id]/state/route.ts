import { after, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { AuthorizationError, requireUserApi } from "@/lib/auth/guard";
import { autoEndSession, readSessionClock } from "@/lib/data/sessions";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { finishSession } from "@/lib/session-finish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Minimal room state, polled by the clinician's room only while it is waiting
 * for a patient to arrive on a video link.
 *
 * This is the entire "realtime" surface of the application. The old app ran a
 * Socket.io gateway with fourteen event types to deliver, among other things,
 * this one boolean — while the patient's own page was already polling every
 * four seconds anyway.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUserApi();
    const { id } = await params;

    const [row] = await db
      .select({
        status: sessions.status,
        patientJoinedAt: sessions.patientJoinedAt,
        guestName: sessions.guestName,
        noteStatus: sessions.noteStatus,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, id),
          eq(sessions.organizationId, actor.organizationId),
          eq(sessions.therapistId, actor.userId),
        ),
      )
      .limit(1);

    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

    /*
     * The clock rides on the poll the room is already making.
     *
     * The room computes the same ladder locally so the countdown ticks between
     * polls rather than jumping every five seconds — but this is the copy that
     * decides, because a client's own clock can be wrong and a browser tab that
     * has been asleep is wrong by however long it slept.
     */
    const clock = await readSessionClock(id);

    // Over the cap, or a room everybody left. Ended here rather than waiting
    // for a person, because the person is precisely what is missing.
    if (clock.shouldEnd && clock.endReason) {
      const ended = await autoEndSession(id, clock.endReason);
      if (ended.ended) {
        after(() =>
          finishSession({
            sessionId: id,
            organizationId: ended.organizationId!,
            therapistId: ended.therapistId!,
            patientId: ended.patientId ?? null,
          }),
        );
      }
    }

    return NextResponse.json({
      status: clock.shouldEnd ? "completed" : row.status,
      patientJoined: Boolean(row.patientJoinedAt),
      patientName: row.guestName,
      noteStatus: row.noteStatus,
      clock: {
        stage: clock.stage,
        elapsedSeconds: clock.elapsedSeconds,
        remainingSeconds: clock.remainingSeconds,
        extended: clock.extended,
        endReason: clock.endReason,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
