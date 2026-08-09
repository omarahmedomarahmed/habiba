"use server";

import { eq } from "drizzle-orm";

import { createSessionPaymentCheckout } from "@/lib/billing/connect";
import {
  claimTherapist,
  listRadar,
  logRadarClaimFailure,
  markInSession,
  notifyIncomingBooking,
  releaseClaim,
} from "@/lib/data/radar";
import { createRadarSession } from "@/lib/data/sessions";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { createPrivateRoom } from "@/lib/video";

export type BookingState = {
  error?: string;
  /** Stripe checkout, when the clinician charges for their time. */
  payUrl?: string;
  /** Straight into the waiting room, when they do not. */
  joinUrl?: string;
};

/**
 * Book a clinician who is available right now.
 *
 * Unauthenticated by definition — the person using this may be in crisis and is
 * not going to create an account first. The order of operations is the
 * interesting part:
 *
 *   1. Create the session, because the claim needs something to point at.
 *   2. Claim the clinician with one conditional UPDATE. If that returns
 *      nothing, someone else won the race; the session is cancelled and the
 *      patient is told to pick again. This is the only place double-booking is
 *      prevented, and it is prevented by the database, not by this function.
 *   3. Only then spend money on a video room and send a notification.
 */
export async function bookFromRadar(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const therapistUserId = String(formData.get("therapistId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!name) return { error: "Please tell us what to call you." };
  if (name.length > 80) return { error: "That name is a little long." };

  // Re-read availability from the list the public page itself is built from,
  // rather than trusting the id and price that came back in the form.
  const available = await listRadar();
  const therapist = available.find((row) => row.userId === therapistUserId);
  if (!therapist) return { error: "That clinician is no longer on the radar." };
  if (therapist.status !== "online") {
    return { error: "Someone just started booking them. Try another clinician." };
  }

  let session;
  try {
    session = await createRadarSession({
      organizationId: therapist.organizationId,
      therapistId: therapist.userId,
      guestName: name,
      guestEmail: email || null,
      priceCents: therapist.rateCents,
    });
  } catch (error) {
    log.error("radar session create failed", { reason: safeErrorMessage(error) });
    return { error: "Could not start the booking. Please try again." };
  }

  const claimed = await claimTherapist({
    therapistUserId: therapist.userId,
    sessionId: session.id,
  });

  if (!claimed) {
    logRadarClaimFailure(therapist.userId);
    await db
      .update(sessions)
      .set({ status: "cancelled", joinToken: null, updatedAt: new Date() })
      .where(eq(sessions.id, session.id));
    return { error: "Someone else booked them a second before you. Try another clinician." };
  }

  try {
    const room = await createPrivateRoom(session.id);
    if (room) {
      await db
        .update(sessions)
        .set({ videoRoomUrl: room.url, videoRoomName: room.name })
        .where(eq(sessions.id, session.id));
    }

    // The alarm the clinician hears is driven by this row's existence, via the
    // console's poll.
    await notifyIncomingBooking({
      therapistUserId: therapist.userId,
      sessionId: session.id,
      patientName: name,
    });

    // `booked=1` tells the join page the name has already been given, so a
    // patient who has just filled in a form does not meet the same form again.
    const joinUrl = `${env.appUrl}/join/${session.joinToken}?booked=1`;

    if (therapist.rateCents <= 0) {
      // Nothing to pay, so the booking is real immediately.
      await markInSession(session.id);
      return { joinUrl };
    }

    const checkout = await createSessionPaymentCheckout({
      sessionId: session.id,
      token: session.joinToken!,
      payerName: name,
      payerEmail: email || null,
    });

    if (checkout.error || !checkout.url) {
      // Never strand a clinician as "pending" because a payment could not be
      // started — that would take them off the radar for ten minutes for
      // nothing.
      await releaseClaim(session.id);
      return { error: checkout.error ?? "Could not start the payment." };
    }

    return { payUrl: checkout.url };
  } catch (error) {
    await releaseClaim(session.id);
    log.error("radar booking failed", {
      session: ref(session.id),
      reason: safeErrorMessage(error),
    });
    return { error: "Could not complete the booking. Please try again." };
  }
}
