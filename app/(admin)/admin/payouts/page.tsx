import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { PayoutQueue } from "@/components/admin/payout-queue";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { reconcile } from "@/lib/billing/ledger";
import { manualQueue } from "@/lib/billing/payouts";
import { formatUsd } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { earningsTransfers, users } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The queue the 24/7 team works. PLAN.md 16.3, 16.3a, 16.8.
 *
 * Two views (16.3a) because they are two jobs — manual EGP transfers somebody
 * has to make, and Stripe payouts that already happened — and the daily
 * reconciliation (16.8) at the top, because the one number a finance team
 * needs is whether the books balance, and burying it under a list is how it
 * stops being read.
 */
export default async function PayoutsPage() {
  const actor = await requireRole("super_admin");

  const [manual, books, automated] = await Promise.all([
    manualQueue(),
    reconcile(),
    db
      .select({
        id: earningsTransfers.id,
        amountCents: earningsTransfers.amountCents,
        status: earningsTransfers.status,
        createdAt: earningsTransfers.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(earningsTransfers)
      .innerJoin(users, eq(users.id, earningsTransfers.therapistId))
      .orderBy(desc(earningsTransfers.createdAt))
      .limit(50),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Payouts" subtitle="The manual rail, and the automatic one." />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {/* 🔴 16.8 — money held is money owed, checked rather than asserted. */}
        <Card className={books.balances ? "p-4" : "border-rose-200 bg-rose-50 p-4"}>
          <p className="text-sm font-semibold text-slate-900">
            {books.balances ? "The books balance" : "🔴 The books do not balance"}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Cash</dt>
              <dd className="font-medium">{formatUsd(books.cashCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Held for clinicians</dt>
              <dd className="font-medium">{formatUsd(books.heldForTherapistsCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Out of balance</dt>
              <dd className="font-medium">{formatUsd(books.outOfBalanceCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Unbalanced entries</dt>
              <dd className="font-medium">{books.unbalancedTxns.length}</dd>
            </div>
          </dl>

          <p className="mt-2 text-xs text-slate-500">
            By entity:{" "}
            {books.cashByEntity
              .map((row) => `${row.entity.toUpperCase()} ${formatUsd(row.cashCents)}`)
              .join(" · ") || "nothing yet"}
            {books.unbackedEntity.length > 0
              ? ` · 🔴 paying out of an entity that never collected: ${books.unbackedEntity.join(", ")}`
              : ""}
          </p>
        </Card>

        <PayoutQueue
          manual={manual.map((row) => ({
            id: row.id,
            therapistName: row.therapistName,
            amountCents: row.amountCents,
            payoutAmountMinor: row.payoutAmountMinor,
            payoutCurrency: row.payoutCurrency,
            method: row.method,
            identifier: row.identifier,
            accountName: row.accountName,
            status: row.status,
            entity: row.entity,
            ageHours: row.ageHours,
            overdue: row.overdue,
            needsTwoPeople: row.needsTwoPeople,
            owned: row.ownerUserId !== null,
            requestedAtLabel: formatDate(row.requestedAt, actor.timezone),
            proofUrl: row.proofUrl,
          }))}
          automated={automated.map((row) => ({
            id: row.id,
            therapistName: [row.firstName, row.lastName].filter(Boolean).join(" "),
            amountCents: row.amountCents,
            status: row.status,
            createdAtLabel: formatDate(row.createdAt, actor.timezone),
          }))}
        />
      </div>
    </div>
  );
}
