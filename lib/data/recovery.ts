import "server-only";

import { and, asc, eq, isNotNull, isNull, lte, notInArray, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  patientCredits,
  patients,
  sessions,
  therapistRadar,
  users,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/recovery.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * What happens to somebody sitting in an empty room. PLAN.md 14.1–14.6.
 *
 * ## The clock, and why it is short
 *
 * | | |
 * |---|---|
 * | 0–5 min | *"joining shortly"*. No blame — a laptop that slept, a
 *             notification that never arrived |
 * | at 5 min | a replacement is offered, from the live radar, **and** the
 *             no-show is recorded |
 * | nobody suitable | **full refund and an apology**. Never left waiting |
 *
 * Five minutes, not fifteen. Somebody who booked a therapy session and is
 * staring at an empty room is having a specific and bad experience, and the
 * product's job is to end it — either with a person or with an honest apology
 * and their money back.
 *
 * ## 🔴 Equal or lower price, never higher
 *
 * 14.3. A patient who paid for a $30 session is not offered a $60 clinician
 * and asked for the difference: they have already been let down once, and
 * "your therapist did not turn up, that will be another thirty dollars" is the
 * product charging somebody for its own failure. Cheaper is fine and the
 * difference comes back as credit (14.6).
 */

/** How long somebody waits before we call it. 14.1 / 14.2. */
export const NO_SHOW_AFTER_MINUTES = 5;

/**
 * 🔴 WHETHER THERE IS A NO-SHOW TO RECOVER FROM AT ALL, asked by every path.
 *
 * The session id is the capability, and `started_at IS NULL` was the only
 * condition the three paths shared. That is true of every session booked for
 * next week, so anybody holding an id could refund it, hand it (and its chart)
 * to another clinician, or stamp a no-show on the clinician's public
 * reliability score, days before it was due. The join page only SHOWS the
 * rescue after the scheduled time; nothing on the server asked.
 *
 * Due means: a scheduled time at least `NO_SHOW_AFTER_MINUTES` ago, the patient
 * actually in the waiting room, nobody started, and not already cancelled or
 * finished. One rule, here, so the offer and both writes cannot drift apart
 * again.
 */
export function recoveryDue(
  row: {
    scheduledAt: Date | null;
    startedAt: Date | null;
    patientJoinedAt: Date | null;
    status: string;
  },
  now: Date = new Date(),
): boolean {
  if (!row.scheduledAt || row.startedAt || !row.patientJoinedAt) return false;
  if (row.status === "cancelled" || row.status === "completed") return false;
  return now.getTime() - row.scheduledAt.getTime() >= NO_SHOW_AFTER_MINUTES * 60_000;
}

/**
 * 🔴 W1-08: WHETHER THE SESSION'S OWN RECORD SAYS THE CLINICIAN NEVER JOINED.
 *
 * A patient's "they never joined" refunded them and suspended the clinician on
 * the report alone. That stays automatic only when the record agrees: a video
 * session in our own room, due at least `NO_SHOW_AFTER_MINUTES` ago, never
 * started, never recorded, still `scheduled` and not already recovered. Every
 * other case (a started session, an in-person or external meeting we cannot
 * see into, a cancelled or already refunded one, a claim made early) goes to
 * a person in the admin report queue.
 */
export function noShowProven(
  row: {
    scheduledAt: Date | null;
    startedAt: Date | null;
    recordingStartedAt: Date | null;
    status: string;
    modality: string;
    recoveryOutcome: string | null;
    externalMeeting: boolean;
  },
  now: Date = new Date(),
): boolean {
  if (!row.scheduledAt || row.startedAt || row.recordingStartedAt) return false;
  if (row.status !== "scheduled" || row.modality !== "video") return false;
  if (row.externalMeeting || row.recoveryOutcome) return false;
  return now.getTime() - row.scheduledAt.getTime() >= NO_SHOW_AFTER_MINUTES * 60_000;
}

/** The facts `noShowProven` reads, for one session. Null when there is no such session. */
export async function noShowFacts(sessionId: string) {
  const { sessionSources } = await import("@/lib/db/schema");
  const [row] = await db
    .select({
      scheduledAt: sessions.scheduledAt,
      startedAt: sessions.startedAt,
      recordingStartedAt: sessions.recordingStartedAt,
      status: sessions.status,
      modality: sessions.modality,
      recoveryOutcome: sessions.recoveryOutcome,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  // Held anywhere but our own room, and nothing here can say who was in it.
  const sources = await db
    .select({ kind: sessionSources.kind })
    .from(sessionSources)
    .where(eq(sessionSources.sessionId, sessionId));
  return { ...row, externalMeeting: sources.some((source) => source.kind !== "24t_room") };
}

/** 14.6 — a patient's credit lasts as long as a therapist's. */
export const CREDIT_MONTHS = 12;

export type Replacement = {
  userId: string;
  name: string;
  sessionRateCents: number;
  headline: string | null;
};

/**
 * Clinicians who could take this session right now. 14.3.
 *
 * Live on the radar, not the person who failed to appear, and **at or below**
 * what the patient already paid. Ordered cheapest first: the patient's credit
 * back is larger and the replacement is no worse for being cheaper — price on
 * this platform is what somebody chose to charge, not a quality ranking.
 */
export async function replacementsFor(input: {
  sessionId: string;
  paidCents: number;
  excludeUserId: string;
}): Promise<Replacement[]> {
  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      sessionRateCents: users.sessionRateCents,
      headline: therapistRadar.headline,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .where(
      and(
        eq(therapistRadar.status, "online"),
        isNull(users.deletedAt),
        sql`${users.id} <> ${input.excludeUserId}`,
        // 🔴 14.3 — equal or lower. Never "and pay the difference".
        lte(users.sessionRateCents, input.paidCents),
        // A clinician cannot take a payment without somewhere for it to go.
        eq(users.chargesEnabled, true),
        isNull(therapistRadar.suspendedUntil),
      ),
    )
    .orderBy(asc(users.sessionRateCents))
    .limit(10);

  return rows.map((row) => ({
    userId: row.userId,
    name: [row.firstName, row.lastName].filter(Boolean).join(" "),
    sessionRateCents: row.sessionRateCents ?? 0,
    headline: row.headline,
  }));
}

export type RecoveryResult =
  | { ok: true; outcome: "reassigned"; creditCents: number }
  | { ok: true; outcome: "refunded" }
  /** 🔴 W1-12: cancelled, and nothing was ever taken, so nothing goes back. */
  | { ok: true; outcome: "cancelled" }
  /** 🔴 W1-12: cancelled, money taken, and it could not be returned automatically. */
  | { ok: true; outcome: "refund_owed" }
  | { ok: false; error: string };

/**
 * Hand the session to somebody who is actually there. 14.5 / 14.6.
 *
 * The row **moves**. `therapistId` becomes the replacement and
 * `reassignedFromUserId` remembers who did not turn up, so the reliability
 * score (14.7) has something to count and the patient's booking, payment and
 * history stay on one row.
 *
 * The difference in price comes back as patient credit rather than a card
 * refund: refunding ten dollars costs more in fees than it returns, and the
 * patient is far more likely to want another session than ten dollars.
 */
export async function reassignSession(input: {
  sessionId: string;
  toUserId: string;
}): Promise<RecoveryResult> {
  const now = new Date();

  const [row] = await db
    .select({
      id: sessions.id,
      therapistId: sessions.therapistId,
      priceCents: sessions.priceCents,
      patientId: sessions.patientId,
      personId: patients.personId,
      status: sessions.status,
      startedAt: sessions.startedAt,
      scheduledAt: sessions.scheduledAt,
      patientJoinedAt: sessions.patientJoinedAt,
      outcome: sessions.recoveryOutcome,
      organizationId: sessions.organizationId,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, input.sessionId))
    .limit(1);

  if (!row) return { ok: false, error: "That session no longer exists." };
  if (row.status === "completed") {
    return { ok: false, error: "That session has already finished." };
  }

  /*
   * 🔴 THE SAME HOLE `refundNoShow` HAD, AND IT WAS WORSE HERE.
   *
   * This function sets BOTH `therapist_id` and `organization_id` to the
   * replacement's, and `getSession` scopes its read on exactly those two
   * columns. So reassigning a session is the same act as granting somebody full
   * read on its transcript, its note and the patient's chart.
   *
   * Refusing only `completed` left every `scheduled` and `in_progress` session
   * reassignable by anybody who learned the id, through a server action with no
   * caller check at all. A live therapy session could be taken over mid
   * sentence, and the taker would then hold the record.
   *
   * `started_at IS NULL` is the condition that makes "the session id is the
   * capability" true: the id can do one thing, and only in the state the
   * feature exists for. `recovery_outcome IS NULL` closes the second press.
   */
  if (row.startedAt) {
    return { ok: false, error: "That session has already started." };
  }
  if (row.outcome) {
    return { ok: false, error: "That session has already been resolved." };
  }
  if (!recoveryDue(row, now)) {
    return { ok: false, error: "That session is not overdue, so there is nothing to recover from yet." };
  }

  if (row.therapistId === input.toUserId) {
    return { ok: false, error: "That is the same clinician." };
  }

  const [replacement] = await db
    .select({ sessionRateCents: users.sessionRateCents, organizationId: users.organizationId })
    .from(users)
    .where(and(eq(users.id, input.toUserId), isNull(users.deletedAt)))
    .limit(1);

  if (!replacement) return { ok: false, error: "That clinician is not available." };

  /*
   * 🔴 The ceiling is re-checked here, not only in `replacementsFor`.
   *
   * The list is a suggestion rendered on a screen; this is the write. A
   * clinician who raised their price between the two, or an id typed by hand,
   * must not be able to charge a let-down patient more than they already paid.
   */
  const rate = replacement.sessionRateCents ?? 0;
  if (rate > row.priceCents) {
    return { ok: false, error: "That clinician charges more than this session was paid for." };
  }

  /*
   * Conditional on the therapist not having changed, so two operators pressing
   * "reassign" at the same moment produce one move rather than two.
   */
  const [moved] = await db
    .update(sessions)
    .set({
      therapistId: input.toUserId,
      organizationId: replacement.organizationId,
      reassignedFromUserId: row.therapistId,
      reassignedAt: now,
      recoveryOutcome: "reassigned",
      updatedAt: now,
    })
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.therapistId, row.therapistId)))
    .returning({ id: sessions.id });

  if (!moved) return { ok: false, error: "Somebody else already moved that session." };

  const difference = Math.max(0, row.priceCents - rate);

  if (difference > 0 && row.personId) {
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + CREDIT_MONTHS);

    await db.insert(patientCredits).values({
      personId: row.personId,
      amountCents: difference,
      fromSessionId: input.sessionId,
      reason: "Your therapist did not join, and the person who stepped in charges less.",
      expiresAt,
    });
  }

  log.info("session reassigned", {
    session: ref(input.sessionId),
    creditCents: difference,
  });

  return { ok: true, outcome: "reassigned", creditCents: difference };
}

/**
 * Nobody suitable is online. 14.4.
 *
 * 🔴 A full refund and an apology, and the refund is the *whole* amount
 * including our cut. We do not keep a platform fee on a session that did not
 * happen — taking 15% of somebody's disappointment is indefensible on any
 * reading of the ledger.
 *
 * The caller sends the apology; this records the decision and moves the money,
 * because a data module that sends messages is a data module you cannot test.
 */
export async function refundNoShow(input: { sessionId: string }): Promise<RecoveryResult> {
  const now = new Date();

  /*
   * 🔴 THE THERAPIST MUST ACTUALLY HAVE FAILED TO APPEAR, AND UNTIL THIS SPRINT
   * NOTHING CHECKED IT.
   *
   * The caller has no account on purpose: somebody who booked from a public
   * profile has none, and the moment their therapist does not turn up is the
   * worst possible moment to ask them to make one. W1-07: the action now asks
   * for their join link (or a signed-in patient who owns the session) and
   * hands this function the id only once that is proved.
   *
   * That argument only holds while the id can do **one** thing. The WHERE below
   * used to be `id = X AND recovery_outcome IS NULL`, which is every scheduled,
   * live and completed session in the product. So a server action reachable by
   * anybody who learned a session UUID could:
   *
   *   - set a session that was `in_progress` to `cancelled`, which makes
   *     `resolveJoinToken` return null and ejects a patient from a live therapy
   *     session with no explanation and no way back, or
   *   - refund a completed, delivered, fully paid session in full, reversing
   *     the therapist's earnings and our fee, on a rail with no chargeback to
   *     recover it.
   *
   * `started_at IS NULL` is the whole of the fix, and it belongs here rather
   * than in the action so that it holds for every caller. It is the same
   * condition `offerReplacements` already checked before OFFERING the choice;
   * the read path had it and the two write paths did not.
   */
  /*
   * 🔴 W1-12: THE CLAIM IS THE CANCELLATION, NOT THE REFUND.
   *
   * This used to write `recovery_outcome = 'refunded'` here, before any money
   * moved, and then only log a refund that failed. Every bank-transfer payment
   * fails it (no Stripe charge to reverse), so a patient was told they had their
   * money back when we still held it. `status` leaving `scheduled` is what makes
   * the second press lose; `refunded` is written below, only once it is true.
   */
  const [marked] = await db
    .update(sessions)
    .set({
      status: "cancelled",
      recoveryOfferedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(sessions.id, input.sessionId),
        isNull(sessions.recoveryOutcome),
        isNull(sessions.startedAt),
        // `recoveryDue`, in SQL, so the check and the write are one statement.
        isNotNull(sessions.patientJoinedAt),
        notInArray(sessions.status, ["cancelled", "completed"]),
        lte(sessions.scheduledAt, new Date(now.getTime() - NO_SHOW_AFTER_MINUTES * 60_000)),
      ),
    )
    .returning({ id: sessions.id, priceCents: sessions.priceCents });

  if (!marked) {
    return { ok: false, error: "That session is not overdue or has already been resolved." };
  }

  const { sessionPayments } = await import("@/lib/db/schema");
  const [payment] =
    marked.priceCents > 0
      ? await db
          .select({ id: sessionPayments.id })
          .from(sessionPayments)
          .where(
            and(eq(sessionPayments.sessionId, input.sessionId), eq(sessionPayments.status, "paid")),
          )
          .limit(1)
      : [];

  if (!payment) {
    // Nothing settled, so there is nothing to give back, and nothing was
    // refunded either. The cancellation is the whole remedy.
    log.info("no-show cancelled, nothing settled", { session: ref(input.sessionId) });
    return { ok: true, outcome: "cancelled" };
  }

  const { refundSessionPayment } = await import("@/lib/billing/connect");
  const result = await refundSessionPayment({
    paymentId: payment.id,
    reason: "Therapist did not join. Automatic refund.",
    // 🔴 Nobody ordered this. The clock did.
    adminUserId: null,
  });
  if ("error" in result && result.error) {
    /*
     * The session stays cancelled, the payment stays `paid` because we still
     * hold it, and the failure is loud. A refund that silently did not happen
     * is money we are holding from somebody we have already let down once.
     */
    log.error("no-show refund failed, refund owed", {
      session: ref(input.sessionId),
      reason: result.error,
    });
    return { ok: true, outcome: "refund_owed" };
  }

  await db
    .update(sessions)
    .set({ recoveryOutcome: "refunded", updatedAt: new Date() })
    .where(eq(sessions.id, input.sessionId));

  return { ok: true, outcome: "refunded" };
}

/**
 * Mark the wait. 14.2.
 *
 * Separate from the recovery so the *fact* survives whatever the patient
 * chooses next — including closing the tab, which is the outcome nothing else
 * would record.
 */
export async function recordNoShow(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ noShowAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.noShowAt)));
}

/* ------------------------------------------------------- 14.7 reliability -- */

export type Reliability = {
  /** Sessions that started, over sessions that should have. 0–1, or null. */
  rate: number | null;
  /** How many the score is computed from. Below `MIN_FOR_SCORE`, `rate` is null. */
  sessions: number;
  noShows: number;
};

/**
 * Below this, there is no score. 14.7.
 *
 * Five. A clinician who has run three sessions and missed one is not "67%
 * reliable" — that is a number with no information in it, and putting it on a
 * public profile would punish somebody for being new far more than for being
 * unreliable. Null is honest; a small denominator dressed as a percentage is
 * not. Same reasoning as C35's straddled turns: unknown beats a confident
 * wrong answer.
 */
export const MIN_FOR_SCORE = 5;

export async function reliabilityFor(userId: string): Promise<Reliability> {
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      noShows: sql<number>`COUNT(*) FILTER (WHERE ${sessions.noShowAt} IS NOT NULL)::int`,
    })
    .from(sessions)
    .where(
      and(
        // Counted against whoever was *supposed* to be there. A session that
        // was handed on still counts against the person who did not appear —
        // that is the entire point of keeping `reassigned_from_user_id`.
        sql`(${sessions.therapistId} = ${userId} OR ${sessions.reassignedFromUserId} = ${userId})`,
        sql`${sessions.scheduledAt} IS NOT NULL`,
        sql`${sessions.scheduledAt} < now()`,
      ),
    );

  const total = row?.total ?? 0;
  const noShows = row?.noShows ?? 0;

  return {
    rate: total >= MIN_FOR_SCORE ? (total - noShows) / total : null,
    sessions: total,
    noShows,
  };
}
