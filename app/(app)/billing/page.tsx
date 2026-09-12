import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";

import { BillingLedger } from "@/components/billing/ledger";
import { PlanCard } from "@/components/billing/plan-card";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { earningsSummary, recentPayments } from "@/lib/billing/connect";
import { formatUsd } from "@/lib/billing/plans";
import { billingSummary, listInvoices, usageBySession } from "@/lib/billing/service";
import { confirmCheckout } from "@/lib/billing/stripe";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Billing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { locale, t } = await getI18n();
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
      <PageHeader title={t("portal.billing.title")} />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {checkout && checkout !== "cancelled" ? (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
            {t("portal.billing.paid")}
          </p>
        ) : null}
        {checkout === "cancelled" ? (
          <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600">
            {t("portal.billing.cancelled")}
          </p>
        ) : null}

        {!features.billing ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            {t("portal.billing.noPayments")}
          </p>
        ) : null}

        <PlanCard
          tiers={summary.tiers}
          currentTierKey={summary.tier.key}
          creditRemainingCents={summary.credits.remainingCents}
          creditsExpireOn={
            summary.credits.nextExpiryAt ? formatDate(summary.credits.nextExpiryAt, actor.timezone, locale) : null
          }
          billingEnabled={features.billing}
          platformFeeCents={summary.platformFeeCents}
          spentPlatformCents={summary.spentPlatformCents}
          spentAiCents={summary.spentAiCents}
          heldEarningsCents={summary.heldEarningsCents}
        />

        {!summary.subscription.trialSessionUsed ? (
          <p className="rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
            {t("portal.billing.firstFree")}
          </p>
        ) : null}

        {summary.subscription.upcomingDiscountCents > 0 ? (
          <p className="rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
            {t("portal.billing.creditWaiting")}
            {summary.subscription.upcomingDiscountReason
              ? `, ${summary.subscription.upcomingDiscountReason}`
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
            <span className="block text-sm font-semibold text-slate-900">{t("portal.billing.earnings")}</span>
            <span className="block truncate text-xs text-slate-500">
              {earnings.heldCents > 0
                ? t("portal.billing.heldAndEarned", {
                    held: formatUsd(earnings.heldCents),
                    earned: formatUsd(earnings.thisMonthNetCents),
                  })
                : t("portal.billing.earnedThisMonth", {
                    earned: formatUsd(earnings.thisMonthNetCents),
                  })}
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
            issuedAt: formatDate(invoice.issuedAt, actor.timezone, locale),
            sortAt: invoice.issuedAt.toISOString(),
            paidAt: invoice.paidAt ? formatDate(invoice.paidAt, actor.timezone, locale) : null,
            periodStart: invoice.periodStart ? formatDate(invoice.periodStart, actor.timezone, locale) : null,
            periodEnd: invoice.periodEnd ? formatDate(invoice.periodEnd, actor.timezone, locale) : null,
            usage: invoice.sessionId ? (usage.get(invoice.sessionId) ?? null) : null,
          }))}
          payments={payments.map((payment) => ({
            id: payment.id,
            patientName: payment.patientName,
            grossCents: payment.grossCents,
            platformFeeCents: payment.grossCents - payment.therapistNetCents,
            settledInvoiceCents: payment.settledInvoiceCents,
            therapistNetCents: payment.therapistNetCents,
            status: payment.status,
            capture: payment.capture,
            createdAt: formatDate(payment.createdAt, actor.timezone, locale),
            sortAt: (payment.paidAt ?? payment.createdAt).toISOString(),
            paidAt: payment.paidAt ? formatDate(payment.paidAt, actor.timezone, locale) : null,
          }))}
        />
      </div>
    </div>
  );
}
