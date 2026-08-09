import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { AuthorizationError, requireUserApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

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

    return NextResponse.json({
      status: row.status,
      patientJoined: Boolean(row.patientJoinedAt),
      patientName: row.guestName,
      noteStatus: row.noteStatus,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
