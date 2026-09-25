"use server";

import { ensureRoom, joinByToken, resolveJoinToken } from "@/lib/data/sessions";
import { callerKey, consume } from "@/lib/rate-limit";
import { capSeconds, type ClockStage } from "@/lib/session-clock";
import { getSettings } from "@/lib/settings";
import { createMeetingToken, roomUrlWithToken } from "@/lib/video";
import { log, ref } from "@/lib/logger";

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
/**
 * The meeting we created for this session, if it is an external one.
 *
 * 🔴 Only a PROVISIONED source answers. `provisioned_at` is set solely by the
 * path that created the meeting inside the clinician's own account, and the
 * database refuses an external kind without it (0064, C175, C215). So this
 * cannot forward a patient to a link a therapist supplied, because there is
 * nowhere for such a link to have been stored.
 */
async function externalMeetingFor(sessionId: string): Promise<string | null> {
  const { EXTERNAL_SOURCE_KINDS, sessionSources } = await import("@/lib/db/schema");
  const { acrossRegions } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");

  const rows = await acrossRegions((db) =>
    db
      .select({
        kind: sessionSources.kind,
        externalMeetingId: sessionSources.externalMeetingId,
        provisionedAt: sessionSources.provisionedAt,
      })
      .from(sessionSources)
      .where(eq(sessionSources.sessionId, sessionId))
      .limit(1),
  );

  const source = rows[0];
  if (!source || !source.provisionedAt || !source.externalMeetingId) return null;
  if (!EXTERNAL_SOURCE_KINDS.includes(source.kind)) return null;

  return source.externalMeetingId;
}

async function admit(token: string, name: string): Promise<JoinState> {
  const session = await resolveJoinToken(token);
  if (!session) return { joined: true, videoUrl: null };

  if (session.priceCents > 0 && session.paymentStatus !== "paid") {
    return { error: "This session has not been paid for yet." };
  }

  /*
   * 🔴 41.4 / C133 — the patient always received OUR link, and this is where
   * it finally forwards.
   *
   * The link in their message is `/join/[token]`, never the meeting. That is
   * what makes the consent screen unavoidable: whoever holds the meeting link
   * can skip it, which is why sprint 36 built `session_sources` with no column
   * a pasted link could live in.
   *
   * They reach the meeting here, after answering, and after paying if the
   * session is paid. Declining still forwards them: a refusal turns the AI
   * off, never the session.
   */
  const external = await externalMeetingFor(session.id);
  if (external) return { joined: true, videoUrl: external };

  /*
   * 🔴 79.1 — THE PATIENT'S SIDE OF THE SAME SILENCE.
   *
   * This was `if (videoRoomUrl && videoRoomName)`, and when either was null it
   * returned `{ joined: true, videoUrl: null }`: the patient was told they had
   * joined, and handed nothing. They had answered the consent question, paid if
   * the session was paid, and arrived in a room that did not exist. On
   * production that was every session, because the key was never set.
   *
   * `ensureRoom` builds one now if there is none, which covers every session
   * made before this and every room that has expired since. If it still cannot,
   * the patient is told rather than shown an empty screen, because a person who
   * has just paid deserves a sentence.
   */
  const built = await ensureRoom(session);
  if (!built.ok) {
    return {
      error:
        "We could not open the room for this session. Your therapist has been told. Nothing you did was lost, and this link will work once it is fixed.",
    };
  }

  // Non-owner token, short expiry, minted only after a valid join.
  const meetingToken = await createMeetingToken({
    roomName: built.name,
    userName: name,
    isOwner: false,
    // The patient's key expires with the session, not two hours after it.
    minutes: capSeconds((await getSettings()).clock) / 60 + 15,
  });

  return { joined: true, videoUrl: roomUrlWithToken(built.url, meetingToken) };
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
   * 🔴 C282 — THE AI QUESTION IS NOT READ HERE ANY MORE.
   *
   * It was. This action took `guestName` and `consent` out of the same
   * formData, so the answer was given with the momentum of filling in a name
   * rather than as a decision of its own. That is the actual pressure in this
   * flow: it existed whichever side of payment the question sat on, and
   * reordering the flow would not have touched it.
   *
   * The standalone screen already existed for a returning radar patient, who
   * skipped this form entirely. The guest path now uses it too, so there is
   * exactly one place in the product where somebody is asked, and it is a
   * screen with one question on it.
   *
   * Consent is still required before the room. `admit` is reached only from
   * `answerConsent`, and this action returns `needsConsent` instead.
   */

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

  /* 🔴 W2-P04: a signed-in patient joins as themselves, never as a new stranger. */
  const { optionalPatient } = await import("@/lib/patient-auth/guard");
  /* 🔴 P13: and the receipt address the form asked for is kept, not dropped. */
  const sessionId = await joinByToken(
    token,
    name,
    (await optionalPatient())?.personId ?? null,
    email || null,
  );
  if (!sessionId) {
    return { error: "This link is no longer valid. Ask your therapist for a new one." };
  }

  /*
   * 🔴 53.21 — the pot pays BEFORE a price is ever shown, and this is the only
   * place a radar arrival can be reached.
   *
   * `joinByToken` is the first moment a radar session has a patient row and a
   * person behind it, so it is the first moment there is a benefit to read.
   * `createRadarSession` deliberately does not call this and says why.
   *
   * Before `resolveJoinToken`, so the `payment_status` read below is the one this
   * may have just changed. Reading first and paying afterwards would send a
   * badged patient to a pay page for a session that is already paid for, which is
   * a price on a screen that 53.2's whole vocabulary exists to keep off it.
   */
  const { payFromPot } = await import("@/lib/billing/pot");
  await payFromPot(sessionId);
  /* 🔴 0169: benefit first, then the patient's wallet (ruling 7b). */
  const { holdWallet } = await import("@/lib/billing/wallet");
  await holdWallet(sessionId);

  const session = await resolveJoinToken(token);
  if (!session) return { joined: true, videoUrl: null };

  // Pay first, then join. The name is already recorded, so the patient comes
  // back from Stripe into the room rather than to a form they have filled in
  // once already.
  if (session.priceCents > 0 && session.paymentStatus !== "paid") {
    /*
     * To `/pay/[token]`, not straight to Stripe.
     *
     * The patient has to choose the country they are paying from before there
     * is a currency, a VAT rate or an exchange rate to charge them at (4.2).
     * The name they just gave is already recorded, so coming back from the
     * payment puts them at the AI question rather than in this form again.
     *
     * 🔴 C281 — the shipped order STAYS: name, then pay, then the AI question,
     * then in. The ordering ruling and C282 are different things: the harm was
     * never which side of payment the question sat on, it was the question
     * being bundled onto a form. `resumeAfterPayment` returns `needsConsent`,
     * so a patient coming back from Stripe reaches the same standalone screen
     * a radar arrival does.
     */
    return { payUrl: `/pay/${token}` };
  }

  /*
   * 🔴 C282 — the question, on its own screen, before the room.
   *
   * `admit` is never reached from here now. It is reached from
   * `answerConsent`, which is the one place an answer is given.
   */
  log.info("patient named themselves, asking about recording");
  return { needsConsent: true };
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
  /*
   * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
   */
  const { dbFor } = await import("@/lib/db");
  const { pinnedToDefaultRegion } = await import("@/lib/db/region");
  const db = dbFor(pinnedToDefaultRegion("app/join/[token]/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));
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
  /*
   * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
   */
  const { dbFor } = await import("@/lib/db");
  const { pinnedToDefaultRegion } = await import("@/lib/db/region");
  const db = dbFor(pinnedToDefaultRegion("app/join/[token]/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));
  const { sessions } = await import("@/lib/db/schema");
  const { and, eq, sql } = await import("drizzle-orm");

  /*
   * 🔴 41.7 — COUPLES: ONE CONSENTS AND ONE DOES NOT MEANS NO AI.
   *
   * > *Cheaper to state than to litigate.*
   *
   * Two people join a couples session through the same link and both answer,
   * into one `recording_consent` column. Without this the second answer simply
   * overwrites the first, so a partner who declines is silently overruled by
   * whoever happens to press the button next — and the recorder they objected
   * to runs anyway.
   *
   * So the write is MONOTONIC TOWARD DECLINE. A decline always lands; a grant
   * lands only when nobody has declined. No new table, no per-participant
   * consent model, and the rule holds for three people in a group as readily
   * as for two in a couple.
   *
   * The cost is that a genuine change of mind cannot be made from this screen
   * once anybody has said no, which is the right way round: `turnOnConsent` is
   * a deliberate in-session act with both people present, and that is where a
   * reversal belongs.
   *
   * ## 🔴 C283 — ONE CONDITIONAL STATEMENT, NO SEPARATE READ
   *
   * Sprint 41 shipped this as a SELECT, a check, and then an UPDATE. Two
   * people answering seconds apart is safe; two answering in the same instant
   * both read "not declined" and both write, so a grant can still land after a
   * decline. The rule is far too important to rest on human reaction time.
   *
   * `IS DISTINCT FROM` rather than `<> 'declined'`, because `recording_consent`
   * is nullable and `NULL <> 'declined'` is NULL, which is not true, so a
   * plain inequality would refuse the very first answer on every session.
   *
   * Same rule, no window, less code. It is also the pattern the rest of this
   * module already uses — `turnOnConsent` and `stopRecording` are both
   * conditional UPDATEs — so this was the one place in the consent path that
   * was not.
   */
  const landed = await db
    .update(sessions)
    .set({
      recordingConsent: consent,
      recordingConsentAt: new Date(),
      recordingConsentVersion: RECORDING_CONSENT_VERSION,
      ...(consent === "declined"
        ? { recordingPausedAt: new Date() }
        : /*
           * Agreeing on the way in starts the clock on the recording too
           * (7.8). Without this every pre-session yes would look like a
           * mid-session one to `lib/ai/notes.ts`, which decides whether to
           * stamp the note by comparing this against the session start.
           */
          { recordingStartedAt: new Date() }),
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        /*
         * 🔴 A grant is refused when anybody has already declined. A decline
         * is unconditional: it may always land, including over an earlier
         * decline, which is idempotent.
         */
        consent === "granted"
          ? sql`${sessions.recordingConsent} IS DISTINCT FROM 'declined'`
          : undefined,
      ),
    )
    .returning({ id: sessions.id });

  if (landed.length === 0) {
    log.info("consent grant not applied, somebody in this session declined");
    return;
  }

  // Deliberately not through the PHI audit helper: there is no actor with a
  // user id here, and the fact recorded is about consent rather than about
  // anybody reading a chart.
  log.info("recording consent recorded", { consent, version: RECORDING_CONSENT_VERSION });

  /*
   * 🔴 41.8 — THE BOT IS DISPATCHED HERE, AND NOWHERE ELSE (C216).
   *
   * > *There is no bot button, and that is the design. A button a therapist
   * > can forget is a session that silently went untranscribed; a button they
   * > can press is a bot that can be sent somewhere it should not go.*
   *
   * This function is the one place a consent answer is written, reached from
   * both the join form and the standalone consent screen, so putting dispatch
   * anywhere else would mean two dispatchers or a path that misses one.
   *
   * 🔴 A DECLINE DISPATCHES NOTHING AT ALL. Not a bot that joins and stays
   * quiet. That is the ethics — a recorder in the room of somebody who said no
   * is a recorder they were told would not be there — and it is also the cost
   * answer the "knock like Google Meet" design loses on, since Recall bills
   * per bot-hour and a bot on a declined session is money spent recording
   * nothing.
   *
   * It lands in the right order by itself: the patient consents on our page
   * before being forwarded to the meeting, so the bot is already in the room
   * when they arrive and nobody watches it appear mid-conversation.
   *
   * Awaited, but every failure inside is swallowed and logged. Nothing about a
   * recorder may stop a patient reaching their session.
   */
  if (consent === "granted") {
    const { sendBotForConsent } = await import("@/lib/meetings/dispatch");
    await sendBotForConsent(sessionId);
    return;
  }

  /*
   * 🔴 41.7, the other half of the couples rule.
   *
   * One person consents, the bot is dispatched, and their partner then
   * declines. The decline landed above and refuses the audio, but a recorder
   * we already sent is sitting in the meeting — and the person who just said
   * no can see it in the participant list. Withdrawing it is not tidiness, it
   * is the difference between a rule and a claim.
   *
   * Harmless when no bot was ever sent: `withdrawBot` reads the row, finds no
   * `bot_id`, and returns.
   */
  const [row] = await db
    .select({ organizationId: sessions.organizationId, patientId: sessions.patientId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (row) {
    const { withdrawBot } = await import("@/lib/meetings/dispatch");
    await withdrawBot({
      sessionId,
      organizationId: row.organizationId,
      patientId: row.patientId,
      reason: "consent_withdrawn",
    });
  }
}

/** Polled by the waiting room until the clinician starts. */
export async function checkJoinState(token: string): Promise<{
  live: boolean;
  ended: boolean;
  recording: boolean;
  startedAt: string | null;
  /**
   * The two controls from §3 / 7.8, on the same poll as everything else.
   *
   * On this poll rather than on their own read so the panel cannot drift from
   * the recording indicator six pixels above it — they are answers to the same
   * question and a patient seeing them disagree has no way to know which one
   * to believe.
   */
  consent: {
    recording: "granted" | "declined" | null;
    profileShare: "granted" | "declined" | null;
  };
  /**
   * The same countdown the clinician sees.
   *
   * A patient watching a session approach its end deserves to know before it
   * happens, in the same words and against the same clock. Giving the timer to
   * only one side of a conversation makes the other side's "we should wrap up"
   * arrive out of nowhere.
   */
  clock: {
    stage: ClockStage;
    remainingSeconds: number;
  } | null;
}> {
  const session = await resolveJoinToken(token);
  if (!session) {
    return {
      live: false,
      ended: true,
      recording: false,
      startedAt: null,
      clock: null,
      consent: { recording: null, profileShare: null },
    };
  }

  /*
   * Whether the microphone is actually running, not merely whether a session
   * exists.
   *
   * The patient is entitled to know this at a glance and at all times. A
   * clinician can pause the recording mid-session, and a person who agreed to
   * be recorded has to be able to see when that changed without asking.
   */
  /*
   * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
   */
  const { dbFor } = await import("@/lib/db");
  const { pinnedToDefaultRegion } = await import("@/lib/db/region");
  const db = dbFor(pinnedToDefaultRegion("app/join/[token]/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));
  const { sessions } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select({
      recordingPausedAt: sessions.recordingPausedAt,
      startedAt: sessions.startedAt,
      patientJoinedAt: sessions.patientJoinedAt,
      recordingConsent: sessions.recordingConsent,
      profileShareConsent: sessions.profileShareConsent,
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

  /*
   * The cap is enforced off whichever side is still watching.
   *
   * The clinician's laptop going to sleep is the single most likely reason a
   * session runs past fifty minutes, and it is exactly the case where their
   * room has stopped polling. The patient's page is often the only thing still
   * asking us anything, so it gets to end the session too — the UPDATE is
   * guarded on `in_progress`, so both sides racing is a no-op for whoever
   * arrives second.
   */
  const { readSessionClock, autoEndSession } = await import("@/lib/data/sessions");
  const clock = await readSessionClock(session.id);

  if (clock.shouldEnd && clock.endReason) {
    const ended = await autoEndSession(session.id, clock.endReason);
    if (ended.ended) {
      const { after } = await import("next/server");
      const { finishSession } = await import("@/lib/session-finish");
      after(() =>
        finishSession({
          sessionId: session.id,
          organizationId: ended.organizationId!,
          therapistId: ended.therapistId!,
          patientId: ended.patientId ?? null,
        }),
      );
    }
    return {
      live: false,
      ended: true,
      recording: false,
      startedAt: null,
      clock: null,
      consent: { recording: null, profileShare: null },
    };
  }

  return {
    live,
    ended: false,
    recording: live && !row?.recordingPausedAt,
    startedAt: row?.startedAt?.toISOString() ?? null,
    consent: {
      recording: row?.recordingConsent ?? null,
      profileShare: row?.profileShareConsent ?? null,
    },
    clock: live
      ? {
          stage: clock.stage,
          remainingSeconds: clock.remainingSeconds,
        }
      : null,
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
  /* 🔴 K9: the room holds the join token, so it is looked up as one. */
  return recordArrival({ token, serviceStars, email, via: "join" });
}

/* --------------------------------------------- 7.8: turning a control on -- */

/**
 * Turn a control on, mid-session. §3 / 7.8.
 *
 * ## One direction only
 *
 * §3: "Wants to turn it off — cannot. End the session; answer no next time."
 * That is not a UI convenience, it is the only honest option: minutes already
 * captured exist, and a switch that appears to un-record them would be telling
 * the patient something false at the moment they are most relying on it. The
 * *therapist* can still pause the microphone; what nobody can do is make the
 * first ten minutes stop having happened.
 *
 * ## The stamp
 *
 * Turning recording on writes `recording_started_at` if it is not already set.
 * That timestamp is what puts *"recording began at 10:32; earlier conversation
 * not captured"* on the note — see `lib/ai/notes.ts`. Without it a note about a
 * half-recorded session reads as a complete record.
 */
export async function turnOnConsent(
  token: string,
  control: "recording" | "profileShare",
): Promise<{ ok?: boolean; error?: string }> {
  const session = await resolveJoinToken(token);
  if (!session) return { error: "This link is no longer valid." };

  const { RECORDING_CONSENT_VERSION } = await import("@/lib/consent");
  /*
   * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
   */
  const { dbFor } = await import("@/lib/db");
  const { pinnedToDefaultRegion } = await import("@/lib/db/region");
  const db = dbFor(pinnedToDefaultRegion("app/join/[token]/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));
  const { sessions } = await import("@/lib/db/schema");
  const { and, eq, isNull, or, ne } = await import("drizzle-orm");

  const now = new Date();

  if (control === "profileShare") {
    await db
      .update(sessions)
      .set({ profileShareConsent: "granted", profileShareConsentAt: now })
      .where(
        // Conditional so a second tap, or a stale tab, cannot rewrite the
        // moment they agreed.
        and(eq(sessions.id, session.id), or(isNull(sessions.profileShareConsent), ne(sessions.profileShareConsent, "granted"))),
      );
    log.info("profile share consent granted mid-session");
    return { ok: true };
  }

  await db
    .update(sessions)
    .set({
      recordingConsent: "granted",
      recordingConsentAt: now,
      recordingConsentVersion: RECORDING_CONSENT_VERSION,
      /*
       * Un-pause, because a declined session was paused on the way in and a
       * consent that leaves the microphone off is a consent that changed
       * nothing.
       */
      recordingPausedAt: null,
      recordingStartedAt: now,
    })
    .where(
      and(
        eq(sessions.id, session.id),
        // Only if the microphone has never started. A session already
        // recording keeps its original start time — that is the number the
        // note quotes, and moving it would make the stamp a lie.
        isNull(sessions.recordingStartedAt),
      ),
    );

  log.info("recording consent granted mid-session");
  return { ok: true };
}

/**
 * 🔴 48.10 — the patient's own off-record button.
 *
 * `offRecord` in `components/session/session-room.tsx` is a CLINICIAN control,
 * and until now it was the only one. So the person whose words are being
 * recorded, and whose consent is the entire basis for recording them, could
 * agree at the door and then have no way to change their mind except by asking
 * the other person in the room to press a button for them. In a therapy
 * session that is not a small asymmetry.
 *
 * ## What it does NOT do, and why
 *
 * It stops the audio. It does not delete what was already captured.
 *
 * That looks like the less generous choice and is the safer one: a chart that
 * rewrites itself is worse than one with a gap. A note drafted from a
 * transcript that has since been silently shortened is a clinical document
 * whose evidence no longer matches it, and nobody reading it later can tell.
 * The gap is honest and 47.2 already gives it a name and a duration on the
 * note itself.
 *
 * A patient who wants what was captured removed is asking for erasure, which
 * is a different request with a different process, and one that should go
 * through a person rather than a button in a live session.
 *
 * Idempotent by the same conditional-write pattern as `turnOnConsent`: a
 * second tap or a stale tab cannot rewrite the moment it stopped.
 */
export async function stopRecording(token: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await resolveJoinToken(token);
  if (!session) return { error: "This link is no longer valid." };

  /*
   * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
   */
  const { dbFor } = await import("@/lib/db");
  const { pinnedToDefaultRegion } = await import("@/lib/db/region");
  const db = dbFor(pinnedToDefaultRegion("app/join/[token]/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));
  const { sessions } = await import("@/lib/db/schema");
  const { and, eq, isNull } = await import("drizzle-orm");

  /*
   * 🔴 Task 123 — the patient's Stop is a withdrawal, not a pause.
   *
   * It used to set only `recording_paused_at`, the switch the clinician's
   * off-record button also sets, and the clinician's Resume clears it. So a
   * clinician could turn the microphone back on over the patient's own Stop.
   * Withdrawing consent as well makes `mayRecord` refuse whatever the pause
   * says, and `turnOnConsent` cannot re-grant once a recording has started.
   */
  const stoppedAt = new Date();
  await db
    .update(sessions)
    .set({ recordingPausedAt: stoppedAt })
    .where(and(eq(sessions.id, session.id), isNull(sessions.recordingPausedAt)));
  await db
    .update(sessions)
    .set({ recordingConsent: "declined", recordingConsentAt: stoppedAt })
    .where(eq(sessions.id, session.id));

  /*
   * 🔴 41.7 — consent revoked mid-session, and the bot LEAVES.
   *
   * Pausing the transcript is enough when the audio is ours: the 24Therapy
   * room stops sending it. It is NOT enough in somebody else's meeting, where
   * a recorder we dispatched is sitting in the call. A patient who withdraws
   * consent and can still see a bot in the participant list has been told one
   * thing and shown another, and they are right to believe the list.
   *
   * The pause above is what refuses the audio and is under our control; this
   * is what removes the recorder and depends on the provider. Both, in that
   * order, so a failed API call still leaves nothing being processed.
   */
  const { withdrawBot } = await import("@/lib/meetings/dispatch");
  await withdrawBot({
    sessionId: session.id,
    organizationId: session.organizationId,
    patientId: session.patientId ?? null,
    reason: "consent_withdrawn",
  });

  log.info("recording stopped by the patient");
  return { ok: true };
}

/**
 * 🔴 76.35 — THE PATIENT SHRANK THE ROOM, OR OPENED IT BACK UP.
 *
 * ## What the clinician cannot otherwise know
 *
 * Minimising does not leave the call. The iframe stays mounted, the audio never
 * stops, and that is the whole feature: a patient can take a phone call, look
 * something up or read a message without dropping out of a session they may
 * have waited a week for.
 *
 * Which means every signal the clinician has says the patient is present,
 * because they are. From the clinician's side that is indistinguishable from
 * somebody looking straight at them and saying nothing, and those are very
 * different things in a therapy session: one is a silence to sit with, the
 * other is a person who has stepped away from the screen. Reading the wrong one
 * is a clinical error, not a UI annoyance.
 *
 * The patient's browser is the only thing that knows. This is it saying so.
 *
 * ## 🔴 THE TOKEN IS THE CREDENTIAL, AND IT WRITES ONE NULLABLE COLUMN
 *
 * The same credential the whole join flow runs on. A person holding the link
 * can say they minimised their own session, which is the entire privilege this
 * grants, and the column carries no clinical fact at all.
 *
 * ## 🔴 FAILURE IS SILENT, AND THAT IS THE RIGHT TRADE
 *
 * The caller fires this and does not wait. A patient tapping minimise must see
 * the orb instantly: they are reaching for another app, and a spinner on the
 * way out is the worst possible moment for one. If the write is lost the
 * clinician sees a patient who appears present, which is exactly what they saw
 * before this existed.
 */
export async function setSessionMinimised(
  token: string,
  minimised: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await resolveJoinToken(token);
  if (!session) return { error: "This link is no longer valid." };

  /*
   * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
   */
  const { dbFor } = await import("@/lib/db");
  const { pinnedToDefaultRegion } = await import("@/lib/db/region");
  const db = dbFor(pinnedToDefaultRegion("app/join/[token]/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));
  const { sessions } = await import("@/lib/db/schema");
  const { and, eq } = await import("drizzle-orm");

  /*
   * 🔴 ONLY WHILE THE SESSION IS RUNNING. A minimise arriving after the room
   * closed would leave a finished session marked as having somebody away in it,
   * which is a state the clinician's own screen would then have to explain.
   */
  await db
    .update(sessions)
    .set({ patientMinimisedAt: minimised ? new Date() : null })
    .where(and(eq(sessions.id, session.id), eq(sessions.status, "in_progress")));

  return { ok: true };
}

/**
 * 🔴 W1-11: "Something is wrong, tell 24Therapy", from inside the room.
 *
 * The box used to call the feedback page's `reportSession` with the JOIN
 * token, which looks up the feedback token, so every report was refused and
 * the screen said "Sent to 24Therapy" anyway. This resolves the session by the
 * link the patient is actually holding and files into the same report queue
 * an operator reads. The caller shows whatever comes back, error included.
 */
export async function reportFromRoom(input: {
  token: string;
  detail: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const attempt = await consume(await callerKey("report"), 10, 600);
  if (!attempt.allowed) return { error: "Too many reports from this connection." };

  const { fileReport } = await import("@/lib/data/feedback");
  const filed = await fileReport({
    token: String(input.token ?? ""),
    kind: "abuse",
    detail: String(input.detail ?? ""),
    email: "",
    via: "join",
  });
  if (filed.error) return { error: filed.error };

  log.info("report filed from the room", { session: ref(filed.sessionId) });
  return { ok: true };
}
