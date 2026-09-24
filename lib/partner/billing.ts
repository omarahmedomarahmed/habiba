import "server-only";

import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { journal } from "@/lib/billing/ledger";
import { controlDb } from "@/lib/db";
import { ledgerEntries, partnerSessions, partners } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

import { billableBetween } from "./usage";

/**
 * The monthly bill. PLAN.md 68.14, 68.19.
 *
 * ## 🔴 THROUGH THE SAME LEDGER EVERY OTHER FIGURE GOES THROUGH
 *
 * > *Monthly bill from real usage, on the same ledger every other figure in this
 * > product goes through.*
 *
 * There is no parallel invoice path here. C226 settled that when the sponsor pot
 * arrived and the reasoning is identical: a second money path is a second set of
 * arithmetic to reconcile, and the day the two disagree nobody can say which one is
 * the company's actual position. `journal` balances or throws, and the daily
 * reconciliation covers these rows like every other.
 *
 * ## 🔴 COUNTED FROM `billable`, WHICH IS A COLUMN AND NOT A RECOMPUTATION
 *
 * A bill computed by re-deriving which sessions were chargeable would have to replay
 * the limit, the consent log and the environment, and would get a different answer
 * from the one the usage page showed the partner all month. `partner_sessions.billable`
 * is decided once, when the session opens, by the same function that decides whether
 * to do the work at all: the bill and the meter cannot disagree because they are the
 * same column.
 *
 * ## 🔴 C15: IN THE MONTH IT BECAME BILLABLE, ONCE
 *
 * A session is billable from its first audio (`billFirstAudio`), which stamps
 * `startedAt` in the same UPDATE. Counting by `createdAt` lost every session
 * opened in one month and first heard after that month's bill was posted. The
 * meter, the limit and this bill all count through `billableBetween`, and a
 * stamp is written once, so each billable session falls in exactly one month.
 */

function periodOf(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type PartnerBill = {
  partnerId: string;
  partnerName: string;
  periodStart: Date;
  periodEnd: Date;
  sessions: number;
  perSessionCents: number;
  totalCents: number;
};

/**
 * 🔴 68.19 — WHAT ONE PARTNER OWES FOR A CLOSED MONTH.
 *
 * Pure read, so it can be shown on their own screen before it is posted and shown
 * again afterwards without the figures moving. A bill an integrator sees for the
 * first time when it arrives is a bill they dispute.
 *
 * The price is a setting, like every other price in this product, so a reprice is a
 * settings write rather than a deploy and `verify:claims` can compare it to whatever
 * the public page says.
 *
 * 🔴 C15: NOT EXPORTED. A screen reads a month through `closedMonthBill`, which
 * answers from the ledger once the month is posted; this is the preview it falls
 * back to and the count the cron posts. Exported, it is what the usage page
 * called, and a reprice rewrote every bill already sent.
 */
async function billFor(input: {
  partnerId: string;
  periodStart: Date;
}): Promise<PartnerBill | null> {
  const settings = await getSettings();
  const perSessionCents = settings.pricing.partnerSessionCents;

  const periodEnd = new Date(
    Date.UTC(input.periodStart.getUTCFullYear(), input.periodStart.getUTCMonth() + 1, 1),
  );

  const [partner] = await controlDb
    .select({ name: partners.name })
    .from(partners)
    .where(eq(partners.id, input.partnerId))
    .limit(1);

  if (!partner) return null;

  const [counted] = await controlDb
    .select({ sessions: sql<number>`count(*)::int` })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        /* 🔴 LIVE ONLY. A sandbox row can never be billable, and a CHECK says so. */
        eq(partnerSessions.environment, "live"),
        billableBetween(input.periodStart, periodEnd),
      ),
    );

  const sessions = Number(counted?.sessions ?? 0);

  return {
    partnerId: input.partnerId,
    partnerName: partner.name,
    periodStart: input.periodStart,
    periodEnd,
    sessions,
    perSessionCents,
    totalCents: sessions * perSessionCents,
  };
}

/**
 * 🔴 C15: ONE MONTH'S BILL HAS ONE TRANSACTION ID, derived from the partner and
 * the month. `ledger_entries.ref_id` is a uuid, and the bill used to write
 * `<partner>:<YYYY-MM>` into it, which Postgres refuses: the idempotency read
 * threw before anything posted, so no partner was ever billed. The partner is
 * the `refId` now, and the month lives in the transaction id, so asking the
 * ledger "was this month posted" is one indexed read and needs no new column.
 */
function billTxnId(partnerId: string, periodStart: Date): string {
  const hex = createHash("sha256")
    .update(`partner_month:${partnerId}:${periodStart.toISOString().slice(0, 7)}`)
    .digest("hex");
  /* Shaped as an RFC 4122 name-based uuid (version 5 bits, variant 10). */
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * 🔴 68.19 — POST THE MONTH. Called by the cron, after the month has closed.
 *
 * Two legs, balanced: what they owe us, and the revenue it represents.
 *
 * 🔴 C15: `partner_receivable`, NOT `therapist_receivable`. The bill was posted
 * to the account for what clinicians owe us, so the clinicians' figure carried
 * money a company owed and a partner's payment would have settled against it.
 *
 * 🔴 IDEMPOTENT ON THE PERIOD, through the month's transaction id. A cron that runs
 * twice against a closed month must not bill twice, and the check is a read of the
 * ledger rather than a flag on the partner: the ledger is the record, so asking it is
 * asking the thing that decides. The read and the post share one transaction under
 * an advisory lock on that id, so two crons overlapping cannot both read "not yet".
 */
/*
 * 🔴 NOT EXPORTED. `billAllPartners` is the only caller and the only thing that knows
 * which month is closed. An export here is a function somebody calls with the current
 * month, which bills a month that is still running.
 */
async function postMonthlyBill(input: {
  partnerId: string;
  periodStart: Date;
}): Promise<{ posted: boolean; totalCents: number }> {
  const bill = await billFor(input);
  if (!bill || bill.sessions === 0) return { posted: false, totalCents: 0 };

  const txnId = billTxnId(input.partnerId, input.periodStart);
  const memo = `${bill.partnerName}: ${bill.sessions} sessions, ${bill.periodStart.toISOString().slice(0, 7)}`;

  const posted = await controlDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`partner_month:${txnId}`}))`);
    const [already] = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.refType, "partner_month"), eq(ledgerEntries.txnId, txnId)))
      .limit(1);
    if (already) return false;

    await journal({
      kind: "invoice_raised",
      refType: "partner_month",
      refId: input.partnerId,
      txnId,
      executor: tx,
      legs: [
        { account: "partner_receivable", amountCents: bill.totalCents, memo },
        { account: "platform_revenue", amountCents: -bill.totalCents, memo },
      ],
    });
    return true;
  });

  if (posted) {
    log.info("partner month billed", {
      partner: ref(input.partnerId),
      sessions: bill.sessions,
    });
  }

  return { posted, totalCents: bill.totalCents };
}

/**
 * 🔴 C15: A CLOSED MONTH, AS IT WAS BILLED. The usage page showed last month
 * through `billFor`, at today's price, so a reprice rewrote a bill already
 * sent. Once the month is posted the total is the ledger's, and the per-session
 * figure is that total over the sessions it counted (stable: a stamp is written
 * once and the month is closed). Before it is posted, the preview, marked so.
 */
export async function closedMonthBill(input: {
  partnerId: string;
  periodStart: Date;
}): Promise<(PartnerBill & { posted: boolean }) | null> {
  const preview = await billFor(input);
  if (!preview) return null;

  const [ledger] = await controlDb
    .select({
      legs: sql<number>`count(*)::int`,
      totalCents: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.txnId, billTxnId(input.partnerId, input.periodStart)),
        eq(ledgerEntries.account, "partner_receivable"),
      ),
    );
  if (!ledger || Number(ledger.legs) === 0) return { ...preview, posted: false };

  const totalCents = Number(ledger.totalCents);
  return {
    ...preview,
    totalCents,
    perSessionCents: preview.sessions > 0 ? Math.round(totalCents / preview.sessions) : 0,
    posted: true,
  };
}

/**
 * 🔴 C15: an hour after a month closes before it is billed. A first audio stamped
 * at 23:59:59 commits a moment later; a bill posted in that moment would miss it,
 * and the month is never posted again. The cron runs at 03:05 UTC, well past it.
 */
const SETTLE_MS = 60 * 60 * 1000;

/** Every partner's closed month, for the cron to walk. */
export async function billAllPartners(now = new Date()): Promise<{ billed: number }> {
  /*
   * 🔴 THE PREVIOUS MONTH, never the current one. Billing a month that is still
   * running charges for part of it and then charges again at the end, or charges
   * once for a partial month and never for the rest: both are wrong and the second
   * is wrong in our favour, which is the worse of the two.
   */
  const current = periodOf(new Date(now.getTime() - SETTLE_MS));
  const periodStart = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1),
  );

  const rows = await controlDb.select({ id: partners.id }).from(partners);

  let billed = 0;
  for (const row of rows) {
    const result = await postMonthlyBill({ partnerId: row.id, periodStart });
    if (result.posted) billed += 1;
  }

  return { billed };
}
