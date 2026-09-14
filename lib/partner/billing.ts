import "server-only";

import { and, eq, gte, lt, sql } from "drizzle-orm";

import { journal } from "@/lib/billing/ledger";
import { controlDb } from "@/lib/db";
import { partnerSessions, partners } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

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
 */
export async function billFor(input: {
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
        eq(partnerSessions.billable, true),
        gte(partnerSessions.createdAt, input.periodStart),
        lt(partnerSessions.createdAt, periodEnd),
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
 * 🔴 68.19 — POST THE MONTH. Called by the cron, after the month has closed.
 *
 * Two legs, balanced: what they owe us, and the revenue it represents. The same shape
 * `postSessionPayment` uses, because a partner's bill is not a different kind of
 * money from a therapist's fee and inventing a third account for it would be a third
 * thing to reconcile.
 *
 * 🔴 IDEMPOTENT ON THE PERIOD, through `refType`/`refId`. A cron that runs twice
 * against a closed month must not bill twice, and the check is a read of the ledger
 * rather than a flag on the partner: the ledger is the record, so asking it is asking
 * the thing that decides.
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

  const refId = `${input.partnerId}:${input.periodStart.toISOString().slice(0, 7)}`;

  const { ledgerEntries } = await import("@/lib/db/schema");
  const [already] = await controlDb
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.refType, "partner_month"), eq(ledgerEntries.refId, refId)),
    )
    .limit(1);

  if (already) return { posted: false, totalCents: bill.totalCents };

  await journal({
    kind: "invoice_raised",
    refType: "partner_month",
    refId,
    legs: [
      {
        account: "therapist_receivable",
        amountCents: bill.totalCents,
        memo: `${bill.partnerName}: ${bill.sessions} sessions`,
      },
      {
        account: "platform_revenue",
        amountCents: -bill.totalCents,
        memo: `${bill.partnerName}: ${bill.sessions} sessions`,
      },
    ],
  });

  log.info("partner month billed", {
    partner: ref(input.partnerId),
    sessions: bill.sessions,
  });

  return { posted: true, totalCents: bill.totalCents };
}

/** Every partner's closed month, for the cron to walk. */
export async function billAllPartners(now = new Date()): Promise<{ billed: number }> {
  /*
   * 🔴 THE PREVIOUS MONTH, never the current one. Billing a month that is still
   * running charges for part of it and then charges again at the end, or charges
   * once for a partial month and never for the rest: both are wrong and the second
   * is wrong in our favour, which is the worse of the two.
   */
  const current = periodOf(now);
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
