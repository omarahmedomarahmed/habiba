import "server-only";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { patientCredits, patients, sessions, walletHolds } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

import { journal } from "./ledger";

/**
 * 🔴 0169 / RULINGS 7 AND 7b: THE PATIENT'S WALLET.
 *
 * Money we hold for a patient: the difference when a replacement clinician
 * costs less than the one who did not come (their own share; the company's goes
 * back to the pot). It is never paid out and cannot be topped up. It is spent
 * automatically, after any company benefit and before anything the patient is
 * asked to pay: benefit, then wallet, then card or transfer.
 *
 * ## How the money moves
 *
 * The wallet works like the pot. At booking, after `payFromPot`, a HOLD takes
 * the wallet's share of what the patient still owes, drawing on their credits
 * oldest-expiring first. `patientOwesFor` subtracts it, so every screen and
 * rail asks for less. When the rest is paid, the claim to `paid` spends the
 * hold. Every rail books the patient's whole share as cash, as though no
 * wallet existed, so spending posts the correction: less cash came in, and the
 * wallet liability goes down by the same amount.
 *
 *   spend    patient_wallet +w   cash -w
 *   credit   patient_wallet -w   (the other side is the caller's)
 *   return   patient_wallet -w   cash +w   (a paid session refunded)
 *
 * A hold on a session that is cancelled before it is paid is RELEASED: the
 * credits get back what was drawn and nothing was ever booked.
 */

type Draw = { creditId: string; cents: number };
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** "0 months" in the rule means a credit never expires. */
async function expiryFor(now: Date): Promise<Date> {
  const { getSettings } = await import("@/lib/settings");
  const months = (await getSettings()).rules.wallet.expiryMonths;
  const at = new Date(now);
  if (months <= 0) at.setUTCFullYear(at.getUTCFullYear() + 100);
  else at.setUTCMonth(at.getUTCMonth() + months);
  return at;
}

/** What a person can spend now: live credits, less what they already drew. */
export async function walletBalanceCents(personId: string): Promise<number> {
  const [row] = await db
    .select({ cents: sql<number>`COALESCE(SUM(${patientCredits.amountCents} - ${patientCredits.spentCents}), 0)::int` })
    .from(patientCredits)
    .where(and(eq(patientCredits.personId, personId), gt(patientCredits.expiresAt, new Date())));
  return Math.max(0, row?.cents ?? 0);
}

/** The wallet's share of one session: what it holds or has spent there, else zero. */
export async function walletCentsOn(sessionId: string): Promise<number> {
  const [hold] = await db
    .select({ cents: walletHolds.cents })
    .from(walletHolds)
    .where(and(eq(walletHolds.sessionId, sessionId), inArray(walletHolds.state, ["held", "spent"])))
    .limit(1);
  return hold?.cents ?? 0;
}

/** What the wallet actually PAID for a session: a spent hold, else zero. A refund sends this much less. */
export async function walletSpentOn(sessionId: string): Promise<number> {
  const [hold] = await db
    .select({ cents: walletHolds.cents })
    .from(walletHolds)
    .where(and(eq(walletHolds.sessionId, sessionId), eq(walletHolds.state, "spent")))
    .limit(1);
  return hold?.cents ?? 0;
}

/**
 * Money into the wallet. The caller supplies the other side of the books,
 * because only it knows where the money came from; this adds the wallet leg.
 */
export async function creditWallet(input: {
  personId: string;
  cents: number;
  reason: string;
  fromSessionId: string | null;
  /** The legs that balance the wallet leg (together they sum to `+cents`). */
  from: { account: "therapist_payable" | "platform_revenue" | "cash"; amountCents: number; organizationId?: string | null; userId?: string | null; memo: string }[];
  /**
   * 🔴 K16c (ME23): `wallet_return` when the money is coming BACK to the
   * wallet it was spent from (a paid session refunded), so the books tell a
   * return from new credit. The kind was declared in 0169 and never written.
   */
  kind?: "wallet_credit" | "wallet_return";
  /** K16c (ME25): inside the caller's transaction, so the credit and the move that owes it land together. */
  executor?: Executor;
  /** Read before a transaction opens (one connection), so the expiry is not asked inside it. */
  expiresAt?: Date;
}): Promise<{ creditId: string } | null> {
  if (input.cents <= 0) return null;
  const now = new Date();
  const run = input.executor ?? db;
  const [credit] = await run
    .insert(patientCredits)
    .values({
      personId: input.personId,
      amountCents: input.cents,
      reason: input.reason.slice(0, 200),
      fromSessionId: input.fromSessionId,
      expiresAt: input.expiresAt ?? (await expiryFor(now)),
    })
    .returning({ id: patientCredits.id });
  await journal({
    kind: input.kind ?? "wallet_credit",
    refType: "patient_credit",
    refId: credit!.id,
    ...(input.executor ? { executor: input.executor } : {}),
    legs: [
      ...input.from,
      {
        account: "patient_wallet",
        amountCents: -input.cents,
        organizationId: input.from[0]?.organizationId ?? null,
        memo: input.reason.slice(0, 200),
      },
    ],
  });
  log.info("wallet credited", { credit: ref(credit!.id), cents: input.cents });
  return { creditId: credit!.id };
}

/**
 * The wallet's share of a session the patient is about to pay for, held.
 *
 * After any company benefit, so benefit comes first. Only a session still
 * waiting for money, and never twice (one hold per session, unique in the
 * table). An in-person session takes it only on the patient's own word, like
 * the benefit: nothing proves one happened, so no therapist can spend it.
 *
 * When the wallet covers everything the patient owes, the session is paid now.
 */
export async function holdWallet(
  sessionId: string,
  opts: { byPersonId?: string } = {},
): Promise<{ heldCents: number; paid: boolean }> {
  const none = { heldCents: 0, paid: false };
  const { getSettings } = await import("@/lib/settings");
  if (!(await getSettings()).rules.wallet.enabled) return none;

  const [row] = await db
    .select({
      personId: patients.personId,
      paymentStatus: sessions.paymentStatus,
      status: sessions.status,
      modality: sessions.modality,
      priceCents: sessions.priceCents,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row?.personId || row.priceCents <= 0 || row.paymentStatus !== "pending" || row.status === "cancelled") return none;
  if (row.modality === "in_person" && opts.byPersonId !== row.personId) return none;
  const personId = row.personId;

  const { patientOwesFor } = await import("./session-owed");
  const owed = await patientOwesFor(sessionId);
  if (owed.grossCents <= 0 || owed.walletCents > 0) return none;

  const now = new Date();
  const held = await db.transaction(async (tx) => {
    const credits = await tx
      .select({ id: patientCredits.id, amount: patientCredits.amountCents, spent: patientCredits.spentCents })
      .from(patientCredits)
      .where(
        and(
          eq(patientCredits.personId, personId),
          gt(patientCredits.expiresAt, now),
          sql`${patientCredits.spentCents} < ${patientCredits.amountCents}`,
        ),
      )
      .orderBy(asc(patientCredits.expiresAt), asc(patientCredits.createdAt))
      .for("update");

    let left = owed.grossCents;
    const draws: Draw[] = [];
    for (const credit of credits) {
      if (left <= 0) break;
      const take = Math.min(left, credit.amount - credit.spent);
      if (take <= 0) continue;
      await tx
        .update(patientCredits)
        .set({ spentCents: sql`${patientCredits.spentCents} + ${take}`, updatedAt: now })
        .where(eq(patientCredits.id, credit.id));
      draws.push({ creditId: credit.id, cents: take });
      left -= take;
    }
    const cents = draws.reduce((sum, d) => sum + d.cents, 0);
    if (cents <= 0) return 0;

    const [hold] = await tx
      .insert(walletHolds)
      .values({ personId, sessionId, cents, draws })
      .onConflictDoNothing({ target: walletHolds.sessionId })
      .returning({ id: walletHolds.id });
    /* Another request held it first: undo this one's draws with the rest of the transaction. */
    if (!hold) throw new WalletRace();
    return cents;
  }).catch((error: unknown) => {
    if (error instanceof WalletRace) return 0;
    throw error;
  });

  if (held <= 0) return none;
  log.info("wallet held", { session: ref(sessionId), cents: held });

  if (held < owed.grossCents) return { heldCents: held, paid: false };

  /* The wallet paid all of it: the session is paid now, and booked like a transfer of nothing. */
  const { claimSessionPaid } = await import("./session-owed");
  if (!(await claimSessionPaid(sessionId))) return { heldCents: held, paid: false };
  const { postPatientSettlement } = await import("./manual-grants");
  await postPatientSettlement({ sessionId, settlesCents: 0, paidAt: now, logRef: sessionId });
  const { markInSession } = await import("@/lib/data/radar");
  await markInSession(sessionId);
  return { heldCents: held, paid: true };
}

class WalletRace extends Error {}

/** The practice a session belongs to, so a wallet leg lands in the same entity's books as the session's. */
async function practiceOf(sessionId: string): Promise<string | null> {
  const [row] = await db.select({ id: sessions.organizationId }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  return row?.id ?? null;
}

/**
 * The session is paid: the hold is spent, once. Called from `claimSessionPaid`,
 * the one claim every rail makes, so no rail can forget it.
 */
export async function spendHold(sessionId: string): Promise<void> {
  const [spent] = await db
    .update(walletHolds)
    .set({ state: "spent", spentAt: new Date() })
    .where(and(eq(walletHolds.sessionId, sessionId), eq(walletHolds.state, "held")))
    .returning({ id: walletHolds.id, cents: walletHolds.cents });
  if (!spent) return;
  const organizationId = await practiceOf(sessionId);
  await journal({
    kind: "wallet_spend",
    refType: "wallet_hold",
    refId: spent.id,
    legs: [
      { account: "patient_wallet", amountCents: spent.cents, organizationId, memo: "Wallet spent on a session" },
      { account: "cash", amountCents: -spent.cents, organizationId, memo: "Paid from the wallet, not received" },
    ],
  });
}

/**
 * A hold on a session that was never paid goes back to the credits it came
 * from. Nothing was booked, so nothing is reversed.
 */
export async function releaseHold(sessionId: string): Promise<number> {
  const released = await db.transaction(async (tx) => {
    const [hold] = await tx
      .update(walletHolds)
      .set({ state: "released", returnedAt: new Date() })
      .where(and(eq(walletHolds.sessionId, sessionId), eq(walletHolds.state, "held")))
      .returning({ cents: walletHolds.cents, draws: walletHolds.draws });
    if (!hold) return 0;
    for (const draw of hold.draws) {
      await tx
        .update(patientCredits)
        .set({ spentCents: sql`GREATEST(0, ${patientCredits.spentCents} - ${draw.cents})`, updatedAt: new Date() })
        .where(eq(patientCredits.id, draw.creditId));
    }
    return hold.cents;
  });
  if (released > 0) log.info("wallet hold released", { session: ref(sessionId), cents: released });
  return released;
}

/**
 * A PAID session is refunded: the wallet's part goes back to the wallet, never
 * to a card, because it never came from one. As a fresh credit, so a credit
 * that expired meanwhile does not take the patient's money with it. Returns
 * what went back, which the refund subtracts from what it sends.
 */
export async function returnSpentHold(sessionId: string, reason: string): Promise<number> {
  /* Read before the transaction: the pool has one connection and the transaction holds it. */
  const organizationId = await practiceOf(sessionId);
  const expiresAt = await expiryFor(new Date());
  /*
   * 🔴 K16c (ME25): ONE TRANSACTION. The hold was marked returned and the
   * credit written in two statements, so a failure between them left a hold
   * `returned` with no money back in the wallet, and nothing could retry it
   * because the hold was no longer `spent`.
   */
  return db.transaction(async (tx) => {
    const [hold] = await tx
      .update(walletHolds)
      .set({ state: "returned", returnedAt: new Date() })
      .where(and(eq(walletHolds.sessionId, sessionId), eq(walletHolds.state, "spent")))
      .returning({ id: walletHolds.id, cents: walletHolds.cents, personId: walletHolds.personId });
    if (!hold) return 0;
    await creditWallet({
      personId: hold.personId,
      cents: hold.cents,
      reason: `Returned: ${reason}`,
      fromSessionId: sessionId,
      kind: "wallet_return",
      executor: tx,
      expiresAt,
      from: [{ account: "cash", amountCents: hold.cents, organizationId, memo: "Refunded to the wallet it came from" }],
    });
    return hold.cents;
  });
}

/**
 * 🔴 K16c (ME24): A CREDIT THAT EXPIRED LEAVES THE BOOKS AS WELL AS THE BALANCE.
 *
 * `walletBalanceCents` stops counting a credit past `expires_at`, and nothing
 * posted, so `patient_wallet` went on saying we owed the patient money they
 * could no longer spend, for ever. Hourly, each expired credit's unspent part
 * is released from the liability: `patient_wallet` down, and the money is
 * ours (`platform_revenue`), the same way an expired gift card is.
 *
 * `expired_cents` (0171) is what has been released so far, claimed with a
 * conditional UPDATE, so a second run releases nothing, and a hold released
 * after the expiry (which gives drawn money back to the credit) is released
 * on the next run as the difference.
 */
export async function expireWalletCredits(
  now = new Date(),
  /** One person only: how a verifier asks without expiring everybody else. */
  onlyPersonId?: string,
): Promise<{ expired: number; cents: number }> {
  const rows = await db
    .select({
      id: patientCredits.id,
      amount: patientCredits.amountCents,
      spent: patientCredits.spentCents,
      released: patientCredits.expiredCents,
      fromSessionId: patientCredits.fromSessionId,
    })
    .from(patientCredits)
    .where(
      and(
        sql`${patientCredits.expiresAt} <= ${now}`,
        sql`${patientCredits.amountCents} - ${patientCredits.spentCents} > ${patientCredits.expiredCents}`,
        onlyPersonId ? eq(patientCredits.personId, onlyPersonId) : undefined,
      ),
    )
    .limit(500);

  let expired = 0;
  let cents = 0;
  for (const row of rows) {
    const due = row.amount - row.spent - row.released;
    if (due <= 0) continue;
    const organizationId = row.fromSessionId ? await practiceOf(row.fromSessionId) : null;
    const done = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(patientCredits)
        .set({ expiredCents: sql`${patientCredits.expiredCents} + ${due}`, updatedAt: new Date() })
        .where(
          and(
            eq(patientCredits.id, row.id),
            eq(patientCredits.expiredCents, row.released),
            eq(patientCredits.spentCents, row.spent),
          ),
        )
        .returning({ id: patientCredits.id });
      if (!claimed) return false;
      await journal({
        kind: "wallet_expired",
        refType: "patient_credit",
        refId: row.id,
        executor: tx,
        legs: [
          { account: "patient_wallet", amountCents: due, organizationId, memo: "Wallet credit expired unspent" },
          { account: "platform_revenue", amountCents: -due, organizationId, memo: "Expired wallet credit" },
        ],
      });
      return true;
    });
    if (done) {
      expired += 1;
      cents += due;
    }
  }
  if (expired > 0) log.info("wallet credits expired", { count: expired, cents });
  return { expired, cents };
}

/**
 * Hourly: a hold whose session was cancelled, or is no longer waiting for
 * money without having been paid (made free, paid in cash in the room), is
 * released. Any path that ends a session without paying it is covered here
 * rather than by remembering this in each of them.
 */
export async function sweepWalletHolds(): Promise<number> {
  const stale = await db
    .select({ sessionId: walletHolds.sessionId })
    .from(walletHolds)
    .innerJoin(sessions, eq(sessions.id, walletHolds.sessionId))
    .where(
      and(
        eq(walletHolds.state, "held"),
        sql`(${sessions.status} = 'cancelled' OR ${sessions.paymentStatus} = 'not_required' OR ${sessions.priceCents} <= 0)`,
      ),
    )
    .limit(200);
  let n = 0;
  for (const row of stale) if ((await releaseHold(row.sessionId)) > 0) n += 1;
  return n;
}
