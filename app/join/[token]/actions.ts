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

  if (!name) return { error: "Please enter your first name." };
  if (name.length > 80) return { error: "That name is a little long." };

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
  return admit(token, name);
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
    })
    .from(sessions)
    .where(eq(sessions.id, session.id))
    .limit(1);

  const live = session.status === "in_progress";
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
