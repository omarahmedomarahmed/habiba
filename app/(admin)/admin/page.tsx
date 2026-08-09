import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { formatUsd } from "@/lib/billing/plans";
import { aiUsageByDay, platformStats } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireRole("super_admin");
  const [stats, usage] = await Promise.all([platformStats(), aiUsageByDay(14)]);

  const maxCost = Math.max(1, ...usage.map((u) => u.costCents));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Overview</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Practices" value={stats.organizations} />
        <Stat label="Clinicians" value={stats.clinicians} />
        <Stat label="Patient charts" value={stats.patients} />
        <Stat label="Sessions (30d)" value={stats.sessions30d} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">AI usage · last 30 days</p>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-slate-500">Calls</dt>
              <dd className="text-xl font-bold text-slate-900">{stats.aiCalls30d}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Cost</dt>
              <dd className="text-xl font-bold text-slate-900">
                {formatUsd(stats.aiCostCents30d)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Errors</dt>
              <dd
                className={
                  stats.aiErrors30d > 0
                    ? "text-xl font-bold text-amber-600"
                    : "text-xl font-bold text-slate-900"
                }
              >
                {stats.aiErrors30d}
              </dd>
            </div>
          </dl>

          {usage.length > 0 ? (
            <div className="mt-4 flex h-20 items-end gap-1">
              {[...usage].reverse().map((day) => (
                <div
                  key={day.day}
                  title={`${day.day}: ${day.calls} calls`}
                  className="flex-1 rounded-t bg-brand-200"
                  style={{ height: `${Math.max(4, (day.costCents / maxCost) * 100)}%` }}
                />
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">Billing · last 30 days</p>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-slate-500">Collected</dt>
              <dd className="text-xl font-bold text-slate-900">
                {formatUsd(stats.collectedCents30d)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Outstanding</dt>
              <dd className="text-xl font-bold text-slate-900">
                {formatUsd(stats.pendingCents30d)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Figures come from this database, not from Stripe. Treat Stripe as the ledger of record
            and this as an operational view.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </Card>
  );
}
