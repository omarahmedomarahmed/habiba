"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { generateAndStoreNote } from "@/lib/ai/notes";
import { audit, auditPhi } from "@/lib/audit";
import { requireUser, requireVerified } from "@/lib/auth/guard";
import { getConnectAccount, priceProblem } from "@/lib/billing/connect";
import { chargeForSession } from "@/lib/billing/service";
import { releaseBrief, sweepUnratedSessions } from "@/lib/data/feedback";
import { releaseClaim } from "@/lib/data/radar";
import {
  cancelSession,
  completeSession,
  createSession,
  getSession,
  startSession,
  TransitionError,
} from "@/lib/data/sessions";
import { db } from "@/lib/db";
import { patients, sessionNotes, sessions, type NoteContent } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { sendSessionInvite } from "@/lib/mail";
import { createPrivateRoom, deleteRoom } from "@/lib/video";
import { fullName } from "@/lib/utils";

export type SessionActionState = { error?: string; ok?: boolean; message?: string };

export async function startNewSession(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  // The one action that puts a real person in front of this clinician.
  const actor = await requireVerified();

  const modality = formData.get("modality") === "video" ? "video" : "in_person";
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestEmail = String(formData.get("guestEmail") ?? "").trim();
  const patientId = String(formData.get("patientId") ?? "").trim() || null;

  if (!patientId && !guestName) {
    return { error: "Enter a first name so the session has somewhere to go." };
  }

  // Only a video session can be paid for: an in-person session has no link to
  // put a paywall in front of.
  const priceDollars = Number(String(formData.get("priceDollars") ?? "0").trim() || "0");
  const priceCents = modality === "video" ? Math.round(priceDollars * 100) : 0;
  const problem = priceProblem(priceCents);
  if (problem) return { error: problem };

  if (priceCents > 0) {
    const connect = await getConnectAccount(actor.userId);
    if (!connect.chargesEnabled) {
      return { error: "Finish setting up payouts in Settings before charging for a session." };
    }
  }

  let sessionId: string;
  try {
    const session = await createSession(actor, {
      modality,
      patientId,
      guestName: guestName || undefined,
      guestEmail: guestEmail || undefined,
      priceCents,
    });
    sessionId = session.id;

    // Create the video room up front so the patient's link works the moment it
    // is sent, rather than only once the clinician presses Start. Whoever
    // arrives first should never find an empty room.
    if (modality === "video") {
      const room = await createPrivateRoom(session.id);
      if (room) {
        await db
          .update(sessions)
          .set({ videoRoomUrl: room.url, videoRoomName: room.name })
          .where(eq(sessions.id, session.id));
      }

      if (guestEmail) {
        const [fresh] = await db
          .select({ joinToken: sessions.joinToken })
          .from(sessions)
          .where(eq(sessions.id, session.id))
          .limit(1);
        if (fresh?.joinToken) {
          after(() =>
            sendSessionInvite({
              to: guestEmail,
              therapistName: fullName(actor.firstName, actor.lastName, "Your therapist"),
              joinUrl: `${env.appUrl}/join/${fresh.joinToken}`,
              priceCents,
            }),
          );
        }
      }
    }
  } catch (error) {
    log.error("session create failed", { reason: safeErrorMessage(error) });
    return { error: "Could not start the session. Please try again." };
  }

  redirect(`/sessions/${sessionId}/room`);
}

export async function goLive(sessionId: string): Promise<SessionActionState> {
  const actor = await requireUser();
  try {
    await startSession(actor, sessionId);
    /*
     * Recorded after the transition succeeds, never before.
     *
     * An audit line for something that then failed is worse than no line: it
     * puts an event in the record that did not happen, and the record's whole
     * value is that it did not need to be believed.
     */
    await audit({
      actor,
      category: "clinical",
      action: "session.start",
      resourceType: "session",
      resourceId: sessionId,
    });
    revalidatePath(`/sessions/${sessionId}/room`);
    return { ok: true };
  } catch (error) {
    if (error instanceof TransitionError) return { error: error.message };
    return { error: "Could not start the session." };
  }
}

/**
 * End the session.
 *
 * The response returns as soon as the status is written; note generation runs
 * in `after()`, which keeps the function alive past the response on a
 * serverless host. Without that, the work would be a floating promise on an
 * instance that is free to freeze the moment the response flushes — which is
 * how the old design lost notes on restart, with no job row to retry from.
 */
export async function endSession(sessionId: string): Promise<SessionActionState> {
  const actor = await requireUser();

  // Read the room name before completing, because completing clears the link.
  const existing = await getSession(actor, sessionId);
  const roomName = existing?.session.videoRoomName ?? null;

  let patientId: string | null = null;
  try {
    const result = await completeSession(actor, sessionId);

    await audit({
      actor,
      category: "clinical",
      action: "session.end",
      resourceType: "session",
      resourceId: sessionId,
    });
    patientId = result.patientId;
    if (result.alreadyCompleted) return { ok: true };
  } catch (error) {
    if (error instanceof TransitionError) return { error: error.message };
    return { error: "Could not end the session." };
  }

  const organizationId = actor.organizationId;
  const therapistId = actor.userId;

  after(async () => {
    // Ending the session must end the call for everyone, including a patient
    // still sitting in the room. Deleting the Daily room ejects every
    // participant, so the clinician never has to press Leave inside the video
    // UI as a separate step — and a patient cannot linger in a call for a
    // session that is already documented and closed.
    if (roomName) await deleteRoom(roomName);

    // Back on the radar, if this session came from one. Doing it here rather
    // than on a timer means the clinician is bookable again the instant they
    // are actually free.
    await releaseClaim(sessionId);

    await chargeForSession({ organizationId, sessionId });
    await generateAndStoreNote({ sessionId, organizationId, therapistId, patientId });
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  return { ok: true };
}

export async function abandonSession(sessionId: string): Promise<void> {
  const actor = await requireUser();
  await cancelSession(actor, sessionId);
  await releaseClaim(sessionId);
  revalidatePath("/sessions");
  redirect("/sessions");
}

/** Retry a failed generation without ending the session again. */
export async function regenerateNote(sessionId: string): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  await db
    .update(sessions)
    .set({ noteStatus: "generating", updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  const { organizationId, userId } = { organizationId: actor.organizationId, userId: actor.userId };
  after(() =>
    generateAndStoreNote({
      sessionId,
      organizationId,
      therapistId: userId,
      patientId: row.session.patientId,
    }),
  );

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

export async function saveNote(
  sessionId: string,
  content: NoteContent,
): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  await db
    .update(sessionNotes)
    .set({ content, updatedAt: new Date() })
    .where(eq(sessionNotes.sessionId, sessionId));

  await auditPhi(actor, "note.update", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, message: "Saved" };
}

/**
 * Sign the clinical record.
 *
 * This one is about the chart. It sends nothing, releases nothing and is
 * visible to no patient — it turns a machine's draft into a document the
 * clinician stands behind. Releasing the patient's copy is a separate decision
 * with a separate button; see `approvePatientNote`.
 */
export async function approveNote(sessionId: string): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  await db
    .update(sessionNotes)
    .set({ status: "approved", approvedAt: new Date(), approvedBy: actor.userId })
    .where(eq(sessionNotes.sessionId, sessionId));

  await auditPhi(actor, "note.approve", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/notes");
  return { ok: true, message: "Clinical note signed" };
}

/**
 * Edit what the patient will read.
 *
 * A separate action from `saveNote` and a deliberately narrow one: it can write
 * three fields and no others. The clinical record and the patient's copy live
 * in the same JSON blob, so a single "save the note" that took a whole
 * `NoteContent` would mean the patient-facing editor was, mechanically, able to
 * rewrite the assessment. This one cannot, whatever it is sent.
 */
export async function savePatientNote(
  sessionId: string,
  patch: { patientBrief: string; patientSteps: string[]; patientNext: string },
): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  const [note] = await db
    .select({ content: sessionNotes.content })
    .from(sessionNotes)
    .where(eq(sessionNotes.sessionId, sessionId))
    .limit(1);
  if (!note) return { error: "There is no note for this session yet." };

  await db
    .update(sessionNotes)
    .set({
      content: {
        ...note.content,
        patientBrief: patch.patientBrief.trim(),
        patientSteps: patch.patientSteps.map((s) => s.trim()).filter(Boolean).slice(0, 4),
        patientNext: patch.patientNext.trim(),
      },
      updatedAt: new Date(),
    })
    .where(eq(sessionNotes.sessionId, sessionId));

  await auditPhi(actor, "note.patient.update", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, message: "Saved" };
}

/**
 * Approve the patient's copy, and release it.
 *
 * The irreversible one. Everything up to here can be edited; the moment this
 * runs, a real person may be reading it on their phone thirty seconds later and
 * there is no unsending. That is exactly why it is not the same button as
 * signing the chart.
 *
 * The release itself only happens if they already asked for it. A patient who
 * rated the session before the clinician finished writing up has done their
 * part and is waiting; one who has not rated it yet gets an email saying their
 * summary is ready, and collects it through the link they already hold.
 *
 * Nothing here can send the clinical note — `releaseBrief` reads the three
 * patient-facing fields and nothing else.
 */
export async function approvePatientNote(sessionId: string): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  await db
    .update(sessionNotes)
    .set({
      patientStatus: "approved",
      patientApprovedAt: new Date(),
      patientApprovedBy: actor.userId,
    })
    .where(eq(sessionNotes.sessionId, sessionId));

  await auditPhi(actor, "note.patient.approve", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  after(async () => {
    try {
      const sent = await releaseBrief(sessionId);
      /*
       * If it could not go, tell them it is there.
       *
       * `releaseBrief` returns false when the patient has not rated the session
       * yet — which is most of the time, because the clinician usually writes
       * up after the patient has closed the tab. Without this, the summary sits
       * finished behind a gate nobody knows is open. The sweep would catch it
       * eventually; doing it here means it happens at the moment it becomes
       * true, and `ratingReminderAt` stops the two of them sending twice.
       */
      if (!sent) await sweepUnratedSessions(sessionId);
    } catch (error) {
      log.warn("brief release failed", { reason: safeErrorMessage(error) });
    }
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/notes");
  return { ok: true, message: "Approved — their summary is released" };
}

/*
 * There is no `shareReport` any more, and its absence is deliberate.
 *
 * It let a clinician email a session summary to any address they typed. That
 * is the easiest possible route for clinical text to leave the practice and
 * end up somewhere nobody can account for, and it existed as a single button.
 *
 * The patient pulls their own copy instead: they rate the session on the link
 * they already hold, give an address, and `releaseBrief` sends the
 * plain-language brief — never the SOAP note — to that address and no other.
 * A patient wanting their *full* record asks us, and an administrator sends it
 * to the address on their chart (see `lib/data/export.ts`).
 */

/**
 * Tell the server the microphone stopped, so the patient's screen can say so.
 *
 * Off-record was a purely client-side state: the recorder stopped uploading
 * and nothing else knew. The clinician pressed the button so the clinician
 * knows; the patient — the person whose words are being recorded, and who
 * agreed to it on that basis — had no way of seeing that it had changed. That
 * asymmetry is not acceptable in a room where consent is the whole basis of
 * the recording.
 */
export async function setRecordingPaused(
  sessionId: string,
  paused: boolean,
): Promise<{ ok: boolean }> {
  const actor = await requireUser();
  await db
    .update(sessions)
    .set({ recordingPausedAt: paused ? new Date() : null })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.therapistId, actor.userId),
      ),
    );

  await audit({
    actor,
    category: "clinical",
    action: paused ? "recording.pause" : "recording.resume",
    resourceType: "session",
    resourceId: sessionId,
  });
  return { ok: true };
}
