import { after, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { AuthorizationError, requireUserApi } from "@/lib/auth/guard";
import { autoEndSession, readSessionClock } from "@/lib/data/sessions";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { sessions } from "@/lib/db/schema";
import { finishSession } from "@/lib/session-finish";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/api/sessions/[id]/state/route.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
        /*
         * 🔴 76.35 — and whether they have stepped away from the screen without
         * leaving the call. See the column's own note: every other signal here
         * says present, because they are.
         */
        patientMinimisedAt: sessions.patientMinimisedAt,
        guestName: sessions.guestName,
        noteStatus: sessions.noteStatus,
        recordingConsent: sessions.recordingConsent,
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

    /*
     * 11.6 — the next booked appointment, on the poll the room already makes.
     *
     * A clinician running long has no way to know somebody is waiting at 19:00
     * unless we tell them inside the room. On this poll rather than its own,
     * for the reason the clock is: two timers on one screen that disagree is
     * worse than one that is five seconds stale.
     */
    const { upcomingBookings } = await import("@/lib/data/scheduling");
    const { bookingWarning } = await import("@/lib/scheduling/hours");
    const nextBooking = bookingWarning(await upcomingBookings(actor.userId), new Date());

    return NextResponse.json({
      status: clock.shouldEnd ? "completed" : row.status,
      patientJoined: Boolean(row.patientJoinedAt),
      /*
       * 🔴 76.35 — SECONDS, NOT A BOOLEAN, and the clinician's screen reads it
       * as a duration.
       *
       * "Stepped away four seconds ago" and "stepped away eleven minutes ago"
       * are different facts, and only the second is worth interrupting a
       * clinician about. Derived here rather than sent as a timestamp for the
       * same reason every other figure crosses this boundary formatted: the
       * browser's own clock can be wrong, and a tab that has been asleep is
       * wrong by however long it slept.
       */
      patientAwaySeconds: row.patientMinimisedAt
        ? Math.max(0, Math.floor((Date.now() - row.patientMinimisedAt.getTime()) / 1000))
        : null,
      patientName: row.guestName,
      noteStatus: row.noteStatus,
      /*
       * Task 123 — the room follows the patient's answer: a yes given on their
       * own screen turns it on, and a Stop or a no turns it off, within a poll.
       */
      recordingConsent: row.recordingConsent,
      nextBooking: nextBooking
        ? { minutes: nextBooking.minutes, startsAt: nextBooking.startsAt.toISOString() }
        : null,
      clock: {
        stage: clock.stage,
        elapsedSeconds: clock.elapsedSeconds,
        remainingSeconds: clock.remainingSeconds,
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
