import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";

import { BillingLedger } from "@/components/billing/ledger";
import { PlanCard } from "@/components/billing/invoice-list";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { earningsSummary, recentPayments } from "@/lib/billing/connect";
import { formatUsd } from "@/lib/billing/plans";
import { billingSummary, listInvoices, usageBySession } from "@/lib/billing/service";
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

  const [summary, invoices, earnings, payments] = await Promise.all([
    billingSummary(actor.organizationId),
    listInvoices(actor.organizationId),
    earningsSummary(actor.userId),
    recentPayments(actor.userId),
  ]);

  // One grouped query for every session on the page, rather than one per row.
  const usage = await usageBySession(
    actor.organizationId,
    invoices.map((invoice) => invoice.sessionId).filter((id): id is string => Boolean(id)),
  );

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

        {/*
          Money in lives on its own page now.
          ----------------------------------
          "What do I owe 24Therapy" and "what have my patients paid me" are two
          balances, not two views of one, and putting them on the same screen
          made a clinician read past an invoice list to find out whether they
          could pay rent. This is the pointer across, carrying the one number
          that would otherwise be a reason to go looking.
        */}
        <Link
          href="/earnings"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <Wallet className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Your earnings</span>
            <span className="block truncate text-xs text-slate-500">
              {earnings.heldCents > 0
                ? `${formatUsd(earnings.heldCents)} held for you, ${formatUsd(earnings.thisMonthNetCents)} earned this month`
                : `${formatUsd(earnings.thisMonthNetCents)} earned this month`}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        </Link>

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
            usage: invoice.sessionId ? (usage.get(invoice.sessionId) ?? null) : null,
          }))}
          payments={payments.map((payment) => ({
            id: payment.id,
            payerName: payment.payerName,
            grossCents: payment.grossCents,
            platformFeeCents: payment.grossCents - payment.therapistNetCents,
            settledInvoiceCents: payment.settledInvoiceCents,
            therapistNetCents: payment.therapistNetCents,
            status: payment.status,
            capture: payment.capture,
            createdAt: formatDate(payment.createdAt),
            sortAt: (payment.paidAt ?? payment.createdAt).toISOString(),
            paidAt: payment.paidAt ? formatDate(payment.paidAt) : null,
          }))}
        />
      </div>
    </div>
  );
}
