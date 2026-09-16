import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";

import { declareBillTransfer } from "./actions";
import { BillingLedger } from "@/components/billing/ledger";
import { PaymentPopup } from "@/components/billing/payment-popup";
import { PlanCard } from "@/components/billing/plan-card";
import { SeatManager } from "@/components/billing/seat-manager";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { earningsSummary, recentPayments } from "@/lib/billing/connect";
import { formatUsd } from "@/lib/billing/plans";
import { currentSeatBill } from "@/lib/billing/seats";
import { manualEntry, organizationNeedsTransfer } from "@/lib/billing/manual-entry";
import { billingSummary, listInvoices, usageBySession } from "@/lib/billing/service";
import { confirmCheckout } from "@/lib/billing/stripe";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { eq } from "drizzle-orm";
import { controlDb } from "@/lib/db";
import { organizations, users } from "@/lib/db/schema";

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

  /*
   * 🔴 76.10 — who is reading this screen, and which practice they bill under.
   * The popup names both: a clinic manager needs to see that this is the
   * practice's bill and not somebody's session.
   */
  const [[me], [practice]] = await Promise.all([
    controlDb
      .select({ first: users.firstName, last: users.lastName })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1),
    controlDb
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .limit(1),
  ]);
  /*
   * 🔴 76.10 — `viewerName`, not `payerName`, and the rename is the rule again.
   *
   * C243 bans a PAYER's name from a therapist-facing money surface, because a
   * screen showing who paid reveals which employer covers which patient. This
   * is the reader's own name on their own bill, which is the one safe case —
   * and a variable called `payerName` on a clinician's page is exactly what the
   * rule is watching for, whatever it happens to hold today.
   */
  const viewerName = [me?.first, me?.last].filter(Boolean).join(" ") || actor.email;
  const practiceName = practice?.name ?? null;

  const [summary, invoices, earnings, payments, seatBill] = await Promise.all([
    billingSummary(actor.organizationId),
    listInvoices(actor.organizationId),
    earningsSummary(actor.userId),
    recentPayments(actor.userId),
    /* 🔴 62.1 — what this account pays for seats, if it has any. */
    currentSeatBill(actor.organizationId),
  ]);

  /*
   * 🔴 74.2 — WHICH RAIL, ASKED ONCE, OF THE PRACTICE'S REGION.
   *
   * A clinic pays for seats and a solo therapist does not, and the two see
   * different account lines: `audiences` on each transfer field is how an
   * operator says which. `seatBill.seats` is the same number the seat manager
   * above renders from, so the two can never disagree about what this account is.
   */
  const needsTransfer = await organizationNeedsTransfer(actor.organizationId);
  const rail = await manualEntry({
    audience: seatBill.seats > 0 ? "clinic" : "therapist",
    purpose: "subscription",
    /* The ORGANISATION, not an invoice: one transfer settles the whole bill. */
    refId: actor.organizationId,
    payer: {
      kind: "user",
      userId: actor.userId,
      organizationId: actor.organizationId,
    },
    needed: needsTransfer && summary.outstandingCents > 0,
    settlesCents: summary.outstandingCents,
    locale: localeTag(locale),
  });

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

        {/*
          🔴 62.9 / C332 — the upgrade section is REPLACED by the seat manager
          for a clinic, never removed.
          -------------------------------------------------------------------
          A clinic that upgraded and then found no way to change what it pays
          would have to contact us to add a colleague, which is the shape of a
          feature that quietly becomes a support queue. It sits above the plan
          card because the seat count is what decides the bill once there is
          one.
        */}
        {seatBill.seats > 0 ? (
          <SeatManager seats={seatBill.seats} monthlyLabel={formatUsd(seatBill.monthlyCents)} />
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
          /*
           * 🔴 57.4 — formatted HERE, on the server, in the therapist's own
           * zone and language. 12.3 / C84: the same date formatted inside the
           * client component renders one string on the server pass and another
           * in the browser, which is a hydration mismatch on the one figure a
           * subscriber most needs to trust.
           *
           * Exactly one is ever non-null. A plan set to stop has an end date; a
           * plan that will charge again has a renewal date. The card says which
           * in words, so the two can never be read as each other.
           */
          renewsOn={
            summary.subscription.currentPeriodEnd && !summary.subscription.cancelAtPeriodEnd
              ? formatDate(summary.subscription.currentPeriodEnd, actor.timezone, locale)
              : null
          }
          endsOn={
            summary.subscription.currentPeriodEnd && summary.subscription.cancelAtPeriodEnd
              ? formatDate(summary.subscription.currentPeriodEnd, actor.timezone, locale)
              : null
          }
        />

        {/*
          🔴 74.2 — THE EGYPTIAN BILL, ABOVE EVERYTHING THEY CANNOT ACT ON.
          -------------------------------------------------------------------
          Directly under the plan, because what a therapist opens this page to
          do is pay. The ledger below is the record and the record can wait.
        */}
        {rail.needed ? (
          <>
            <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-700">
              {summary.outstandingCount === 1
                ? t("transfer.billDueOne", { amount: formatUsd(summary.outstandingCents) })
                : t("transfer.billDue", {
                    amount: formatUsd(summary.outstandingCents),
                    count: String(summary.outstandingCount),
                  })}
            </p>
            {/*
              🔴 76.10 — THE SAME SHEET A PATIENT AND A COMPANY SEE.

              It used to be a bare `PayByTransfer` in the page flow. The popup
              adds the three things a clinician needs and this page could not
              give them: which payer they are, so a clinic manager can tell this
              is the practice's bill rather than a patient's session; a
              minimised state they can come back to; and the receipt handed back
              when they return, instead of an upload form that says nothing
              about whether the first one landed.
            */}
            <PaymentPopup
              storageKey={actor.organizationId}
              subject={{
                viewerName,
                orgName: practiceName,
                what: t("transfer.forBill"),
                /* A practice of one is a therapist; more than one is a clinic. */
                /*
                 * The same question `manualEntry`'s audience asks, four lines
                 * up, and answered from the same column. A clinic pays for
                 * seats and a solo therapist does not.
                 */
                payerType: seatBill.seats > 0 ? "clinic" : "therapist",
              }}
              details={rail.details}
              amountLabel={rail.amountLabel}
              live={rail.live}
              action={declareBillTransfer}
            />
          </>
        ) : null}

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
