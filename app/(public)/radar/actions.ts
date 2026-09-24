"use server";

import { and, eq, isNull, ne } from "drizzle-orm";

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
  reserveWithReason,
  type ReservationOutcome,
} from "@/lib/data/radar";
import { createRadarSession } from "@/lib/data/sessions";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
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
import { fullName } from "@/lib/utils";
import { createPrivateRoom } from "@/lib/video";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(public)/radar/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
): Promise<{ outcome: ReservationOutcome; secondsLeft: number }> {
  if (!viewer) return { outcome: "unavailable", secondsLeft: 0 };

  // Cheap, but it is an unauthenticated write, so it gets a ceiling too.
  const throttle = await consume(await callerKey("radar:view"), 60, 60);
  // Being throttled is not the clinician being taken — say the true thing.
  if (!throttle.allowed) return { outcome: "unavailable", secondsLeft: 0 };

  const outcome = await reserveWithReason({ therapistUserId, viewer });
  return { outcome, secondsLeft: outcome === "held" ? RESERVATION_SECONDS : 0 };
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
  /*
   * 🔴 W2-P04: a signed-in patient books as themselves. Read from the cookie,
   * never from the form, and null for the stranger this action was built for.
   */
  const { optionalPatient } = await import("@/lib/patient-auth/guard");
  const signedIn = await optionalPatient();
  const name = String(formData.get("name") ?? "").trim() || signedIn?.firstName || "";
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
      }, or call your local emergency number if you need help right now.`,
    };
  }

  const ceiling = await globalCeiling("radar:book", GLOBAL_BOOKINGS_PER_MINUTE);
  if (!ceiling.allowed) {
    return {
      error:
        "The radar is unusually busy. Please try again in a minute, or call your local emergency number if you need help now.",
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
      priceCents: therapist.sessionRateCents,
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
   * 🔴 W2-P04: only once the claim is won, so a lost race leaves no file with
   * a clinician the patient never saw. Their own person, so the session is on
   * their sessions list, their orb and their bill from this moment.
   */
  if (signedIn) {
    const { patientRowForPerson } = await import("@/lib/data/people");
    const patientId = await patientRowForPerson({
      organizationId: therapist.organizationId,
      therapistId: therapist.userId,
      personId: signedIn.personId,
    });
    if (patientId) {
      await db
        .update(sessions)
        .set({ patientId, updatedAt: new Date() })
        .where(and(eq(sessions.id, session.id), isNull(sessions.patientId)));
    }
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
  /*
   * 🔴 NEVER TAKE AWAY A SESSION SOMEBODY HAS PAID FOR.
   *
   * ## What this did
   *
   * The WHERE was `id = previous AND status = 'scheduled'`. It did not look at
   * `payment_status`, so a session that had been paid for — and whose payment a
   * human had sat and confirmed — was cancelled and had its join token set to
   * NULL, which is the patient's only way in.
   *
   * Caught on production to the millisecond while five walkers shared one
   * address:
   *
   *   02:28:11  session f840e119 created by one visitor
   *   02:28:19  that patient submitted their transfer reference
   *   02:28:47  an admin CONFIRMED the payment, payment_status -> 'paid'
   *   02:33:04  a DIFFERENT visitor booked a DIFFERENT clinician
   *   02:33:04  f840e119 -> cancelled, join_token -> NULL
   *
   * Four minutes after paying, with nothing said to them. Their pay page still
   * read "We are checking your transfer. It will be waiting for you here."
   *
   * ## Why it is not a test artefact
   *
   * The hold is keyed by `callerKey`, which collapses to a network, and the
   * comment above explains why: a script must not accumulate claims faster
   * than it releases them. But a network is not a person. A household, an
   * office, a campus and every mobile carrier on CGNAT are one address, so
   * "the previous booking from this address" is routinely somebody else
   * entirely. On a product whose whole promise is reaching a person in crisis,
   * the failure reads as: I paid, and then the door was taken away.
   *
   * ## The rule
   *
   * The hold exists to reclaim ABANDONED bookings, and money is the clearest
   * possible evidence that a booking was not abandoned. So is having walked
   * through the door. Either one makes this session untouchable, and the
   * clinician's claim stays with it.
   *
   * Guarded twice on purpose: once here, so we do not release the claim of a
   * session we are about to leave alone, and once in the WHERE, so a payment
   * confirmed in the gap between this read and that write still cannot lose.
   */
  if (previous && previous !== session.id) {
    const [prior] = await db
      .select({
        paymentStatus: sessions.paymentStatus,
        patientJoinedAt: sessions.patientJoinedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, previous))
      .limit(1);

    const settled = prior?.paymentStatus === "paid" || prior?.patientJoinedAt !== null;

    if (settled) {
      log.warn("radar hold kept a settled session", {
        session: ref(previous),
        reason: prior?.paymentStatus === "paid" ? "paid" : "patient already arrived",
      });
    } else {
      await releaseClaim(previous);
      await db
        .update(sessions)
        .set({ status: "cancelled", joinToken: null, updatedAt: new Date() })
        .where(
          and(
            eq(sessions.id, previous),
            eq(sessions.status, "scheduled"),
            ne(sessions.paymentStatus, "paid"),
            isNull(sessions.patientJoinedAt),
          ),
        );
    }
  }

  try {
    /*
     * 🔴 79.1 — NO ROOM, NO BOOKING, AND THE HOLD GOES BACK.
     *
     * This was `if (room) { save it }` with no else, so a failed room left the
     * session standing, the clinician's alarm still rang, and the patient was
     * handed a `joinUrl` to a door that had never been built. On production,
     * where `DAILY_API_KEY` was never set, that was every booking.
     *
     * A patient on the radar is a stranger in distress who has just pressed a
     * button that says somebody is available now. Sending them to an empty
     * room is the worst thing this product can do to them, so the booking is
     * abandoned instead: the claim is released so the clinician goes back on
     * the radar for the next person, the session is cancelled so nothing
     * dangles, and they are told in a sentence rather than shown a black box.
     */
    const made = await createPrivateRoom(session.id);
    if (!made.ok) {
      await releaseClaim(session.id);
      await db
        .update(sessions)
        .set({ status: "cancelled", joinToken: null, updatedAt: new Date() })
        .where(and(eq(sessions.id, session.id), eq(sessions.status, "scheduled")));
      log.error("radar booking abandoned: no video room", {
        session: ref(session.id),
        reason: made.reason,
      });
      return {
        error:
          "We could not open a room for this session, so nothing has been booked and you have not been charged. Please try again in a moment.",
      };
    }

    const room = made.room;
    await db
      .update(sessions)
      .set({ videoRoomUrl: room.url, videoRoomName: room.name, videoRoomExpiresAt: room.expiresAt })
      .where(eq(sessions.id, session.id));

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

    if (therapist.sessionRateCents <= 0) {
      // Nothing to pay, so the booking is real immediately.
      await markInSession(session.id);
      return { joinUrl };
    }

    /*
     * 🔴 W2-P04 / 53.21: a person now stands behind this session, so their
     * benefit pays before a price is shown, as it does on every other path.
     * A pot that covers it all makes the booking real exactly like a free one.
     */
    if (signedIn) {
      const { payFromPot } = await import("@/lib/billing/pot");
      await payFromPot(session.id);
      const [after] = await db
        .select({ paymentStatus: sessions.paymentStatus })
        .from(sessions)
        .where(eq(sessions.id, session.id))
        .limit(1);
      if (after?.paymentStatus === "paid") {
        await markInSession(session.id);
        return { joinUrl };
      }
    }

    /*
     * To the pay page, not to Stripe.
     *
     * Sprint 4.2 puts a step in front of the card form: the patient chooses the
     * country they are paying from, and only then do we know their currency,
     * their VAT and the rate. Handing them straight to Stripe would mean
     * charging in dollars with no tax line — which is what happened before, and
     * is wrong everywhere outside the United States.
     *
     * The claim is *not* released here. The clinician stays held while the
     * patient picks a country, exactly as they were held while the patient
     * filled in a card, and the existing expiry sweep releases them if the
     * patient walks away.
     */
    return { payUrl: `${env.appUrl}/pay/${session.joinToken}` };
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

/**
 * Email a walk-in address to whoever asked for it.
 *
 * Anonymous and unauthenticated, which makes it a free mail sender if it is
 * not held down. Three things hold it down: the address is one a clinician
 * chose to publish, the body is fixed and carries no attacker-supplied text,
 * and the caller's network is rate limited hard. What is left is "a stranger
 * can send a public address to an email they typed", which is a leaflet.
 */
export async function emailDirections(
  therapistUserId: string,
  email: string,
): Promise<{ error?: string; ok?: boolean }> {
  const address = email.trim().toLowerCase();
  if (!address || address.length > 200 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(address)) {
    return { error: "That does not look like an email address." };
  }

  const attempt = await consume(await callerKey("directions"), 5, 600);
  if (!attempt.allowed) {
    return { error: "Too many of these from your connection. Use the directions link instead." };
  }

  const entry = (await listRadar()).find((row) => row.userId === therapistUserId);
  if (!entry?.practice) {
    return { error: "That clinician is not offering walk-in visits." };
  }

  const { sendWalkInDirections } = await import("@/lib/mail");
  const { directionsUrl } = await import("@/lib/geocode");

  const sent = await sendWalkInDirections({
    to: address,
    therapistName: fullName(entry.firstName, entry.lastName),
    practiceName: entry.practice.name,
    address: entry.practice.address,
    mapsUrl:
      directionsUrl({
        lat: entry.practice.lat,
        lon: entry.practice.lon,
        address: entry.practice.address,
      }) ?? "",
  });

  if (!sent) return { error: "Could not send that just now. Use the directions link instead." };
  return { ok: true };
}
