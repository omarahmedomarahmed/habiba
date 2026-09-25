"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";

import { draftNoteInFormat, generateAndStoreNote } from "@/lib/ai/notes";
import { emptyContent } from "@/lib/notes/formats";
import { audit, auditPhi } from "@/lib/audit";
import { requireUser, requireVerified } from "@/lib/auth/guard";
import { priceProblem } from "@/lib/billing/connect";
import { getSettings } from "@/lib/settings";
import { releaseBrief, sweepUnratedSessions } from "@/lib/data/feedback";
import { createInviteLink } from "@/app/(app)/patients/actions";
import { normalisePhone, personIdForPatient } from "@/lib/data/people";
import { publishSummary } from "@/lib/data/summaries";
import {
  addAddendum,
  releasePatientCopy,
  saveClinicalNote,
  savePatientCopy,
  signNote,
  type NoteRefusal,
} from "@/lib/data/note-record";
import { getI18n } from "@/lib/i18n/server";
import { releaseClaim } from "@/lib/data/radar";
import {
  cancelSession,
  completeSession,
  createSession,
  getSession,
  startSession,
  TransitionError,
} from "@/lib/data/sessions";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  NOTE_LANGUAGES,
  patients,
  sessionNotes,
  sessions,
  users,
  type NoteAddendumKind,
  type NoteContent,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { RECORDING_CONSENT_VERSION } from "@/lib/consent";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { sendSessionInvite } from "@/lib/mail";
import { finishSession } from "@/lib/session-finish";
import { cleanCancelReason } from "@/lib/sessions/cancel-reason";
import { createPrivateRoom, roomFailureText, type RoomInfo } from "@/lib/video";
import { fullName } from "@/lib/utils";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/sessions/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export type SessionActionState = { error?: string; ok?: boolean; message?: string };

export async function startNewSession(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  // The one action that puts a real person in front of this clinician.
  const actor = await requireVerified();

  /*
   * 🔴 41.2 — "Where", which subsumes the old two-way modality toggle.
   *
   * `where` is a `SESSION_SOURCE_KIND`: the 24Therapy room, one of the three
   * meeting providers, or in person. `modality` is derived from it rather than
   * asked separately, because a clinician answering both would eventually
   * answer them inconsistently, and every downstream rule — pricing, the
   * paywall, the room — reads `modality`.
   *
   * `upload` is a kind of `session_sources` and deliberately NOT an option
   * here: it is the third door of 36.2, reached by issuing a credential on an
   * existing session, not by choosing it in advance.
   */
  const whereRaw = String(formData.get("where") ?? "").trim();
  const where = (
    ["24t_room", "zoom", "google_meet", "teams", "in_person"] as const
  ).includes(whereRaw as never)
    ? (whereRaw as "24t_room" | "zoom" | "google_meet" | "teams" | "in_person")
    : formData.get("modality") === "video"
      ? "24t_room"
      : "in_person";

  const modality = where === "in_person" ? "in_person" : "video";

  /*
   * 41.2 — the Record tick. Default ON, because transcription is why most
   * clinicians are here and a default that silently loses a session's note is
   * worse than one they have to untick.
   *
   * 🔴 It does not decide whether to record. The PATIENT decides, on their own
   * screen, and 41.8 dispatches the bot on their answer and nothing else. What
   * this decides is whether we ask at all: a clinician who knows this session
   * should not be transcribed should not have their patient asked a question
   * whose answer will be ignored.
   */
  const transcribe = formData.get("transcribe") !== "off";
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestEmail = String(formData.get("guestEmail") ?? "").trim();
  const guestPhone = String(formData.get("guestPhone") ?? "").trim();
  const patientId = String(formData.get("patientId") ?? "").trim() || null;

  if (!patientId && !guestName) {
    return { error: "Enter a first name so the session has somewhere to go." };
  }

  /*
   * 🔴 RULINGS 5 AND 5b: IN PERSON, TWO WAYS TO BE PAID.
   *
   * "direct" is the patient paying the therapist in the room, as today: free
   * through us, price zero, the session starts now. "through_us" is the patient
   * paying on their own phone, card or company benefit, before the session can
   * start (pay before start). It carries the therapist's price, which may be
   * lowered and never raised above what they list, so a company's money cannot
   * be drawn down by typing a bigger number.
   */
  const inPersonPaid = modality === "in_person" && formData.get("inPersonPayment") === "through_us";
  const settingsNow = await getSettings();
  if (inPersonPaid && !settingsNow.rules.inPerson.payThroughUs) {
    return { error: "Charging an in-person session through 24Therapy is switched off." };
  }

  /*
   * 🔴 Typed in pounds, kept in dollars at the operator's rate: the same rate
   * the payment is then asked for at, so the patient pays the pounds typed.
   */
  const pounds = Number(String(formData.get("pricePounds") ?? "0").trim() || "0");
  const { egpRateMicro } = await import("@/lib/billing/manual");
  const { usdCentsFor } = await import("@/lib/money/convert");
  const rate = await egpRateMicro();
  const priceCents =
    (modality === "video" || inPersonPaid) && Number.isFinite(pounds) && pounds > 0 && rate > 0
      ? usdCentsFor(Math.round(pounds * 100), rate)
      : 0;
  if (inPersonPaid && priceCents <= 0) return { error: "Enter the price the patient pays." };
  const problem = priceProblem(priceCents, settingsNow.session, rate);
  if (problem) return { error: problem };
  if (inPersonPaid && !settingsNow.rules.inPerson.priceAboveList) {
    const [me] = await db
      .select({ rate: users.sessionRateCents })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);
    if (!me?.rate) return { error: "Set your price per session in Settings first." };
    /* A cent of rounding either way is the rate, not a raise. */
    if (priceCents > me.rate + 1) return { error: "That is above your price per session. You can lower it, never raise it." };
  }

  /*
   * A price no longer waits on Stripe.
   *
   * This used to refuse any paid session until the clinician's connected
   * account was live, which reads as prudent and is actually the product
   * refusing to let somebody work. Verification takes anywhere from minutes to
   * days and is entirely outside their control; meanwhile the session in front
   * of them is happening now.
   *
   * The payment is captured either way — see `createSessionPaymentCheckout`.
   * What changes is where it lands, and if it has to land with us we hold it,
   * say so, and release it the moment Stripe is done.
   */

  /*
   * 🔴 79.1 — THE ROOM IS BUILT BEFORE ANYTHING ELSE IS, AND A FAILURE STOPS
   * HERE.
   *
   * ## What this replaces, and what it cost
   *
   * The room used to be created after the session, the chart and the meeting,
   * like this:
   *
   *     const room = await createPrivateRoom(session.id);
   *     if (room) { save the url }
   *     if (guestEmail) { send the invite }
   *
   * There is no `else`. `createPrivateRoom` returned null on a missing API key
   * and that branch simply did not run, so the session was created with a null
   * `video_room_url`, **the invitation went out anyway**, and the patient was
   * emailed a link to a room nobody had built. Both people clicked it, both
   * landed in the same session record, and neither could hear the other. That
   * is not a degraded session, it is the product telling somebody to attend an
   * appointment it knows does not exist.
   *
   * It shipped that way on production, where `DAILY_API_KEY` was never set.
   *
   * ## Why it moved to the top rather than growing an `else`
   *
   * An `else` down there fires after the chart has been created, so a clinician
   * who retries makes a second chart for the same person. Up here nothing has
   * been written yet: the check costs one request, and a failure returns a
   * sentence rather than a half-made session with somebody's name on it.
   *
   * The room is made without a session id because there is no session yet,
   * which is the point.
   */
  let room: RoomInfo | null = null;
  if (where === "24t_room" && modality === "video") {
    const made = await createPrivateRoom("pre-session");
    if (!made.ok) {
      return {
        error:
          `${roomFailureText(made.reason)} ` +
          "Nobody has been invited. Start this session in person, or try again once it is fixed.",
      };
    }
    room = made.room;
  }

  let sessionId: string;
  /** Set only when this call created the chart, so an existing patient is never re-invited. */
  let newPatientId: string | null = null;
  /** 41.2 — the clinician's own link, when the session is in somebody else's product. */
  let externalJoinUrl: string | null = null;
  try {
    const session = await createSession(actor, {
      modality,
      patientId,
      guestName: guestName || undefined,
      guestEmail: guestEmail || undefined,
      guestPhone: guestPhone || undefined,
      priceCents,
      inPersonPaid,
    });
    if (!session) return { error: "That patient is not in your practice." };
    sessionId = session.id;
    if (!patientId && session.patientId) newPatientId = session.patientId;

    /*
     * 🔴 41.1 / 41.2 — the meeting, created inside THEIR account, by US.
     *
     * > *Whoever creates the meeting holds the link, and a therapist holding
     * > it will eventually send it straight to the patient, not maliciously
     * > but because it is one fewer step on a busy afternoon. The consent
     * > screen then never happens.*
     *
     * `setSessionSource` is what makes it ours: the external kinds require
     * `provisioned_at` and `provisioned_by_user_id`, enforced in 0064, and
     * 0071 refuses a bot on a row without them. So a session recorded in Zoom
     * is one we made, and there is no column anywhere that could hold a link a
     * clinician pasted.
     *
     * A failure here falls back to the 24Therapy room rather than failing the
     * session. The clinician has a patient in front of them; a connection that
     * has expired is our problem to surface later, not a reason they cannot
     * work.
     */
    if (where !== "in_person" && where !== "24t_room") {
      const { createMeeting } = await import("@/lib/meetings/create");
      const { setSessionSource } = await import("@/lib/data/session-sources");

      const made = await createMeeting({
        userId: actor.userId,
        provider: where,
        /*
         * 🔴 Never the patient's name. A meeting titled "Session with Sara
         * Ahmed" puts a patient's name into a calendar entry, a notification
         * and every participant list the provider renders.
         */
        topic: "24Therapy session",
      });

      if (made.ok) {
        await setSessionSource({
          sessionId: session.id,
          organizationId: actor.organizationId,
          patientId: session.patientId ?? null,
          kind: where,
          provisioned: { externalMeetingId: made.meeting.joinUrl, byUserId: actor.userId },
        });
        externalJoinUrl = made.meeting.joinUrl;
      } else {
        log.warn("meeting creation fell back to the 24Therapy room", { provider: where });
      }
    }

    /*
     * 41.2 — the clinician said not to transcribe this one.
     *
     * The same switch the off-record button uses, set at creation. It is what
     * `answerConsent` and the transcript webhook both already read, so one
     * stamp turns the whole path off rather than a second flag every future
     * call site has to remember.
     */
    if (!transcribe) {
      await db
        .update(sessions)
        .set({ recordingPausedAt: new Date() })
        .where(eq(sessions.id, session.id));
    }

    // Create the video room up front so the patient's link works the moment it
    // is sent, rather than only once the clinician presses Start. Whoever
    // arrives first should never find an empty room.
    if (modality === "video" && !externalJoinUrl) {
      /*
       * 🔴 The room was built above, before anything existed, so there is
       * nothing to check here and no branch that can skip it. If we got this
       * far a room exists, which is the whole property: an invitation is only
       * ever sent for a door that opens.
       */
      if (room) {
        await db
          .update(sessions)
          .set({ videoRoomUrl: room.url, videoRoomName: room.name, videoRoomExpiresAt: room.expiresAt })
          .where(eq(sessions.id, session.id));
      }

      if (guestEmail) {
        const [fresh] = await db
          .select({ joinToken: sessions.joinToken })
          .from(sessions)
          .where(eq(sessions.id, session.id))
          .limit(1);
        if (fresh?.joinToken) {
          after(async () => {
            /* 🔴 Ruling 8: in the patient's language when they have a record here. */
            const { wordsFor } = await import("@/lib/i18n/message-words");
            const { personIdForPatient } = await import("@/lib/data/people");
            const chart = patientId || newPatientId;
            const personId = chart ? await personIdForPatient(chart) : null;
            const words = await wordsFor(personId ? { personId } : null);
            await sendSessionInvite({
              to: guestEmail,
              therapistName: fullName(actor.firstName, actor.lastName, "") || words.t("pmsg.yourTherapist"),
              joinUrl: `${env.appUrl}/join/${fresh.joinToken}`,
              priceCents,
              locale: words.locale,
            });
          });
        }
      }
    }
  } catch (error) {
    log.error("session create failed", { reason: safeErrorMessage(error) });
    return { error: "Could not start the session. Please try again." };
  }

  /*
   * 🔴 25.18 — the invite goes NOW, not from a second screen.
   *
   * Both halves of this already existed and were two pages apart: the chart is
   * created above, and `createInviteLink` is the thing that makes the record
   * the patient's own. A clinician starting a session with somebody new had to
   * remember to walk to the patient page afterwards and press a second button,
   * which is why most records were never handed over.
   *
   * Awaited rather than deferred to `after()`, because it reads the caller's
   * session, and because a send that silently failed after the response would
   * be invisible. `createInviteLink` reports whether it arrived rather than
   * assuming; a failure here is logged and does not block the session, since
   * the clinician can still send it from the patient page and the person in
   * front of them is waiting.
   */
  if (newPatientId && normalisePhone(guestPhone)) {
    const invited = await createInviteLink(newPatientId);
    if ("error" in invited) {
      log.warn("session invite not sent", { session: ref(sessionId), reason: invited.error });
    }
  }

  /* 🔴 Pay before start: an in-person session paid through us waits on its payment screen. */
  if (inPersonPaid) redirect(`/sessions/${sessionId}/collect`);
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

  /*
   * One tail, shared with the two ways a session ends without anybody pressing
   * this button.
   *
   * It used to be written out here, which meant the fifty-minute cap and the
   * empty-room timeout would have skipped all of it: the video room left open,
   * the clinician still marked in-session on the public radar, no bill, no
   * note. See `lib/session-finish.ts`.
   */
  after(() => finishSession({ sessionId, organizationId, therapistId, patientId, roomName }));

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  return { ok: true };
}

/**
 * 🔴 W1-13: a reason is required, and a session that really was cancelled is
 * followed by `afterClinicianCancel`: the patient is told why and any payment
 * goes back. This used to cancel and stop.
 */
export async function abandonSession(
  sessionId: string,
  reasonText: string,
): Promise<{ error?: string }> {
  const actor = await requireUser();

  const reason = cleanCancelReason(reasonText);
  if (!reason) {
    const { getI18n } = await import("@/lib/i18n/server");
    return { error: (await getI18n()).t("tcancel.reasonNeeded") };
  }

  if (await cancelSession(actor, sessionId)) {
    const { afterClinicianCancel } = await import("@/lib/data/clinician-cancel");
    await afterClinicianCancel({ actorUserId: actor.userId, sessionId, reason });
  }
  await releaseClaim(sessionId);
  revalidatePath("/sessions");
  redirect("/sessions");
}

/**
 * Retry a failed generation without ending the session again, or (W2-T04)
 * redraft a draft after the voices or the lines were put right.
 *
 * The session's own note runs as it always has, after the response, with the
 * page polling. 🔴 W2-F01: another format's note is redrafted in place, awaited,
 * so the rest of the session's notes stay on screen while it is written.
 */
export async function regenerateNote(
  sessionId: string,
  noteId?: string | null,
): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  if (noteId) {
    const [note] = await db
      .select({ format: sessionNotes.format, isPrimary: sessionNotes.isPrimary })
      .from(sessionNotes)
      .where(and(eq(sessionNotes.id, noteId), eq(sessionNotes.sessionId, sessionId)))
      .limit(1);
    if (note && !note.isPrimary) {
      return draftIn(actor, row, note.format);
    }
  }

  /*
   * 🔴 T17: A SIGNED PRIMARY NOTE IS NOT REGENERATED, AND THE REFUSAL IS HERE, FIRST.
   *
   * W1-03 kept a regeneration off a signed chart at the upsert, and that was the
   * only place it held: the new summary still went on into the copilot thread
   * (`recordSessionNote`) and the rolling profile (`regenerateProfile`), so the
   * patient's standing record learned a version of the session the clinician
   * never signed, and the session flipped to "generating" over a finished note.
   *
   * Refused before anything is written or any model is called. Either half signed
   * means the words are the clinician's; a change after that is an addendum, and
   * the sentence says so with the same words the note screen already uses.
   * `generateAndStoreNote` refuses the same state again for any other caller.
   */
  const [primary] = await db
    .select({ status: sessionNotes.status, patientStatus: sessionNotes.patientStatus })
    .from(sessionNotes)
    .where(and(eq(sessionNotes.sessionId, sessionId), eq(sessionNotes.isPrimary, true)))
    .limit(1);
  if (primary && (primary.status !== "draft" || primary.patientStatus !== "draft")) {
    return {
      error: await refusalText("locked", primary.status !== "draft" ? "clinical" : "patient"),
    };
  }

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

/**
 * 🔴 Task 123 — a note the clinician writes themselves, where there is nothing
 * for the machine to write from.
 *
 * A session the patient declined to have recorded ends with no transcript, and
 * the page used to say "The note could not be written… try again" beside a
 * button that could never succeed: a patient's no read as the AI breaking. The
 * clinician's own account is what every record was before recordings, so this
 * starts one: an empty draft, badged `clinician`, for them to fill in and sign.
 */
export async function startOwnNote(sessionId: string): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  /*
   * 🔴 W2-F01 / D7: the empty sections of the clinician's own format. A
   * session that already has a note keeps it: `ON CONFLICT DO NOTHING` covers
   * both the format and the one-primary index.
   */
  const { formatsFor } = await import("@/lib/data/note-formats");
  const { defaultFormat } = await formatsFor(row.session.organizationId, row.session.therapistId);
  await db
    .insert(sessionNotes)
    .values({
      sessionId,
      organizationId: row.session.organizationId,
      therapistId: row.session.therapistId,
      patientId: row.session.patientId,
      content: emptyContent(defaultFormat),
      status: "draft",
      provenance: "clinician",
      format: defaultFormat.key,
    })
    .onConflictDoNothing();

  await db
    .update(sessions)
    .set({ noteStatus: "ready", updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  await auditPhi(actor, "note.update", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * 🔴 W2-F01 / D7: "Also write it as...". The same session in another format,
 * its own document with its own signature. Included in the session price: it
 * writes a note and nothing that bills (see `draftNoteInFormat`).
 *
 * A format the session already has is opened, never redrafted from here: a
 * clinician's edits to a draft are not written over by a menu.
 */
export async function alsoWriteNote(
  sessionId: string,
  formatKey: string,
): Promise<SessionActionState & { noteId?: string }> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };
  if (row.session.status !== "completed") return { error: "Session not found." };

  const { formatFor } = await import("@/lib/data/note-formats");
  const format = await formatFor(actor.organizationId, actor.userId, formatKey);

  const [existing] = await db
    .select({ id: sessionNotes.id })
    .from(sessionNotes)
    .where(and(eq(sessionNotes.sessionId, sessionId), eq(sessionNotes.format, format.key)))
    .limit(1);
  if (existing) return { ok: true, noteId: existing.id };

  return draftIn(actor, row, format.key);
}

/** Draft (or redraft) one of the session's other formats, awaited. */
async function draftIn(
  actor: Awaited<ReturnType<typeof requireUser>>,
  row: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  formatKey: string,
): Promise<SessionActionState & { noteId?: string }> {
  const { formatFor } = await import("@/lib/data/note-formats");
  const format = await formatFor(row.session.organizationId, row.session.therapistId, formatKey);
  try {
    const { noteId } = await draftNoteInFormat({
      sessionId: row.session.id,
      organizationId: row.session.organizationId,
      therapistId: row.session.therapistId,
      patientId: row.session.patientId,
      format,
    });
    await auditPhi(actor, "note.update", {
      resourceType: "note",
      resourceId: row.session.id,
      patientId: row.session.patientId,
    });
    revalidatePath(`/sessions/${row.session.id}`);
    return { ok: true, noteId: noteId ?? undefined };
  } catch (error) {
    log.warn("note in another format failed", {
      session: ref(row.session.id),
      reason: safeErrorMessage(error),
    });
    const { t } = await getI18n();
    return { error: t("tnote.failed") };
  }
}

export async function saveNote(
  sessionId: string,
  content: NoteContent,
  noteId?: string | null,
): Promise<SessionActionState> {
  const actor = await requireUser();
  const result = await saveClinicalNote(actor, sessionId, content, noteId);
  if (!result.ok) return { error: await refusalText(result.reason, "clinical") };

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, message: "Saved" };
}

/**
 * 🔴 W1-03: the sentence for a refused note write. The two old English
 * strings are kept as they were; the lock is new text, so it is translated.
 */
async function refusalText(reason: NoteRefusal, kind: NoteAddendumKind): Promise<string> {
  if (reason === "not_found") return "Session not found.";
  if (reason === "no_note") return "There is no note for this session yet.";
  const { t } = await getI18n();
  if (reason === "locked") return t(kind === "clinical" ? "tnote.lockedNote" : "tnote.lockedCopy");
  if (reason === "not_signed") return t("tnote.addendumNotSigned");
  return t("tnote.addendumEmpty");
}

/**
 * 🔴 W1-03 / P4: a change after signing. Kept under the note for ever, with
 * the author's name and the time, and never edited.
 */
export async function addNoteAddendum(
  sessionId: string,
  kind: NoteAddendumKind,
  body: string,
  noteId?: string | null,
): Promise<SessionActionState> {
  const actor = await requireUser();
  const which = kind === "patient" ? "patient" : "clinical";
  const result = await addAddendum(actor, sessionId, which, body, noteId);
  if (!result.ok) return { error: await refusalText(result.reason, which) };

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * Sign the clinical record.
 *
 * This one is about the chart. It sends nothing, releases nothing and is
 * visible to no patient — it turns a machine's draft into a document the
 * clinician stands behind. Releasing the patient's copy is a separate decision
 * with a separate button; see `approvePatientNote`.
 */
export async function approveNote(
  sessionId: string,
  noteId?: string | null,
): Promise<SessionActionState> {
  const actor = await requireUser();
  /* 🔴 W2-F01: the note named, in this session, or the session's own. */
  const result = await signNote(actor, sessionId, noteId);
  if (!result.ok) return { error: await refusalText(result.reason, "clinical") };

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
  const result = await savePatientCopy(actor, sessionId, patch);
  if (!result.ok) return { error: await refusalText(result.reason, "patient") };

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
  /* 🔴 W2-F01: one copy per session, on its primary note, whatever the formats. */
  const result = await releasePatientCopy(actor, sessionId);
  if (!result.ok) return { error: await refusalText(result.reason, "patient") };

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
  return { ok: true, message: "Approved. Their summary is released" };
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
 * 🔴 TASK 123 — the in-person answer, given by the patient on the clinician's
 * screen.
 *
 * In person there is no join form, so nobody was ever asked: the room
 * recorded and transcribed with `recording_consent` NULL. Now the room stays
 * off record until this is answered (`mayRecord`), and the clinician turns the
 * screen towards the patient, who presses one of two buttons in their own
 * words. The first answer stands, except that a no may always follow a yes,
 * which is `answerConsent`'s rule for the join form.
 */
export async function answerInPersonConsent(
  sessionId: string,
  consent: "granted" | "declined",
): Promise<{ ok: boolean; consent: "granted" | "declined" | null }> {
  const actor = await requireUser();
  const now = new Date();
  const [landed] = await db
    .update(sessions)
    .set({
      recordingConsent: consent,
      recordingConsentAt: now,
      recordingConsentVersion: RECORDING_CONSENT_VERSION,
      ...(consent === "granted"
        ? { recordingPausedAt: null, recordingStartedAt: now }
        : { recordingPausedAt: now }),
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.therapistId, actor.userId),
        eq(sessions.modality, "in_person"),
        consent === "granted"
          ? isNull(sessions.recordingConsent)
          : sql`${sessions.recordingConsent} IS DISTINCT FROM 'declined'`,
      ),
    )
    .returning({ consent: sessions.recordingConsent });

  if (landed) {
    await audit({
      actor,
      category: "clinical",
      action: consent === "granted" ? "recording.consent.in_person" : "recording.decline.in_person",
      resourceType: "session",
      resourceId: sessionId,
    });
  }

  const [row] = await db
    .select({ consent: sessions.recordingConsent })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.therapistId, actor.userId),
      ),
    )
    .limit(1);
  return { ok: Boolean(landed), consent: row?.consent ?? null };
}

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
  /*
   * 🔴 W1-06: `ok` is whether the row changed. It was `true` whatever
   * happened, and the room now reverts on a refusal, so the answer has to be
   * the database's.
   */
  const landed = await db
    .update(sessions)
    .set({ recordingPausedAt: paused ? new Date() : null })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.therapistId, actor.userId),
        /*
         * 🔴 Task 123 — Resume is only a clinician's to press over their OWN
         * pause. Without a standing yes (never asked, declined, or the
         * patient's Stop) it clears nothing, so the patient's screen never
         * says "recording" when `mayRecord` would refuse the audio anyway.
         */
        paused ? undefined : eq(sessions.recordingConsent, "granted"),
      ),
    )
    .returning({ id: sessions.id });

  if (landed.length === 0) return { ok: false };

  await audit({
    actor,
    category: "clinical",
    action: paused ? "recording.pause" : "recording.resume",
    resourceType: "session",
    resourceId: sessionId,
  });
  return { ok: true };
}

/**
 * Pin the language this session is being spoken in.
 *
 * `null` hands the decision back to the model, which is the right default and
 * was, until this existed, not what happened: every request carried a
 * hardcoded `language: "en"`, so an Arabic session was transcribed by a model
 * that had been told the audio was English. That is the whole reason a
 * clinician working in Arabic saw a transcript of near-words.
 *
 * Pinning matters beyond fixing that. Chunks are eight seconds and transcribed
 * independently, so detection re-runs on every one of them; a chunk that is
 * mostly a pause detects as anything, and a transcript whose language changes
 * every third line is harder to read than one that is wrong in a steady
 * direction. A bilingual clinician sets this once and the session holds it.
 *
 * Takes effect on the next chunk. Nothing already transcribed is rewritten —
 * re-running finished audio through a second model would produce two versions
 * of what somebody said, and there is no honest way to choose between them in
 * a clinical record.
 */
export async function setTranscriptLanguage(
  sessionId: string,
  language: string | null,
): Promise<{ ok: boolean }> {
  const actor = await requireUser();

  // Validated against the same closed set the notes use, so a value that would
  // fail the transcription request can never reach the column.
  const base = (language ?? "").trim().toLowerCase().split(/[-_]/)[0];
  const next = base && base !== "auto" && base in NOTE_LANGUAGES ? base : null;

  await db
    .update(sessions)
    .set({ transcriptLanguage: next })
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
    action: "session.transcript_language",
    resourceType: "session",
    resourceId: sessionId,
    reason: next ?? "auto",
  });
  return { ok: true };
}

/* --------------------------------------------- 26.3 · C112 · one approval */

export type ApprovalChoice = {
  /** Sign the chart. */
  clinical: boolean;
  /** Release the patient's copy. Irreversible. */
  patient: boolean;
  /**
   * The summary to publish as a new version, or null to publish nothing.
   *
   * 🔴 A string rather than a boolean plus a stored draft, because C112's rule
   * is that **silence publishes nothing**. There is no draft summary sitting
   * anywhere waiting to be released by inaction: if this is null, no version
   * exists, and the patient's record is unchanged.
   */
  summary: string | null;
};

/**
 * One screen, one action, three items. PLAN.md 26.3, C112.
 *
 * ## Why these three were merged and the actions were not
 *
 * Three separate approvals per session is how approvals become rubber stamps:
 * by the third dialog nobody is reading. So the clinician sees all three
 * together and presses once.
 *
 * Underneath, they stay three distinct writes with three distinct audit
 * entries, because they are three different acts with three different
 * consequences. Signing the chart is a professional attestation. Releasing the
 * patient's copy puts text on somebody's phone and cannot be undone. Publishing
 * a summary version writes an append-only row into a record that person owns
 * and will still be reading in five years. Collapsing those into one row in the
 * audit log would make the log worse to make the screen simpler.
 *
 * Partial failure is reported rather than rolled back. If the summary is
 * rejected for reading like a clinical note (26.4) but the chart was signed,
 * the honest answer is "signed, and the summary needs a rewrite", not undoing a
 * signature the clinician meant.
 */
export async function approveSession(
  sessionId: string,
  choice: ApprovalChoice,
  /** W2-F01: the note on screen. Absent is the session's own. */
  noteId?: string | null,
): Promise<SessionActionState> {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "Session not found." };

  const done: string[] = [];

  /** Join the fragments and give the result a capital letter. */
  const sentence = (parts: string[]) => {
    const joined = parts.join(", ");
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  };

  if (choice.clinical) {
    const result = await approveNote(sessionId, noteId);
    if (result.error) return result;
    done.push("chart signed");
  }

  if (choice.patient) {
    const result = await approvePatientNote(sessionId);
    if (result.error) return result;
    done.push("their copy released");
  }

  if (choice.summary && choice.summary.trim()) {
    const personId = row.session.patientId
      ? await personIdForPatient(row.session.patientId)
      : null;

    if (!personId) {
      return {
        error:
          done.length > 0
            ? `${sentence(done)}. The summary could not be published: this session has no patient record attached to a person.`
            : "This session has no patient record attached to a person, so there is nothing to add a summary to.",
      };
    }

    const published = await publishSummary(actor, {
      personId,
      body: choice.summary,
      sessionId,
    });

    if (!published.ok) {
      return {
        error: done.length > 0 ? `${sentence(done)}. ${published.error}` : published.error,
      };
    }

    done.push(`summary version ${published.version} published`);
  }

  if (done.length === 0) return { ok: true, message: "Nothing published." };

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/notes");
  /* 37R.25 — the list is assembled from fragments, so the sentence it becomes
     needs its own capital. It read "chart signed, their copy released." on the
     screen, which looks like a bug even though nothing was wrong underneath. */
  return { ok: true, message: `${sentence(done)}.` };
}
