import "server-only";

import { and, asc, eq, isNotNull, isNull, lte, notInArray, or, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  organizations,
  patientCredits,
  patients,
  sessionPayments,
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
 * product charging somebody for its own failure. Cheaper is fine, and when
 * nothing has been charged yet the patient is simply asked for the cheaper
 * price (14.6, P3 in `reassignSession`).
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
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(
      and(
        eq(therapistRadar.status, "online"),
        isNull(users.deletedAt),
        sql`${users.id} <> ${input.excludeUserId}`,
        // 🔴 14.3 — equal or lower. Never "and pay the difference".
        lte(users.sessionRateCents, input.paidCents),
        /*
         * A clinician cannot take a payment without somewhere for it to go:
         * a Stripe account, or, in Egypt, the manual payout every Egyptian
         * clinician is paid through. This read Stripe alone, so in Egypt the
         * offer was always empty.
         */
        or(eq(users.chargesEnabled, true), eq(organizations.region, "eg")),
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
 * No patient credit is written for a difference in price (P3, below): when
 * nothing has been charged the price follows the replacement, and when money
 * has already moved the payment follows the replacement instead.
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
      paymentStatus: sessions.paymentStatus,
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
   * 🔴 P3: THE DIFFERENCE IS REFUNDED IN ITS SIMPLEST FORM WHEN NOTHING HAS BEEN
   * TAKEN YET: IT IS NEVER CHARGED.
   *
   * The credit this used to write was never spent by anything, and paying the
   * difference back after the fact needs a partial refund that neither the
   * card path nor the refund queue has. But a patient who has not paid yet
   * does not need anything given back. The price follows the clinician, so the
   * pay page, the card checkout and the transfer all quote the replacement's
   * rate, and the replacement is paid on what they charge.
   *
   * "Nothing taken" is asked inside the UPDATE, because a payment that
   * appears between the read above and this write carries the old price:
   *
   *   - `payment_status <> 'paid'`: no settled payment
   *   - no `session_payments` row: no card checkout opened and no benefit
   *     split frozen at booking, both of which were priced at the old figure
   *   - no live `manual_payments` row: no transfer quoted or declared
   *
   * Otherwise the price stays, and the payment follows the replacement below.
   * A free replacement also stops asking for payment at all.
   */
  const unchargedSql = sql`(
    ${sessions.paymentStatus} <> 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM session_payments sp WHERE sp.session_id = ${input.sessionId}
    )
    AND NOT EXISTS (
      SELECT 1 FROM manual_payments mp
       WHERE mp.purpose = 'session' AND mp.ref_id = ${input.sessionId}
         AND mp.state IN ('awaiting_proof', 'submitted')
    )
  )`;

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
      priceCents: sql<number>`CASE WHEN ${unchargedSql} THEN ${rate} ELSE ${sessions.priceCents} END`,
      paymentStatus: sql<
        "not_required" | "pending" | "paid"
      >`CASE WHEN ${unchargedSql} AND ${rate} <= 0 THEN 'not_required' ELSE ${sessions.paymentStatus} END`,
      updatedAt: now,
    })
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.therapistId, row.therapistId)))
    .returning({ id: sessions.id, priceCents: sessions.priceCents });

  if (!moved) return { ok: false, error: "Somebody else already moved that session." };

  /*
   * 🔴 THE MONEY FOLLOWS THE PERSON WHO HELD THE SESSION.
   *
   * The payment and what we owe for it stayed with the clinician who did not
   * join, so the one who stepped in was never paid and the absent one was.
   * The payment moves, and the ledger moves what we owe from one to the
   * other in one balanced transaction.
   *
   * 🔴 AND NO CREDIT. A credit for the difference was promised "off your next
   * session automatically" and nothing ever spent it. Where money had already
   * moved, the patient pays what they agreed to and the clinician who helped
   * them earns it; where it had not, the price already moved above (P3).
   */
  const [paid] = await db
    .select({
      id: sessionPayments.id,
      net: sessionPayments.therapistNetCents,
      therapistId: sessionPayments.therapistId,
      organizationId: sessionPayments.organizationId,
      fundingSource: sessionPayments.fundingSource,
      sponsorShareCents: sessionPayments.sponsorShareCents,
      patientShareCents: sessionPayments.patientShareCents,
      platformFeeBps: sessionPayments.platformFeeBps,
    })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.sessionId, input.sessionId), eq(sessionPayments.status, "paid")))
    .limit(1);
  let creditCents = 0;
  if (paid) {
    await db
      .update(sessionPayments)
      .set({ therapistId: input.toUserId, organizationId: replacement.organizationId })
      .where(eq(sessionPayments.id, paid.id));
    const { journal } = await import("@/lib/billing/ledger");
    if (paid.net > 0 && paid.therapistId && paid.therapistId !== input.toUserId) {
      /* `session_repriced`, so a later refund's reversal (`bookedLegs`) sees the move too. */
      await journal({
        kind: "session_repriced",
        refType: "session_payment",
        refId: paid.id,
        legs: [
          { account: "therapist_payable", amountCents: paid.net, organizationId: paid.organizationId, userId: paid.therapistId, memo: "Session held by another clinician" },
          { account: "therapist_payable", amountCents: -paid.net, organizationId: replacement.organizationId, userId: input.toUserId, memo: "Held a session another clinician missed" },
        ],
      });
    }

    /*
     * 🔴 0169 / RULINGS 7 AND 7b: CHEAPER, AND ALREADY PAID. The session now
     * costs what the replacement charges. The difference goes back: the
     * company's part to its pot, the patient's to their wallet, spent on their
     * next session. Only on a session wholly paid, with a patient who has a
     * wallet to hold it; otherwise the price stays and the replacement earns it.
     */
    const difference = moved.priceCents - rate;
    const { getSettings, sessionMoney } = await import("@/lib/settings");
    const settings = await getSettings();
    if (difference > 0 && row.personId && row.paymentStatus === "paid" && settings.rules.wallet.enabled) {
      const shares = paid.fundingSource === "pot" ? paid.sponsorShareCents + paid.patientShareCents : 0;
      const toPot = shares > 0 ? Math.round((difference * paid.sponsorShareCents) / shares) : 0;
      const toWallet = difference - toPot;
      const { returnPartToPot } = await import("@/lib/billing/pot");
      const potBack = await returnPartToPot({ paymentId: paid.id, cents: toPot, reason: "A cheaper clinician held the session" });
      if (potBack.error) {
        log.error("repricing skipped: the company's part could not go back to its pot", { session: ref(input.sessionId), reason: potBack.error });
      } else {
        const newNet = sessionMoney({
          grossCents: rate,
          feeBps: paid.platformFeeBps || settings.session.platformFeeBps,
          vatBps: 0,
        }).therapistNetCents;
        const lessNet = Math.max(0, Math.min(difference, paid.net - newNet));
        const lessFee = difference - lessNet;
        await journal({
          kind: "session_repriced",
          refType: "session_payment",
          refId: paid.id,
          legs: [
            { account: "therapist_payable", amountCents: lessNet, organizationId: replacement.organizationId, userId: input.toUserId, memo: "Held at their own, lower price" },
            { account: "platform_revenue", amountCents: lessFee, organizationId: replacement.organizationId, memo: "Our fee on the lower price" },
            { account: "cash", amountCents: -difference, organizationId: replacement.organizationId, memo: "The difference, going back" },
          ],
        });
        await db
          .update(sessionPayments)
          .set({
            grossCents: sql`${sessionPayments.grossCents} - ${difference}`,
            platformFeeCents: sql`${sessionPayments.platformFeeCents} - ${lessFee}`,
            therapistNetCents: sql`${sessionPayments.therapistNetCents} - ${lessNet}`,
            sponsorShareCents: sql`GREATEST(0, ${sessionPayments.sponsorShareCents} - ${toPot})`,
            patientShareCents: sql`GREATEST(0, ${sessionPayments.patientShareCents} - ${toWallet})`,
          })
          .where(eq(sessionPayments.id, paid.id));
        await db.update(sessions).set({ priceCents: rate, updatedAt: new Date() }).where(eq(sessions.id, input.sessionId));
        if (toWallet > 0) {
          const { creditWallet } = await import("@/lib/billing/wallet");
          await creditWallet({
            personId: row.personId,
            cents: toWallet,
            reason: "A cheaper clinician held your session",
            fromSessionId: input.sessionId,
            from: [{ account: "cash", amountCents: toWallet, organizationId: replacement.organizationId, memo: "Into the patient's wallet" }],
          });
          creditCents = toWallet;
        }
      }
    }
  }

  log.info("session reassigned", {
    session: ref(input.sessionId),
    repriced: moved.priceCents !== row.priceCents,
  });

  return { ok: true, outcome: "reassigned", creditCents };
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
   * money back when we still held it. `refunded` is written below, only once
   * it is true.
   *
   * 🔴 W1-27: AND WHAT IS TRUE NOW IS WRITTEN IN THE SAME STATEMENT. The row
   * says `cancelled` when nothing was paid and `refund_owed` while we hold the
   * money, decided from the payment row inside this UPDATE so the status and
   * the outcome cannot disagree. It used to write neither, because the
   * column's CHECK had no word for them (0120 added both).
   */
  const [marked] = await db
    .update(sessions)
    .set({
      status: "cancelled",
      recoveryOfferedAt: now,
      recoveryOutcome: sql<"refund_owed" | "cancelled">`CASE WHEN EXISTS (
        SELECT 1 FROM session_payments paid
         WHERE paid.session_id = ${input.sessionId} AND paid.status = 'paid'
      ) THEN 'refund_owed' ELSE 'cancelled' END`,
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
    .returning({ id: sessions.id, outcome: sessions.recoveryOutcome });

  if (!marked) {
    return { ok: false, error: "That session is not overdue or has already been resolved." };
  }

  const { sessionPayments } = await import("@/lib/db/schema");
  const [payment] =
    marked.outcome === "refund_owed"
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
    return { ok: true, outcome: marked.outcome === "refund_owed" ? "refund_owed" : "cancelled" };
  }

  const { refundSessionPayment } = await import("@/lib/billing/connect");
  const result = await refundSessionPayment({
    paymentId: payment.id,
    reason: "Therapist did not join. Automatic refund.",
    // 🔴 Nobody ordered this. The clock did.
    adminUserId: null,
    why: "no_show",
  });
  if ("error" in result && result.error) {
    /*
     * The session stays cancelled with `refund_owed` on it, the payment stays
     * `paid` because we still hold it, and the failure is loud. A refund that silently did not happen
     * is money we are holding from somebody we have already let down once.
     */
    log.error("no-show refund failed, refund owed", {
      session: ref(input.sessionId),
      reason: result.error,
    });
    // 🔴 W1-28a: and the promise becomes somebody's job on the refund queue.
    const { openRefundRequest } = await import("@/lib/billing/refunds");
    await openRefundRequest({
      sessionPaymentId: payment.id,
      requestedByUserId: null,
      reason: "no_show",
    });
    return { ok: true, outcome: "refund_owed" };
  }

  /*
   * 🔴 W2-S12: `refunded` only if money went back to the patient. A session
   * their company covered in full, or whose share they had not paid yet, gave
   * the company its money back and returned none of theirs: that is a
   * cancellation, and "you have been refunded" would be untrue.
   */
  /* W2-M04: their transfer-paid share is on the refund queue, which is owed, not sent. */
  if (result.queuedCents) return { ok: true, outcome: "refund_owed" };
  const outcome = result.toPayerCents === 0 ? "cancelled" : "refunded";
  await db
    .update(sessions)
    .set({ recoveryOutcome: outcome, updatedAt: new Date() })
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.recoveryOutcome, "refund_owed")));

  return { ok: true, outcome };
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
