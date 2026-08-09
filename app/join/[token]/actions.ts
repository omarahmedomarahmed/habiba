"use server";

import { createSessionPaymentCheckout } from "@/lib/billing/connect";
import { joinByToken, resolveJoinToken } from "@/lib/data/sessions";
import { createMeetingToken, roomUrlWithToken } from "@/lib/video";
import { log } from "@/lib/logger";

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
export async function checkJoinState(token: string): Promise<{ live: boolean; ended: boolean }> {
  const session = await resolveJoinToken(token);
  if (!session) return { live: false, ended: true };
  return { live: session.status === "in_progress", ended: false };
}
