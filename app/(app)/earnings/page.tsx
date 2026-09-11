import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { EarningsCard } from "@/components/billing/earnings";
import { PaymentHistory } from "@/components/billing/payment-history";
import { Withdraw } from "@/components/billing/withdraw";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import {
  accountBalance,
  earningsSummary,
  getConnectAccount,
  recentPayments,
} from "@/lib/billing/connect";
import { heldForTherapist, transfersForTherapist } from "@/lib/billing/ledger";
import { defaultMethodFor, payoutsForTherapist } from "@/lib/billing/payouts";
import { formatUsd } from "@/lib/billing/plans";
import { features } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

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
  const { locale } = await getI18n();
  const actor = await requireUser();

  const [connect, earnings, payments, balance, transfers, held, method, requests, settings] =
    await Promise.all([
      getConnectAccount(actor.userId),
      earningsSummary(actor.userId),
      recentPayments(actor.userId, 50),
      accountBalance(actor.userId),
      transfersForTherapist(actor.userId),
      heldForTherapist(actor.userId),
      defaultMethodFor(actor.userId),
      payoutsForTherapist(actor.userId),
      getSettings(),
    ]);

  /*
   * 🔴 16.10 — "available" excludes money already on its way.
   *
   * Held is what the ledger says we owe them. Requested and sent are the parts
   * of it that are somewhere in the queue. Available is what is left, and it
   * is the only figure with a button next to it: showing a balance that
   * includes money halfway out of the door invites a second request for money
   * that is already gone.
   */
  const requestedCents = requests
    .filter((r) => r.status === "requested" || r.status === "approved")
    .reduce((total, r) => total + r.amountCents, 0);
  const sentCents = requests
    .filter((r) => r.status === "sent")
    .reduce((total, r) => total + r.amountCents, 0);
  const availableCents = Math.max(0, held - requestedCents - sentCents);

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

        {/*
          The manual rail (§3c). Shown to anybody we are holding money for, or
          who has asked for a payout before — which is exactly the set of
          clinicians Stripe cannot pay, and the reason this rail exists.
        */}
        {held > 0 || requests.length > 0 ? (
          <Withdraw
            heldCents={held}
            requestedCents={requestedCents}
            sentCents={sentCents}
            availableCents={availableCents}
            methods={settings.payouts.egyptPayoutMethods}
            method={
              method
                ? {
                    method: method.method,
                    identifier: method.identifier,
                    accountName: method.accountName,
                  }
                : null
            }
            history={requests.map((row) => ({
              id: row.id,
              amountCents: row.amountCents,
              payoutAmountMinor: row.payoutAmountMinor,
              payoutCurrency: row.payoutCurrency,
              status: row.status,
              requestedAtLabel: formatDate(row.requestedAt, actor.timezone, locale),
              movedAtLabel: row.confirmedAt
                ? formatDate(row.confirmedAt, actor.timezone, locale)
                : row.sentAt
                  ? formatDate(row.sentAt, actor.timezone, locale)
                  : row.approvedAt
                    ? formatDate(row.approvedAt, actor.timezone, locale)
                    : null,
              proofUrl: row.proofUrl,
              rejectedReason: row.rejectedReason,
              accountName: row.accountName,
            }))}
          />
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
            createdAt: formatDate(payment.createdAt, actor.timezone, locale),
            paidAt: payment.paidAt ? formatDate(payment.paidAt, actor.timezone, locale) : null,
          }))}
          transfers={transfers.map((transfer) => ({
            id: transfer.id,
            amountCents: transfer.amountCents,
            status: transfer.status,
            createdAt: formatDate(transfer.createdAt, actor.timezone, locale),
            paidAt: transfer.paidAt ? formatDate(transfer.paidAt, actor.timezone, locale) : null,
            failureReason: transfer.failureReason,
          }))}
        />
      </div>
    </div>
  );
}
