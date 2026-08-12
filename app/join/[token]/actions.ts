"use server";

import { createSessionPaymentCheckout } from "@/lib/billing/connect";
import { joinByToken, resolveJoinToken } from "@/lib/data/sessions";
import { callerKey, consume } from "@/lib/rate-limit";
import { createMeetingToken, roomUrlWithToken } from "@/lib/video";
import { log } from "@/lib/logger";

/** Generous for a real patient; a hard ceiling on automated abuse. */
const JOINS_PER_WINDOW = 10;
const JOIN_WINDOW_SECONDS = 10 * 60;

export type JoinState = {
  error?: string;
  joined?: boolean;
  videoUrl?: string | null;
  /** Set when the session must be paid for before the room is handed over. */
  payUrl?: string;
  /**
   * The patient is known and cleared, but has never been asked about
   * recording. See `resumeAfterPayment` — the radar path skips the join form
   * entirely, so this is the only place that question can be put to them.
   */
  needsConsent?: boolean;
};

/**
 * Mint the room URL for a patient who is cleared to enter.
 *
 * Split out so that the paywall has exactly one thing to guard. A session with
 * a price is not joinable until `payment_status` reads `paid`, and that check
 * lives here, on the server, next to the code that creates the meeting token —
 * not on the button that opens it.
 */
async function admit(token: string, name: string): Promise<JoinState> {
  const session = await resolveJoinToken(token);
  if (!session) return { joined: true, videoUrl: null };

  if (session.priceCents > 0 && session.paymentStatus !== "paid") {
    return { error: "This session has not been paid for yet." };
  }

  let videoUrl: string | null = null;
  if (session.modality === "video" && session.videoRoomUrl && session.videoRoomName) {
    // Non-owner token, short expiry, minted only after a valid join.
    const meetingToken = await createMeetingToken({
      roomName: session.videoRoomName,
      userName: name,
      isOwner: false,
      minutes: 120,
    });
    videoUrl = roomUrlWithToken(session.videoRoomUrl, meetingToken);
  }

  return { joined: true, videoUrl };
}

/**
 * The patient side of a join link. Unauthenticated by definition.
 *
 * What it deliberately does not do: return the clinician's name or photo,
 * expose any clinical data, or hand back a room URL that works on its own. The
 * old public endpoint returned therapist identity and a *public* Daily room URL
 * to any caller holding a token that never expired — and created the room as a
 * side effect, so an unauthenticated request could allocate resources.
 */
export async function submitJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const consent = formData.get("consent");

  if (!name) return { error: "Please enter your first name." };
  if (name.length > 80) return { error: "That name is a little long." };

  /*
   * Consent is required to proceed; agreeing is not.
   *
   * The distinction is the whole design. There is no default and no
   * pre-selected option, because a pre-ticked box is not an affirmative act
   * and would leave us with a stored "granted" that means nothing. Declining
   * is a first-class answer that costs the patient nothing — the session runs
   * identically, off record — so nobody is nudged into agreeing by the fear
   * of losing their appointment.
   */
  const { isRecordingConsent } = await import("@/lib/consent");
  if (!isRecordingConsent(consent)) {
    return { error: "Please choose whether your therapist may record the session." };
  }

  /*
   * Throttled even though the token is 24 random bytes and cannot realistically
   * be guessed. The limit is not really about brute force — it is about the
   * side effects: each accepted join can create a patient record and mint a
   * Daily meeting token, and unbounded side effects on an unauthenticated
   * endpoint are worth bounding whether or not there is an obvious attack.
   */
  const throttle = await consume(await callerKey("join"), JOINS_PER_WINDOW, JOIN_WINDOW_SECONDS);
  if (!throttle.allowed) {
    return { error: "Too many attempts. Wait a moment and try again." };
  }

  const sessionId = await joinByToken(token, name);
  if (!sessionId) {
    return { error: "This link is no longer valid. Ask your therapist for a new one." };
  }

  /*
   * Recorded before the paywall, not after.
   *
   * A patient who agrees and then abandons Stripe has still made a decision we
   * are obliged to honour, and one we would otherwise lose. It also means the
   * answer is already stored when they walk back in from checkout, so nobody
   * is asked the same question twice.
   */
  await recordConsent(sessionId, consent);

  const session = await resolveJoinToken(token);
  if (!session) return { joined: true, videoUrl: null };

  // Pay first, then join. The name is already recorded, so the patient comes
  // back from Stripe into the room rather than to a form they have filled in
  // once already.
  if (session.priceCents > 0 && session.paymentStatus !== "paid") {
    const checkout = await createSessionPaymentCheckout({
      sessionId,
      token,
      payerName: name,
      payerEmail: email || null,
    });
    if (checkout.error || !checkout.url) {
      return { error: checkout.error ?? "Could not start the payment." };
    }
    return { payUrl: checkout.url };
  }

  log.info("patient joined session");
  return admit(token, name);
}

/**
 * Walk in without filling the form again.
 *
 * Two arrivals land here: back from Stripe after paying, and straight off the
 * Crisis Radar for a clinician who charges nothing. Both already gave a name,
 * and both are a fresh page load with no client state, so the name is read back
 * off the session.
 *
 * `joinByToken` is called here and not only from `submitJoin`, which is the fix
 * for a real hole: a radar booking that went through Stripe never touched the
 * form, so the patient record was never created — leaving the session with a
 * null `patient_id`, the note unattached and no copilot thread. It is
 * idempotent, so calling it on a second page load changes nothing.
 */
export async function resumeAfterPayment(token: string): Promise<JoinState> {
  const session = await resolveJoinToken(token);
  if (!session) return { error: "This link is no longer valid." };

  const name = session.guestName?.trim();
  if (!name) return {};

  await joinByToken(token, name);

  /*
   * The hole this closes.
   *
   * Consent was collected in `submitJoin`, which is the form. A radar booking
   * never touches that form: the patient types their name on the public radar,
   * the session is created for them, and they are redirected here already
   * named and already admitted. So the product's headline flow — a stranger in
   * crisis, booked in ninety seconds — was the one flow that recorded people
   * without ever asking. The same is true of anyone returning from Stripe on a
   * session created before this shipped.
   *
   * Answering is the price of entry, and it is asked here rather than waved
   * through, because "we asked everybody except the ones who arrived the
   * quickest" is not a consent process.
   */
  const consented = await hasConsent(session.id);
  if (!consented) return { needsConsent: true };
  return admit(token, name);
}

/** Has this session been asked the recording question at all? */
async function hasConsent(sessionId: string): Promise<boolean> {
  const { db } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select({ consent: sessions.recordingConsent })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return Boolean(row?.consent);
}

/**
 * The answer, given by somebody who never saw the join form.
 *
 * Unauthenticated like the rest of this file — the join token is the
 * credential and it names exactly one session.
 */
export async function answerConsent(token: string, consent: string): Promise<JoinState> {
  const { isRecordingConsent } = await import("@/lib/consent");
  if (!isRecordingConsent(consent)) {
    return { needsConsent: true, error: "Please choose one." };
  }

  const session = await resolveJoinToken(token);
  if (!session) return { error: "This link is no longer valid." };

  await recordConsent(session.id, consent);
  return admit(token, session.guestName?.trim() || "Patient");
}

/**
 * Store the answer, and make a refusal actually mean something.
 *
 * Writing "declined" into a column and then recording anyway would be worse
 * than never asking — it manufactures a paper trail that says we knew. So a
 * refusal also sets `recordingPausedAt`, which is the same switch the
 * clinician's off-record button uses: the room opens with the indicator amber,
 * the patient can see it from their own screen, and the clinician has to take
 * a deliberate action to change it rather than an accidental one.
 */
async function recordConsent(sessionId: string, consent: "granted" | "declined") {
  const { RECORDING_CONSENT_VERSION } = await import("@/lib/consent");
  const { db } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  await db
    .update(sessions)
    .set({
      recordingConsent: consent,
      recordingConsentAt: new Date(),
      recordingConsentVersion: RECORDING_CONSENT_VERSION,
      ...(consent === "declined" ? { recordingPausedAt: new Date() } : {}),
    })
    .where(eq(sessions.id, sessionId));

  // Deliberately not through the PHI audit helper: there is no actor with a
  // user id here, and the fact recorded is about consent rather than about
  // anybody reading a chart.
  log.info("recording consent recorded", { consent, version: RECORDING_CONSENT_VERSION });
}

/** Polled by the waiting room until the clinician starts. */
export async function checkJoinState(
  token: string,
): Promise<{ live: boolean; ended: boolean; recording: boolean; startedAt: string | null }> {
  const session = await resolveJoinToken(token);
  if (!session) return { live: false, ended: true, recording: false, startedAt: null };

  /*
   * Whether the microphone is actually running, not merely whether a session
   * exists.
   *
   * The patient is entitled to know this at a glance and at all times. A
   * clinician can pause the recording mid-session, and a person who agreed to
   * be recorded has to be able to see when that changed without asking.
   */
  const { db } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select({
      recordingPausedAt: sessions.recordingPausedAt,
      startedAt: sessions.startedAt,
      patientJoinedAt: sessions.patientJoinedAt,
    })
    .from(sessions)
    .where(eq(sessions.id, session.id))
    .limit(1);

  const live = session.status === "in_progress";

  /*
   * The abandonment check rides on this poll rather than on a clock.
   *
   * A patient waiting in an empty room is the only circumstance in which
   * anybody needs to ask "has this been abandoned?", and that patient is
   * already asking us something every five seconds. Doing it here means the
   * question is asked exactly when it is meaningful and never otherwise —
   * which is what let the cron drop from four times an hour to once, and with
   * it the database's bill. See `markAbandonedIfWaiting`.
   *
   * Deliberately not awaited into the response: whether the clinician gets
   * their warning email this second or the next is not something the patient
   * should wait on, and a failure here must not break the poll that tells them
   * their session has started.
   */
  if (!live && row?.patientJoinedAt) {
    const { after } = await import("next/server");
    after(async () => {
      const { markAbandonedIfWaiting } = await import("@/lib/data/feedback");
      await markAbandonedIfWaiting(session.id, row.patientJoinedAt, row.startedAt);
    });
  }

  return {
    live,
    ended: false,
    recording: live && !row?.recordingPausedAt,
    startedAt: row?.startedAt?.toISOString() ?? null,
  };
}

/**
 * The patient's word on us, given while they wait.
 *
 * Unauthenticated like everything else on this page — the join token is the
 * credential, and it names one session.
 */
export async function rateOnArrival(
  token: string,
  serviceStars: number,
  email: string,
): Promise<{ ok?: boolean; error?: string }> {
  const { recordArrival } = await import("@/lib/data/feedback");
  return recordArrival({ token, serviceStars, email });
}
