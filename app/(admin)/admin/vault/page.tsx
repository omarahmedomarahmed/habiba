import type { Metadata } from "next";

import { HeldBalances } from "@/components/admin/held-balances";
import { LedgerAdjust } from "@/components/admin/ledger-adjust";
import { PendingApprovals } from "@/components/admin/pending-approvals";
import { approvalViews } from "@/lib/billing/approvals";
import { VaultInvoiceRow } from "@/components/admin/vault-invoice-row";
import { VaultPaymentRow } from "@/components/admin/vault-payment-row";
import { Badge, Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
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
import { reconcileRenewals } from "@/lib/billing/obligations";
import { adjustableClinicians, allOrganizations, defaultPayoutMethods } from "@/lib/data/admin";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { Money as UsdMoney } from "@/components/ui/money";

export const metadata: Metadata = { title: "Vault", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const actor = await requireRole("super_admin");
  const { t } = await getI18n();

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
    renewalDrift,
    orgs,
    clinicians,
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
    /*
     * 🔴 59.15 — the renewal reconciliation, on the screen rather than in a log.
     *
     * C232's lesson from the sponsor pot, applied to subscriptions: a
     * discrepancy belongs on a page an operator opens every week, not in a
     * warning nobody tails. Both directions, because asking one of them is how
     * a discrepancy survives.
     */
    reconcileRenewals(),
    allOrganizations(),
    /* 🔴 A12: a clinician's balance is adjusted by naming the clinician. */
    adjustableClinicians(),
  ]);

  const peak = Math.max(1, ...months.map((m) => Math.max(m.collected, m.spent)));

  /*
   * 🔴 Board 506 (AD11): how each clinician is actually paid. With Stripe off,
   * an Egyptian clinician is paid by InstaPay or a wallet, and the row said
   * "No Stripe account" as if that were the problem.
   */
  const payoutBy = await defaultPayoutMethods(held.map((row) => row.therapistId!).filter(Boolean));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vault</h1>
        {/*
          🔴 C349's sweep, on this page's own subtitle. It described the table
          that now sits six inches below it, column by column, which is sprint
          65's rule almost exactly inverted: the page was writing what it was
          about to show.
        */}
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
          payoutMethod: payoutBy.get(row.therapistId!) ?? null,
        }))}
        stripeOn={features.billing}
        totalHeldCents={books.heldForTherapistsCents}
        outOfBalanceCents={books.outOfBalanceCents}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t("avault.owedTotal")}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            <UsdMoney cents={books.heldForTherapistsCents} />
          </p>
          <p className="mt-1 text-xs text-slate-500">Earned, not yet paid out.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Unspent sponsor pots
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            <UsdMoney cents={books.potsHeldCents} />
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Prepaid by employers.
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            VAT collected, not remitted
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            <UsdMoney cents={books.vatOwedCents} />
          </p>
          {/*
            🔴 Only what WE collected. A destination charge puts the tax in the
            clinician's own balance, where they are merchant of record, and none
            of it is counted here.
          */}
          <p className="mt-1 text-xs text-slate-500">
            Owed to a tax authority.
          </p>
        </Card>
      </div>

      {/*
        🔴 59.15 — renewals that do not reconcile. Normally renders nothing.

        The second list is the one that produces a support ticket rather than a
        variance: somebody paid a renewal invoice and nothing recorded what
        period it bought, so they are entitled to a month the product does not
        know about.
      */}
      {renewalDrift.paidWithNoReference.length > 0 ||
      renewalDrift.invoicesWithNoObligation.length > 0 ? (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-amber-900">Renewals that do not reconcile</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-900/90">
            {renewalDrift.paidWithNoReference.length > 0 ? (
              <li>
                {renewalDrift.paidWithNoReference.length} obligation
                {renewalDrift.paidWithNoReference.length === 1 ? "" : "s"} marked paid with no
                transaction behind them.
              </li>
            ) : null}
            {renewalDrift.invoicesWithNoObligation.length > 0 ? (
              <li>
                {renewalDrift.invoicesWithNoObligation.length} paid renewal invoice
                {renewalDrift.invoicesWithNoObligation.length === 1 ? "" : "s"} that bought no
                period.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

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
            Nothing below can be trusted until these are explained.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-red-700">
            {unbalanced.map((row) => (
              <li key={row.txnId}>
                {row.kind} · {row.txnId.slice(0, 8)}… · off by <UsdMoney cents={row.deltaCents} />
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
      {/* 🔴 0161 / ruling 13c: an adjustment waits here for a second admin to post it. */}
      <PendingApprovals rows={await approvalViews("ledger_adjustment", actor.userId)} />
      <LedgerAdjust organizations={orgs} clinicians={clinicians} />

      {/* ------------------------------------------------------------ ledger */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
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
          {ledger.paidInvoiceCount} invoices paid · <UsdMoney cents={ledger.discountedCents} /> discounted ·{" "}
          {ledger.waivedCount} sessions waived. Collected includes Connect fees but not GMV, that
          money belongs to the therapist. Model spend is estimated from published rates at the time
          of each call, reconcile against the provider invoice monthly.
        </p>
      </section>

      {/* ------------------------------------------------------------- chart */}
      {/*
        🔴 C349 — THE FIGURES ARE PRINTED, NOT HOVERED.
        ----------------------------------------------
        Two bars and a `title=` attribute is what this was: the shape of the
        month was visible and every number behind it required a mouse, on a
        touchscreen showed nothing at all, and was read to a screen reader as an
        afterthought. Sprint 65's rule is that a disclosure a reader has to
        uncover is a disclosure most readers never see.

        So the bars keep their job — which is comparison at a glance, the one
        thing a table is bad at — and the figures sit under them where they can
        be read, copied and totalled. The split between subscriptions and
        session fees is on the page for the first time: `monthlyLedger` counted
        only the first of those until C349, so this chart and the summary card
        above it were answering the same question differently.
      */}
      {months.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">Income and spend, by month</p>
          <div className="mt-4 flex items-end gap-3">
            {months.map((month) => (
              <div key={month.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <div
                    className="flex w-1/2 flex-col-reverse"
                    style={{ height: `${Math.max(2, (month.collected / peak) * 100)}%` }}
                  >
                    <div
                      className="rounded-b bg-brand-600"
                      style={{
                        height: `${month.collected > 0 ? (month.invoiceCents / month.collected) * 100 : 0}%`,
                      }}
                    />
                    <div className="flex-1 rounded-t bg-brand-400" />
                  </div>
                  <div
                    className="w-1/2 rounded-t bg-slate-300"
                    style={{ height: `${Math.max(2, (month.spent / peak) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{month.month.slice(5)}</span>
              </div>
            ))}
          </div>
          {/*
            🔴 NO LEGEND, and that is the point rather than an omission.
            A legend is a second list of the same three names, sitting between
            the bars and the table that already names them. The swatches moved
            into the column headings instead, so the colour a reader is matching
            is on the word they are matching it to.
          */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">Month</th>
                  <th className="py-2 text-end font-medium">
                    <Swatch className="bg-brand-600" />
                    Subscriptions
                  </th>
                  <th className="py-2 text-end font-medium">
                    <Swatch className="bg-brand-400" />
                    Session fees
                  </th>
                  <th className="py-2 text-end font-medium">Income</th>
                  <th className="py-2 text-end font-medium">
                    <Swatch className="bg-slate-300" />
                    Spend
                  </th>
                  <th className="py-2 text-end font-medium">Left</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-600">{month.month}</td>
                    <td className="py-2 text-end tabular-nums text-slate-600">
                      <UsdMoney cents={month.invoiceCents} />
                    </td>
                    <td className="py-2 text-end tabular-nums text-slate-600">
                      <UsdMoney cents={month.sessionFeeCents} />
                    </td>
                    <td className="py-2 text-end font-semibold tabular-nums text-slate-900">
                      <UsdMoney cents={month.collected} />
                    </td>
                    <td className="py-2 text-end tabular-nums text-slate-600">
                      <UsdMoney cents={month.spent} />
                    </td>
                    <td
                      className={
                        month.collected - month.spent < 0
                          ? "py-2 text-end font-semibold tabular-nums text-rose-600"
                          : "py-2 text-end font-semibold tabular-nums text-brand-700"
                      }
                    >
                      <UsdMoney cents={month.collected - month.spent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------- traction */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
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
          <Stat label="MRR" value={<UsdMoney cents={traction.mrrCents} />} sub="subscriptions only" />
          <Stat label="ARPU (30d)" value={<UsdMoney cents={traction.arpuCents} />} sub="per activated" />
          <Stat
            label="Revenue / session"
            value={<UsdMoney cents={traction.revenuePerSessionCents} />}
            sub="30d"
          />
          <Stat
            label="Model cost / session"
            value={<UsdMoney cents={traction.costPerSessionCents} />}
            sub="30d"
          />
          <Stat
            label="Contribution / session"
            value={<UsdMoney cents={traction.revenuePerSessionCents - traction.costPerSessionCents} />}
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
                <UsdMoney cents={kind.costCents} />
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
                      <span className="block text-xs text-slate-500">{t.organizationName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={t.plan && t.plan !== "payg" ? "teal" : "slate"}>
                        {t.plan ?? "payg"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{t.sessionCount}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{t.aiCalls}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-slate-600">
                      <UsdMoney cents={t.aiCostCents} />
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-slate-900">
                      <UsdMoney cents={t.revenueCents} />
                    </td>
                    <td
                      className={
                        margin >= 0
                          ? "px-4 py-2.5 text-end font-semibold tabular-nums text-emerald-700"
                          : "px-4 py-2.5 text-end font-semibold tabular-nums text-red-600"
                      }
                    >
                      <UsdMoney cents={margin} />
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
            Money that passed through us. Only the fee column is ours; a refund here reverses the
            transfer and returns our cut.
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
            <li className="px-4 py-6 text-sm text-slate-500">No patient payments yet.</li>
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
        {/* 🔴 76.7 — the tile keeps its name; the FIGURE inside it is the thing
            that reveals its pounds, like every other price in the product. */}
        <UsdMoney cents={cents} />
      </p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </Card>
  );
}

/** The bar's colour, beside the column it belongs to, so no legend is needed. */
function Swatch({ className }: { className: string }) {
  return <span className={`me-1.5 inline-block h-2 w-2 rounded-sm align-[1px] ${className}`} />;
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </Card>
  );
}
