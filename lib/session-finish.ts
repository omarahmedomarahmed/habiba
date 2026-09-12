import "server-only";

import { eq } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { sessions } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/session-finish.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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

  /*
   * 🔴 35.1 — before the note, because an alert is time-critical and a note is
   * not.
   *
   * The keyword scanner has always run inside the transcript write, line by
   * line, and still does (35.2). This is the session-level pass: a classifier
   * reading the whole conversation, which can see a plan built across four
   * turns that no single line contains.
   *
   * It runs here rather than in the transcript path for the reason
   * `lib/crisis/alerts.ts` gives: a person writing at 3am is not waiting on an
   * inference call to find out whether their sentence saved.
   */
  await step("risk", async () => {
    const { assessSessionRisk } = await import("@/lib/data/session-risk");
    await assessSessionRisk({
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      therapistId: opts.therapistId,
      patientId: opts.patientId,
    });
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
