"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { generateAndStoreNote } from "@/lib/ai/notes";
import { audit, auditPhi } from "@/lib/audit";
import { requireUser, requireVerified } from "@/lib/auth/guard";
import { getConnectAccount, priceProblem } from "@/lib/billing/connect";
import { chargeForSession } from "@/lib/billing/service";
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
import { sendSessionInvite, sendSessionReport } from "@/lib/mail";
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
  return { ok: true, message: "Note approved" };
}

/**
 * Email the patient their summary.
 *
 * This is the last step of the product's own one-line pitch, and in the
 * previous codebase the endpoint existed with zero callers — no button anywhere
 * in the UI ever invoked it.
 */
export async function shareReport(
  sessionId: string,
  emailOverride?: string,
): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  const [note] = await db
    .select()
    .from(sessionNotes)
    .where(eq(sessionNotes.sessionId, sessionId))
    .limit(1);

  if (!note) return { error: "There is no note to share yet." };
  if (note.status !== "approved") {
    return { error: "Approve the note before sharing it." };
  }

  const to = (emailOverride || row.patient?.email || row.session.guestEmail || "").trim();
  if (!to) return { error: "Add an email address for this patient first." };

  const sent = await sendSessionReport({
    to,
    patientName: row.patient?.firstName ?? row.session.guestName ?? "there",
    therapistName: fullName(actor.firstName, actor.lastName, "Your therapist"),
    note: note.content,
    // The patient gets their report in the language they were spoken to in.
    language: note.language,
    sessionDate: row.session.endedAt ?? row.session.createdAt,
  });

  if (!sent) return { error: "Could not send the email. Check the address and try again." };

  await db
    .update(sessions)
    .set({ reportSentAt: new Date() })
    .where(eq(sessions.id, sessionId));

  // Remember the address so it does not have to be typed twice.
  if (emailOverride && row.session.patientId) {
    await db
      .update(patients)
      .set({ email: to.toLowerCase() })
      .where(eq(patients.id, row.session.patientId));
  }

  await audit({
    actor,
    category: "phi_access",
    action: "report.share",
    resourceType: "session",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  log.info("session report shared", { session: ref(sessionId) });
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, message: `Sent to ${to}` };
}
