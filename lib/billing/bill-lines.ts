import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { invoices, payableCents } from "@/lib/db/schema";

import type { PaymentLine } from "./manual";

/**
 * 🔴 76.16 — WHICH INVOICES A CLINICIAN CHOSE, PRICED AND WORDED ONCE.
 *
 * ## The problem this exists to have one answer to
 *
 * A clinician on pay-as-you-go accrues one invoice per session. Eleven sessions
 * is eleven rows, and until now the transfer rail had exactly one control and it
 * said pay all of it. The real month has three of those disputed and eight that
 * need paying today, and the product's answer to that was to pay nothing.
 *
 * The moment they can choose, three separate things need the same answer: what
 * the total is, what the sheet prints under it, and what the row records. Three
 * derivations of one set is how a payer is shown one figure, charged another and
 * credited a third, which is the failure 0106 was written about.
 *
 * ## 🔴 THE WHERE CLAUSE IS THE SECURITY, NOT THE CALLER
 *
 * The ids arrive from a browser. Every one of them is pinned to this
 * organisation and to `status = 'due'` inside the query, so a foreign id or an
 * already-paid one buys nothing: it silently is not in the result, and the total
 * is the total of what was actually found. `sumPayable` established the rule and
 * this follows it.
 *
 * ## An empty selection means the whole bill
 *
 * Which is the old behaviour, and the honest reading of somebody who opened the
 * sheet without touching the picker. `grantSubscription` settles oldest first
 * either way, so the two agree about which invoices a part payment clears.
 */
export async function billLines(
  organizationId: string,
  invoiceIds: string[],
): Promise<{ totalCents: number; lines: PaymentLine[] }> {
  const mine = eq(invoices.organizationId, organizationId);
  const due = eq(invoices.status, "due");

  const rows = await db
    .select({
      id: invoices.id,
      description: invoices.description,
      amountCents: invoices.amountCents,
      discountCents: invoices.discountCents,
    })
    .from(invoices)
    .where(
      invoiceIds.length === 0
        ? and(mine, due)
        : and(mine, due, inArray(invoices.id, invoiceIds)),
    )
    /*
     * 🔴 OLDEST FIRST, matching `grantSubscription`. A payer reading a list in
     * one order and an operator confirming a settlement in another is two
     * screens describing the same money differently.
     */
    .orderBy(asc(invoices.issuedAt))
    .limit(200);

  const lines = rows.map((row) => ({
    label: row.description,
    cents: payableCents(row),
  }));

  return {
    /*
     * Summed from what the query FOUND, never from what was asked for. A total
     * computed from the request is a total the request decided.
     */
    totalCents: lines.reduce((sum, line) => sum + line.cents, 0),
    lines,
  };
}
