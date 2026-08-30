import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { EarningsCard } from "@/components/billing/earnings";
import { PaymentHistory } from "@/components/billing/payment-history";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import {
  accountBalance,
  earningsSummary,
  getConnectAccount,
  recentPayments,
} from "@/lib/billing/connect";
import { transfersForTherapist } from "@/lib/billing/ledger";
import { formatUsd } from "@/lib/billing/plans";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Earnings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Money in.
 *
 * Split from `/billing`, which is money out. They were one page and the page
 * was answering two unrelated questions with the same word — "what do I owe
 * 24Therapy" and "what have my patients paid me" are not two views of a
 * balance, they are two balances, and a clinician checking whether they can
 * pay rent should not have to read past an invoice list to find out.
 */
export default async function EarningsPage() {
  const actor = await requireUser();

  const [connect, earnings, payments, balance, transfers] = await Promise.all([
    getConnectAccount(actor.userId),
    earningsSummary(actor.userId),
    recentPayments(actor.userId, 50),
    accountBalance(actor.userId),
    transfersForTherapist(actor.userId),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Earnings" subtitle="What your patients have paid you." />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {!features.billing ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            Payments are not configured on this deployment, so nothing is being charged.
          </p>
        ) : null}

        <EarningsCard
          connected={Boolean(connect.accountId)}
          payoutsEnabled={connect.payoutsEnabled}
          availableCents={balance?.availableCents ?? null}
          pendingCents={balance?.pendingCents ?? null}
          lifetimeNetCents={earnings.lifetimeNetCents}
          thisMonthNetCents={earnings.thisMonthNetCents}
          platformFeesCents={earnings.platformFeesCents}
          settledFromEarningsCents={earnings.settledFromEarningsCents}
          paidSessionCount={earnings.paidSessionCount}
          heldCents={earnings.heldCents}
        />

        {/*
          The one thing a held balance can do before it is released.
          ---------------------------------------------------------
          Their own 24Therapy bills. No money leaves Stripe for this — we owe
          them less and they owe us less by the same amount — so it works
          during verification, which is exactly when a clinician is most likely
          to have both an unpaid bill and money they cannot reach.
        */}
        {earnings.heldCents > 0 ? (
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">
              Your held earnings pay your 24Therapy bills
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              While {formatUsd(earnings.heldCents)} is with us, any session bill you run up is
              cleared from it automatically. Nothing to pay by card, and nothing to remember.
            </p>
            <Link
              href="/billing"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
            >
              See what you owe
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Card>
        ) : null}

        <PaymentHistory
          payments={payments.map((payment) => ({
            id: payment.id,
            payerName: payment.payerName,
            grossCents: payment.grossCents,
            therapistNetCents: payment.therapistNetCents,
            settledInvoiceCents: payment.settledInvoiceCents,
            status: payment.status,
            capture: payment.capture,
            paymentBrand: payment.paymentBrand,
            paymentLast4: payment.paymentLast4,
            receiptUrl: payment.receiptUrl,
            createdAt: formatDate(payment.createdAt),
            paidAt: payment.paidAt ? formatDate(payment.paidAt) : null,
          }))}
          transfers={transfers.map((transfer) => ({
            id: transfer.id,
            amountCents: transfer.amountCents,
            status: transfer.status,
            createdAt: formatDate(transfer.createdAt),
            paidAt: transfer.paidAt ? formatDate(transfer.paidAt) : null,
            failureReason: transfer.failureReason,
          }))}
        />
      </div>
    </div>
  );
}
