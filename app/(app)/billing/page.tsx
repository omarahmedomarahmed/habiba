import type { Metadata } from "next";

import { EarningsCard } from "@/components/billing/earnings";
import { BillingLedger } from "@/components/billing/ledger";
import { PlanCard } from "@/components/billing/invoice-list";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import {
  accountBalance,
  earningsSummary,
  getConnectAccount,
  recentPayments,
} from "@/lib/billing/connect";
import { billingSummary, listInvoices } from "@/lib/billing/service";
import { confirmCheckout } from "@/lib/billing/stripe";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const actor = await requireUser();
  const { checkout } = await searchParams;

  // Confirm on redirect as well as by webhook. In preview and local
  // environments Stripe cannot reach the webhook at all, and without this a
  // paid subscription simply never activated.
  if (checkout && checkout !== "cancelled") {
    await confirmCheckout(checkout);
  }

  const [summary, invoices, connect, earnings, payments, balance] = await Promise.all([
    billingSummary(actor.organizationId),
    listInvoices(actor.organizationId),
    getConnectAccount(actor.userId),
    earningsSummary(actor.userId),
    recentPayments(actor.userId),
    accountBalance(actor.userId),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Billing" />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {checkout && checkout !== "cancelled" ? (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
            Payment received — thank you.
          </p>
        ) : null}
        {checkout === "cancelled" ? (
          <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600">
            Checkout cancelled — nothing was charged.
          </p>
        ) : null}

        {!features.billing ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            Payments are not configured on this deployment, so nothing is being charged. Sessions
            still record and notes are still written.
          </p>
        ) : null}

        <PlanCard
          plan={summary.subscription.plan}
          status={summary.subscription.status}
          cancelAtPeriodEnd={summary.subscription.cancelAtPeriodEnd}
          billingEnabled={features.billing}
          sessionsThisMonth={summary.sessionsThisMonth}
          spentThisMonthCents={summary.spentThisMonthCents}
          renewsOn={
            summary.subscription.currentPeriodEnd
              ? formatDate(summary.subscription.currentPeriodEnd)
              : null
          }
        />

        {summary.subscription.plan === "payg" && !summary.subscription.trialSessionUsed ? (
          <p className="rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
            Your first completed session is free.
          </p>
        ) : null}

        {summary.subscription.upcomingDiscountCents > 0 ? (
          <p className="rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
            A credit is waiting on your next invoice
            {summary.subscription.upcomingDiscountReason
              ? ` — ${summary.subscription.upcomingDiscountReason}`
              : ""}
            .
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
        />

        {/*
          One ledger, both directions. Money out (what you owe us) and money in
          (what patients paid you) used to be two disconnected lists on this
          page, so "what happened to my money in March" meant reading both and
          merging them by hand.
        */}
        <BillingLedger
          billingEnabled={features.billing}
          invoices={invoices.map((invoice) => ({
            id: invoice.id,
            kind: invoice.kind,
            description: invoice.description,
            amountCents: invoice.amountCents,
            discountCents: invoice.discountCents,
            discountReason: invoice.discountReason,
            status: invoice.status,
            issuedAt: formatDate(invoice.issuedAt),
            sortAt: invoice.issuedAt.toISOString(),
            paidAt: invoice.paidAt ? formatDate(invoice.paidAt) : null,
            periodStart: invoice.periodStart ? formatDate(invoice.periodStart) : null,
            periodEnd: invoice.periodEnd ? formatDate(invoice.periodEnd) : null,
          }))}
          payments={payments.map((payment) => ({
            id: payment.id,
            payerName: payment.payerName,
            grossCents: payment.grossCents,
            platformFeeCents: payment.grossCents - payment.therapistNetCents,
            settledInvoiceCents: payment.settledInvoiceCents,
            therapistNetCents: payment.therapistNetCents,
            status: payment.status,
            createdAt: formatDate(payment.createdAt),
            sortAt: (payment.paidAt ?? payment.createdAt).toISOString(),
            paidAt: payment.paidAt ? formatDate(payment.paidAt) : null,
          }))}
        />
      </div>
    </div>
  );
}
