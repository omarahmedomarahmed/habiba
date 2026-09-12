import type { Metadata } from "next";

import {
  CopilotEditor,
  CountryEditor,
  PayoutsEditor,
  PricingEditor,
  SessionEditor,
} from "@/components/admin/settings-editor";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { formatUsd } from "@/lib/billing/plans";
import { tractionMetrics } from "@/lib/data/vault";
import { getCountries, getSettings } from "@/lib/settings";
import { hasNoRail } from "@/lib/settings/defs";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Every number in the product, edited by a person. PLAN.md 20.1–20.7.
 *
 * ## 🔴 Why this is the owner's screen and not staff's
 *
 * 20.8 splits the back office three ways, and this is the half that prices the
 * product: a rate here changes what every clinician is billed and what the
 * public pricing page says on its next request. Staff work queues; they do not
 * move prices.
 *
 * ## 20.7 — the Total View, on the same page as the levers
 *
 * The margin per session, measured from real model spend, sits at the top of
 * the screen where the rates are edited. Splitting them across two pages is
 * how a platform ends up with a price nobody has compared to its cost since
 * the day it was set.
 */
export default async function SettingsPage() {
  await requireRole("super_admin");

  const [settings, countries, traction] = await Promise.all([
    getSettings(),
    getCountries(),
    tractionMetrics(),
  ]);

  const unreachable = countries.filter(hasNoRail);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Every figure the product charges, shows or enforces. There is no second copy."
      />

      {/* 🔴 20.6 / 20.7 — the margin, from real usage, beside the rates. */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Margin per session, last 30 days</p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Revenue" value={formatUsd(traction.revenuePerSessionCents)} />
          <Stat label="Model cost" value={formatUsd(traction.costPerSessionCents)} />
          <Stat label="Margin" value={formatUsd(traction.marginPerSessionCents)} strong />
          <Stat
            label="Margin %"
            value={
              traction.marginBps === null
                ? "-"
                : `${(traction.marginBps / 100).toFixed(1)}%`
            }
          />
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Cost is what the models actually charged us, summed from microcents and divided once
          (C17). The percentage is absent rather than zero when nothing has been collected, a
          margin on no revenue is a division by zero wearing a percent sign.
        </p>
      </Card>

      {unreachable.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {unreachable.length} countr{unreachable.length === 1 ? "y has" : "ies have"} no rail
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
            {unreachable.map((c) => c.name).join(", ")}, nobody there can pay us and nobody there
            can be paid. A clinician who signs up in one of these is a person we cannot pay, not a
            gap in a spreadsheet.
          </p>
        </Card>
      ) : null}

      <PricingEditor
        tiers={settings.pricing.tiers}
        creditExpiryMonths={settings.pricing.creditExpiryMonths}
      />
      <SessionEditor {...settings.session} />
      <CopilotEditor {...settings.copilot} />
      <PayoutsEditor {...settings.payouts} />

      <div>
        <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
          Countries
        </h2>
        <div className="space-y-3">
          {countries.map((country) => (
            <CountryEditor
              key={country.code}
              country={{ ...country, noRail: hasNoRail(country) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={strong ? "text-lg font-bold text-slate-900" : "text-lg text-slate-700"}>
        {value}
      </dd>
    </div>
  );
}
