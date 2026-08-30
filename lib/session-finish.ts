import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * Everything that has to happen after a session stops, wherever it stopped.
 *
 * There are three ways a session ends now — the clinician presses End, the
 * fifty-minute cap runs out, or the room goes quiet after the paid time — and
 * before this existed only the first one closed the video room, released the
 * radar slot, raised the bill and wrote the note. A session that timed out
 * would have left the clinician marked as in-session on the public radar, with
 * a Daily room still open and no note, indefinitely.
 *
 * One function, called from all three, so the list cannot drift.
 *
 * Every step is independently guarded. A failure to delete a video room must
 * not stop the note being written, and a failure to write the note must not
 * leave the clinician stuck off the radar — these are five unrelated systems
 * and the session is already over.
 */
export async function finishSession(opts: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  /** Read before completing, because completing clears the link. */
  roomName?: string | null;
}): Promise<void> {
  const step = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      log.error("session finish step failed", {
        session: ref(opts.sessionId),
        step: what,
        reason: safeErrorMessage(error),
      });
    }
  };

  // Ending the session must end the call for everyone, including a patient
  // still sitting in the room. Deleting the Daily room ejects every
  // participant, so a patient cannot linger in a call for a session that is
  // already documented and closed.
  await step("room", async () => {
    const roomName = opts.roomName ?? (await roomNameFor(opts.sessionId));
    if (!roomName) return;
    const { deleteRoom } = await import("@/lib/video");
    await deleteRoom(roomName);
  });

  // Back on the radar, if this session came from one. Doing it here rather than
  // on a timer means the clinician is bookable again the instant they are free.
  await step("radar", async () => {
    const { releaseClaim } = await import("@/lib/data/radar");
    await releaseClaim(opts.sessionId);
  });

  await step("billing", async () => {
    const { chargeForSession } = await import("@/lib/billing/service");
    await chargeForSession({ organizationId: opts.organizationId, sessionId: opts.sessionId });

    // And pay it out of anything we are already holding for them — a clinician
    // mid-verification is the one most likely to have both an unpaid bill and
    // money they cannot reach.
    const { settleInvoicesFromHeld } = await import("@/lib/billing/connect");
    await settleInvoicesFromHeld(opts.therapistId);
  });

  await step("note", async () => {
    const { generateAndStoreNote } = await import("@/lib/ai/notes");
    await generateAndStoreNote({
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      therapistId: opts.therapistId,
      patientId: opts.patientId,
    });
  });
}

async function roomNameFor(sessionId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: sessions.videoRoomName })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return row?.name ?? null;
}
