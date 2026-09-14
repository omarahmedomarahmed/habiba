import type { Metadata } from "next";

import { HeldBalances } from "@/components/admin/held-balances";
import { LedgerAdjust } from "@/components/admin/ledger-adjust";
import { VaultInvoiceRow } from "@/components/admin/vault-invoice-row";
import { VaultPaymentRow } from "@/components/admin/vault-payment-row";
import { Badge, Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { formatUsd } from "@/lib/billing/plans";
import {
  allInvoices,
  allSessionPayments,
  costByKind,
  ledgerSummary,
  monthlyLedger,
  therapistEconomics,
  tractionMetrics,
} from "@/lib/data/vault";
import { heldBalances, trialBalance, unbalancedTransactions } from "@/lib/billing/ledger";
import { allOrganizations } from "@/lib/data/admin";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Vault", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const actor = await requireRole("super_admin");

  const [
    ledger,
    months,
    therapists,
    traction,
    kinds,
    invoices,
    payments,
    held,
    books,
    unbalanced,
    orgs,
  ] = await Promise.all([
    ledgerSummary(),
    monthlyLedger(6),
    therapistEconomics(),
    tractionMetrics(),
    costByKind(30),
    allInvoices(200),
    allSessionPayments(200),
    heldBalances(),
    trialBalance(),
    /*
     * 🔴 58.1 again. `unbalancedTransactions` was written so the assertion could
     * be RUN against real rows rather than trusted, and then no screen ran it:
     * `verify:reachable` has had it in MUST_WIRE since the gate existed. A
     * self-check nobody executes is the thing it was written to replace.
     */
    unbalancedTransactions(),
    allOrganizations(),
  ]);

  const peak = Math.max(1, ...months.map((m) => Math.max(m.collected, m.spent)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vault</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every dollar in, every dollar of model spend, and the margin between them.
        </p>
      </div>

      {/*
        Liabilities before results.
        --------------------------
        Everything below this is revenue, spend and margin — ours. Everything
        here is somebody else's, and it goes first because a platform that has
        to be reminded it is holding other people's money is a platform that
        will eventually forget.

        🔴 That sentence used to say "the one figure on the page", and it was
        wrong twice over: sponsor pots have been a liability since 53.10 and
        never appeared here, and the VAT we collect had no account at all until
        `vat_payable`. A float quoted as a balance is the most flattering way to
        get this wrong, which is why all three are on one row now.
      */}
      <HeldBalances
        rows={held.map((row) => ({
          therapistId: row.therapistId!,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          payoutsEnabled: row.payoutsEnabled,
          hasAccount: Boolean(row.stripeAccountId),
          heldCents: row.heldCents,
        }))}
        totalHeldCents={books.heldForTherapistsCents}
        outOfBalanceCents={books.outOfBalanceCents}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Held for clinicians
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatUsd(books.heldForTherapistsCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Earned, not yet paid out.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Unspent sponsor pots
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatUsd(books.potsHeldCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Prepaid by employers, refundable on their terms.
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            VAT collected, not remitted
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatUsd(books.vatOwedCents)}
          </p>
          {/*
            🔴 Only what WE collected. A destination charge puts the tax in the
            clinician's own balance, where they are merchant of record, and none
            of it is counted here.
          */}
          <p className="mt-1 text-xs text-slate-500">
            Owed to a tax authority. Excludes tax collected by clinicians on their
            own charges.
          </p>
        </Card>
      </div>

      {/*
        🔴 Normally renders nothing, which is the point. The same construction
        the sponsor reconciliation uses: a discrepancy is a red line at the top
        of a page somebody opens, rather than a warning in a log nobody tails.
      */}
      {unbalanced.length > 0 ? (
        <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
          <p className="text-sm font-semibold text-red-800">
            {unbalanced.length} transaction{unbalanced.length === 1 ? "" : "s"} whose legs
            do not sum to zero
          </p>
          <p className="mt-1 text-xs text-red-700">
            `journal` cannot create one, so each of these was written another way
            or written before it existed. Nothing below this line can be trusted
            until they are explained.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-red-700">
            {unbalanced.map((row) => (
              <li key={row.txnId}>
                {row.kind} · {row.txnId.slice(0, 8)}… · off by {formatUsd(row.deltaCents)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        🔴 58.1 — the escape hatch, which existed as a function and as nothing
        else. `adjustLedger` demanded a reason, recorded who, and posted a
        balanced pair, and no screen called it. It goes directly under the
        out-of-balance figure, because that number is the only reason to reach
        for it.
      */}
      <LedgerAdjust organizations={orgs} />

      {/* ------------------------------------------------------------ ledger */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
          Ledger · all time
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Money label="Collected" cents={ledger.collectedCents} tone="positive" />
          <Money label="Model spend" cents={ledger.aiCostCents} tone="negative" />
          <Money
            label="Gross margin"
            cents={ledger.grossMarginCents}
            tone={ledger.grossMarginCents >= 0 ? "positive" : "negative"}
            sub={`${ledger.grossMarginPct.toFixed(0)}%`}
          />
          <Money label="Outstanding" cents={ledger.outstandingCents} tone="neutral" />
        </div>

        {/*
          Marketplace volume is kept visually apart from revenue on purpose. GMV
          is money that passed through us to a therapist; only the fee is ours,
          and a dashboard that adds the two produces a number that cannot be
          defended in a diligence call.
        */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Money label="Connect fees" cents={ledger.connectFeeCents} tone="positive" />
          <Money
            label="Patient payments (GMV)"
            cents={ledger.gmvCents}
            tone="neutral"
            sub={`${ledger.connectPaymentCount} paid sessions`}
          />
        </div>

        <p className="text-xs text-slate-500">
          {ledger.paidInvoiceCount} invoices paid · {formatUsd(ledger.discountedCents)} discounted ·{" "}
          {ledger.waivedCount} sessions waived. Collected includes Connect fees but not GMV, that
          money belongs to the therapist. Model spend is estimated from published rates at the time
          of each call, reconcile against the provider invoice monthly.
        </p>
      </section>

      {/* ------------------------------------------------------------- chart */}
      {months.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">Revenue vs model spend</p>
          <div className="mt-4 flex items-end gap-3">
            {months.map((month) => (
              <div key={month.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 rounded-t bg-teal-500"
                    style={{ height: `${Math.max(2, (month.collected / peak) * 100)}%` }}
                    title={`Collected ${formatUsd(month.collected)}`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-slate-300"
                    style={{ height: `${Math.max(2, (month.spent / peak) * 100)}%` }}
                    title={`Spend ${formatUsd(month.spent)}`}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{month.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-teal-500" /> Collected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-slate-300" /> Model spend
            </span>
          </p>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------- traction */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
          Traction & unit economics
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Signups" value={String(traction.signups)} />
          <Stat
            label="Activated"
            value={String(traction.activated)}
            sub={`${traction.activationPct.toFixed(0)}% of signups`}
          />
          <Stat label="Active (7d)" value={String(traction.activeLast7)} />
          <Stat label="Active (30d)" value={String(traction.activeLast30)} />
          <Stat label="Sessions (7d)" value={String(traction.sessionsLast7)} />
          <Stat label="Sessions (30d)" value={String(traction.sessionsLast30)} />
          <Stat label="Paying practices" value={String(traction.payingOrgs)} />
          <Stat label="MRR" value={formatUsd(traction.mrrCents)} sub="subscriptions only" />
          <Stat label="ARPU (30d)" value={formatUsd(traction.arpuCents)} sub="per activated" />
          <Stat
            label="Revenue / session"
            value={formatUsd(traction.revenuePerSessionCents)}
            sub="30d"
          />
          <Stat
            label="Model cost / session"
            value={formatUsd(traction.costPerSessionCents)}
            sub="30d"
          />
          <Stat
            label="Contribution / session"
            value={formatUsd(
              traction.revenuePerSessionCents - traction.costPerSessionCents,
            )}
            sub="30d"
          />
        </div>
        <p className="text-xs text-slate-500">
          Activated means a clinician who has completed at least one session, a signup that never
          records one has told us nothing. MRR counts recurring subscriptions only; metered revenue
          is real but not recurring, and folding it in turns a run-rate into fiction.
        </p>
      </section>

      {/* ------------------------------------------------------- ai by kind */}
      <Card>
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          Model spend by purpose · 30 days
        </p>
        <ul className="divide-y divide-slate-100">
          {kinds.map((kind) => (
            <li key={kind.kind} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-sm font-medium text-slate-800 capitalize">
                {kind.kind}
              </span>
              <span className="text-xs text-slate-500">{kind.calls} calls</span>
              {kind.errors > 0 ? <Badge tone="amber">{kind.errors} errors</Badge> : null}
              <span className="w-20 text-end text-sm font-semibold text-slate-900">
                {formatUsd(kind.costCents)}
              </span>
            </li>
          ))}
          {kinds.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">No model calls yet.</li>
          ) : null}
        </ul>
      </Card>

      {/* ------------------------------------------------- per therapist */}
      <Card>
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          Per clinician · who consumes what
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-start text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Clinician</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 text-end font-medium">Sessions</th>
                <th className="px-3 py-2 text-end font-medium">AI calls</th>
                <th className="px-3 py-2 text-end font-medium">Model spend</th>
                <th className="px-3 py-2 text-end font-medium">Paid us</th>
                <th className="px-4 py-2 text-end font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {therapists.map((t) => {
                const margin = t.revenueCents - t.aiCostCents;
                return (
                  <tr key={t.userId}>
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-slate-900">
                        {t.name || t.email}
                      </span>
                      <span className="block text-xs text-slate-400">{t.organizationName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={t.plan && t.plan !== "payg" ? "teal" : "slate"}>
                        {t.plan ?? "payg"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{t.sessionCount}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{t.aiCalls}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-slate-600">
                      {formatUsd(t.aiCostCents)}
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-slate-900">
                      {formatUsd(t.revenueCents)}
                    </td>
                    <td
                      className={
                        margin >= 0
                          ? "px-4 py-2.5 text-end font-semibold tabular-nums text-emerald-700"
                          : "px-4 py-2.5 text-end font-semibold tabular-nums text-red-600"
                      }
                    >
                      {formatUsd(margin)}
                    </td>
                  </tr>
                );
              })}
              {therapists.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-slate-500">
                    No clinicians yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --------------------------------------------------------- invoices */}
      <Card>
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          Every invoice
        </p>
        <ul className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <VaultInvoiceRow
              key={invoice.id}
              id={invoice.id}
              organizationId={invoice.organizationId}
              organizationName={invoice.organizationName ?? "-"}
              description={invoice.description}
              kind={invoice.kind}
              amountCents={invoice.amountCents}
              discountCents={invoice.discountCents}
              discountReason={invoice.discountReason}
              status={invoice.status}
              issuedAt={formatDate(invoice.issuedAt, actor.timezone, "en")}
            />
          ))}
          {invoices.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">No invoices yet.</li>
          ) : null}
        </ul>
      </Card>

      {/* ------------------------------------------------- patient payments */}
      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Patient payments</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Money that passed through us to a clinician. Only the fee column is ours, refunding
            here reverses the transfer out of their balance and returns our cut.
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <VaultPaymentRow
              key={payment.id}
              id={payment.id}
              sessionId={payment.sessionId}
              therapistName={payment.therapistName}
              organizationName={payment.organizationName}
              grossCents={payment.grossCents}
              platformFeeCents={payment.platformFeeCents}
              settledInvoiceCents={payment.settledInvoiceCents}
              therapistNetCents={payment.therapistNetCents}
              status={payment.status}
              when={formatDate(payment.paidAt ?? payment.createdAt, actor.timezone, "en")}
            />
          ))}
          {payments.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">
              Nobody has paid a clinician through the platform yet.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}

function Money({
  label,
  cents,
  tone,
  sub,
}: {
  label: string;
  cents: number;
  tone: "positive" | "negative" | "neutral";
  sub?: string;
}) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          tone === "positive"
            ? "mt-0.5 text-2xl font-bold tracking-tight text-emerald-700"
            : tone === "negative"
              ? "mt-0.5 text-2xl font-bold tracking-tight text-slate-700"
              : "mt-0.5 text-2xl font-bold tracking-tight text-slate-900"
        }
      >
        {formatUsd(cents)}
      </p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );
}
