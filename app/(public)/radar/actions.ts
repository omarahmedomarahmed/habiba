"use server";

import { and, eq } from "drizzle-orm";

import { createSessionPaymentCheckout } from "@/lib/billing/connect";
import {
  CLAIM_MINUTES,
  RESERVATION_SECONDS,
  claimTherapist,
  listRadar,
  logRadarClaimFailure,
  markInSession,
  notifyIncomingBooking,
  releaseClaim,
  releaseReservation,
  reserveTherapist,
} from "@/lib/data/radar";
import { createRadarSession } from "@/lib/data/sessions";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import {
  callerKey,
  consume,
  globalCeiling,
  refund,
  releaseHold,
  subjectKey,
  takeHold,
} from "@/lib/rate-limit";
import { createPrivateRoom } from "@/lib/video";

/**
 * Booking limits.
 *
 * Set for a person in distress who may fumble a form, not for a tidy user: six
 * attempts in a quarter of an hour is well beyond a genuine retry loop and far
 * below what it takes to walk the board. The global ceiling is roughly an order
 * of magnitude above any plausible real minute.
 */
const BOOKINGS_PER_WINDOW = 6;
const BOOKING_WINDOW_SECONDS = 15 * 60;
const GLOBAL_BOOKINGS_PER_MINUTE = 60;
/** Per clinician, from anyone. The one limit an attacker cannot buy around. */
const CLAIMS_PER_THERAPIST = 3;

/**
 * Hold a clinician while the visitor reads their profile.
 *
 * Called when the booking sheet opens and renewed while it stays open. The
 * viewer id is generated in the browser and identifies the tab, nothing more —
 * its only job is to let the server tell "you are booking them" apart from
 * "someone else is booking them", which is the distinction that was missing
 * and cost a real patient their booking.
 */
export async function reserveForViewing(
  therapistUserId: string,
  viewer: string,
): Promise<{ held: boolean; secondsLeft: number }> {
  if (!viewer) return { held: false, secondsLeft: 0 };

  // Cheap, but it is an unauthenticated write, so it gets a ceiling too.
  const throttle = await consume(await callerKey("radar:view"), 60, 60);
  if (!throttle.allowed) return { held: false, secondsLeft: 0 };

  const held = await reserveTherapist({ therapistUserId, viewer });
  return { held, secondsLeft: held ? RESERVATION_SECONDS : 0 };
}

/** Put them straight back on the board when the sheet closes or times out. */
export async function releaseViewing(therapistUserId: string, viewer: string): Promise<void> {
  if (!viewer) return;
  await releaseReservation({ therapistUserId, viewer });
}

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
  const viewer = String(formData.get("viewer") ?? "").trim() || null;

  if (!name) return { error: "Please tell us what to call you." };
  if (name.length > 80) return { error: "That name is a little long." };

  /*
   * Throttling, before anything expensive happens.
   *
   * The attack this closes: a script walks the public radar and books every
   * clinician on it. Each claim holds someone out of service for ten minutes,
   * so a few dozen requests could empty the board — for a crisis service, that
   * is the whole product taken down by one loop.
   *
   * Four layers. The network limit stops the naive loop; the hold means one
   * network can only tie up one clinician at a time; the per-clinician limit
   * below cannot be multiplied by buying more addresses; and the global ceiling
   * is the backstop when someone has a real botnet.
   *
   * Note "network", not "address" — see `networkOf`. Limiting on the exact IP
   * is close to useless, which I found by flooding this endpoint and getting no
   * 429s at all, because the caller's egress rotated across three addresses in
   * one /24.
   *
   * All of it is checked before we create a session, allocate a video room or
   * open a Stripe checkout, because those are the things worth protecting.
   */
  const attemptKey = await callerKey("radar:book");
  const attempt = await consume(attemptKey, BOOKINGS_PER_WINDOW, BOOKING_WINDOW_SECONDS);
  if (!attempt.allowed) {
    log.warn("radar booking rate limited", { used: attempt.used });
    return {
      error: `Too many booking attempts. Try again in ${Math.ceil(attempt.retryAfter / 60)} minute${
        attempt.retryAfter > 60 ? "s" : ""
      }, or call 988 if you need help right now.`,
    };
  }

  const ceiling = await globalCeiling("radar:book", GLOBAL_BOOKINGS_PER_MINUTE);
  if (!ceiling.allowed) {
    return {
      error: "The radar is unusually busy. Please try again in a minute, or call 988 for help now.",
    };
  }

  // Re-read availability from the list the public page itself is built from,
  // rather than trusting the id and price that came back in the form.
  const available = await listRadar(viewer);
  const therapist = available.find((row) => row.userId === therapistUserId);
  if (!therapist) return { error: "That clinician is no longer on the radar." };

  // `reservedByYou` is the whole point: pending is fine when it is *your* hold.
  if (therapist.status !== "online" && !therapist.reservedByYou) {
    return { error: "Someone just started booking them. Try another clinician." };
  }

  /*
   * A limit on the clinician, not the caller.
   *
   * Everything above is keyed on the caller's network, and a network is
   * something an attacker can buy more of. This one cannot be multiplied: no
   * matter how many addresses you come from, a given clinician can only be
   * claimed a few times in a quarter of an hour. It stops the churn attack —
   * claim, get released, immediately re-claim — which would otherwise keep
   * someone permanently out of service from a rotating pool.
   *
   * Three is generous for the real flow, which is one claim, or one claim plus
   * a retry after an abandoned checkout.
   */
  const therapistKey = subjectKey("radar:target", therapist.userId);
  const targeted = await consume(therapistKey, CLAIMS_PER_THERAPIST, BOOKING_WINDOW_SECONDS);
  if (!targeted.allowed) {
    log.warn("radar clinician claim-rate exceeded", { therapist: ref(therapist.userId) });
    return {
      error: "That clinician has had several booking attempts just now. Try another one.",
    };
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
    viewer,
  });

  if (!claimed) {
    logRadarClaimFailure(therapist.userId);
    await db
      .update(sessions)
      .set({ status: "cancelled", joinToken: null, updatedAt: new Date() })
      .where(eq(sessions.id, session.id));
    // Losing a race is not abuse, so it counts against neither party.
    await refund(attemptKey);
    await refund(therapistKey);
    return { error: "Someone else booked them a second before you. Try another clinician." };
  }

  /*
   * One clinician held per address at a time.
   *
   * Taking the hold hands back whatever this address was holding before, and we
   * release that immediately — so a patient who abandoned one booking and
   * picked someone else does not leave the first clinician stranded for ten
   * minutes, and a script cannot accumulate claims faster than it releases
   * them however it staggers its requests.
   */
  const { previous } = await takeHold(
    await callerKey("radar:hold"),
    session.id,
    CLAIM_MINUTES * 60,
  );
  if (previous && previous !== session.id) {
    await releaseClaim(previous);
    await db
      .update(sessions)
      .set({ status: "cancelled", joinToken: null, updatedAt: new Date() })
      .where(and(eq(sessions.id, previous), eq(sessions.status, "scheduled")));
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
      // nothing. The caller's hold goes back too, so they can immediately try
      // someone else.
      await releaseClaim(session.id);
      await releaseHold(await callerKey("radar:hold"));
      return { error: checkout.error ?? "Could not start the payment." };
    }

    return { payUrl: checkout.url };
  } catch (error) {
    await releaseClaim(session.id);
    await releaseHold(await callerKey("radar:hold"));
    log.error("radar booking failed", {
      session: ref(session.id),
      reason: safeErrorMessage(error),
    });
    return { error: "Could not complete the booking. Please try again." };
  }
}
