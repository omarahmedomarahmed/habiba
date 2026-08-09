import type { Metadata } from "next";
import { Check } from "lucide-react";

import { BillingActions } from "@/components/billing/billing-actions";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { PLANS, formatUsd } from "@/lib/billing/plans";
import { billingSummary, listCharges } from "@/lib/billing/service";
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

  const [summary, charges] = await Promise.all([
    billingSummary(actor.organizationId),
    listCharges(actor.organizationId),
  ]);

  const outstanding = charges.filter((c) => c.status === "pending");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Billing" subtitle={summary.plan.name} />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
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

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{summary.plan.name}</p>
              <p className="mt-0.5 text-sm text-slate-500">{summary.plan.tagline}</p>
            </div>
            <Badge tone={summary.subscription.status === "active" ? "green" : "amber"}>
              {summary.subscription.status}
            </Badge>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 px-3.5 py-3">
              <dt className="text-xs text-slate-500">Sessions this month</dt>
              <dd className="mt-0.5 text-xl font-bold text-slate-900">
                {summary.sessionsThisMonth}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3.5 py-3">
              <dt className="text-xs text-slate-500">Outstanding</dt>
              <dd className="mt-0.5 text-xl font-bold text-slate-900">
                {formatUsd(summary.outstandingCents)}
              </dd>
            </div>
          </dl>

          {summary.subscription.plan === "payg" && !summary.subscription.trialSessionUsed ? (
            <p className="mt-3 rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
              Your first completed session is free.
            </p>
          ) : null}

          <BillingActions
            plan={summary.subscription.plan}
            cancelAtPeriodEnd={summary.subscription.cancelAtPeriodEnd}
            billingEnabled={features.billing}
            outstanding={outstanding.map((c) => ({
              id: c.id,
              amountCents: c.amountCents,
              description: c.description,
            }))}
          />
        </Card>

        {summary.subscription.plan === "payg" ? (
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">{PLANS.unlimited.name}</p>
            <p className="mt-0.5 text-sm text-slate-500">{PLANS.unlimited.tagline}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {formatUsd(PLANS.unlimited.monthlyCents!)}
              <span className="text-sm font-normal text-slate-500"> / month</span>
            </p>
            <ul className="mt-3 space-y-2">
              {PLANS.unlimited.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            History
          </p>
          {charges.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Nothing charged yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {charges.map((charge) => (
                <li key={charge.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {charge.description}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(charge.chargedAt)}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {charge.amountCents === 0 ? "Free" : formatUsd(charge.amountCents)}
                  </p>
                  <ChargeBadge status={charge.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChargeBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge tone="green">Paid</Badge>;
  if (status === "pending") return <Badge tone="amber">Due</Badge>;
  if (status === "waived") return <Badge tone="teal">Free</Badge>;
  if (status === "included") return <Badge tone="brand">Included</Badge>;
  return <Badge tone="red">Failed</Badge>;
}
