"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";

import { downgrade, payInvoices, upgradeToUnlimited } from "@/app/(app)/billing/actions";
import { Badge, Button, Card } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { cn, formatDate } from "@/lib/utils";

export type InvoiceRow = {
  id: string;
  kind: "session" | "subscription";
  description: string;
  amountCents: number;
  discountCents: number;
  discountReason: string | null;
  status: "waived" | "included" | "due" | "paid" | "failed" | "void";
  issuedAt: string;
};

/**
 * The plan card. Unlimited is the thing being sold, so on Unlimited it is the
 * loudest object on the page rather than a line of small text at the top.
 */
export function PlanCard({
  plan,
  status,
  cancelAtPeriodEnd,
  billingEnabled,
  sessionsThisMonth,
  spentThisMonthCents,
  renewsOn,
}: {
  plan: "payg" | "unlimited";
  status: string;
  cancelAtPeriodEnd: boolean;
  billingEnabled: boolean;
  sessionsThisMonth: number;
  spentThisMonthCents: number;
  renewsOn: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  if (plan === "unlimited") {
    return (
      <div className="overflow-hidden rounded-3xl bg-navy-500 text-white">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-2.5 py-1 text-xs font-semibold text-teal-300">
                <Sparkles className="h-3 w-3" aria-hidden />
                Unlimited
              </span>
              <p className="mt-3 text-2xl font-bold tracking-tight">
                Every session, documented
              </p>
              <p className="mt-1 text-sm text-white/60">
                No per-session bills to track. $99 a month.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <dt className="text-xs text-white/60">Sessions this month</dt>
              <dd className="mt-0.5 text-2xl font-bold">{sessionsThisMonth}</dd>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <dt className="text-xs text-white/60">Extra charges</dt>
              <dd className="mt-0.5 text-2xl font-bold">$0</dd>
            </div>
          </dl>

          {renewsOn ? (
            <p className="mt-3 text-xs text-white/50">
              {cancelAtPeriodEnd ? "Ends" : "Renews"} {renewsOn}
            </p>
          ) : null}
          {status !== "active" ? (
            <p className="mt-3 rounded-xl bg-amber-400/15 px-3.5 py-2.5 text-sm text-amber-200">
              Your subscription is {status}. Update your card to avoid interruption.
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          {cancelAtPeriodEnd ? (
            <p className="text-xs text-white/60">
              Unlimited ends at the close of this period, then you return to pay as you go.
            </p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(downgrade)}
              className="text-xs font-medium text-white/60 hover:text-white"
            >
              {pending ? "Working…" : "Cancel Unlimited"}
            </button>
          )}
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900">Pay as you go</p>
      <p className="mt-0.5 text-sm text-slate-500">$6 per completed session.</p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Sessions this month</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">{sessionsThisMonth}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Paid this month</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">
            {formatUsd(spentThisMonthCents)}
          </dd>
        </div>
      </dl>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <Button
        full
        className="mt-4"
        disabled={pending || !billingEnabled}
        onClick={() => run(upgradeToUnlimited)}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {pending ? "Opening checkout…" : "Switch to Unlimited — $99/mo"}
      </Button>
      <p className="mt-2 text-center text-xs text-slate-500">
        Worth it from 17 sessions a month.
      </p>
    </Card>
  );
}

/**
 * Outstanding invoices, multi-select, one payment link for the total.
 *
 * Paying six sessions should be one checkout, not six.
 */
export function InvoiceList({
  invoices,
  billingEnabled,
}: {
  invoices: InvoiceRow[];
  billingEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const due = useMemo(() => invoices.filter((i) => i.status === "due"), [invoices]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(due.map((i) => i.id)));

  const total = due
    .filter((i) => selected.has(i.id))
    .reduce((sum, i) => sum + Math.max(0, i.amountCents - i.discountCents), 0);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const history = invoices.filter((i) => i.status !== "due");

  return (
    <div className="space-y-4">
      {due.length > 0 ? (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {due.length} invoice{due.length === 1 ? "" : "s"} outstanding
            </p>
            <button
              type="button"
              onClick={() =>
                setSelected(
                  selected.size === due.length ? new Set() : new Set(due.map((i) => i.id)),
                )
              }
              className="text-xs font-medium text-brand-600"
            >
              {selected.size === due.length ? "Clear" : "Select all"}
            </button>
          </div>

          <ul className="divide-y divide-slate-100">
            {due.map((invoice) => {
              const payable = Math.max(0, invoice.amountCents - invoice.discountCents);
              const checked = selected.has(invoice.id);
              return (
                <li key={invoice.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-slate-50">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        checked
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-slate-300 bg-white",
                      )}
                    >
                      {checked ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggle(invoice.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {invoice.description}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatDate(invoice.issuedAt)}
                        {invoice.discountCents > 0
                          ? ` · ${formatUsd(invoice.discountCents)} credit applied`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-slate-900">
                      {formatUsd(payable)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-slate-100 p-4">
            {error ? (
              <p role="alert" className="mb-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <Button
              full
              size="lg"
              disabled={pending || selected.size === 0 || !billingEnabled}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await payInvoices([...selected]);
                  if (result?.error) setError(result.error);
                })
              }
            >
              <CreditCard className="h-4 w-4" aria-hidden />
              {pending
                ? "Opening checkout…"
                : `Pay ${formatUsd(total)} · ${selected.size} invoice${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          History
        </p>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nothing settled yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {invoice.description}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {formatDate(invoice.issuedAt)}
                    {invoice.discountReason ? ` · ${invoice.discountReason}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-900">
                  {invoice.amountCents === 0
                    ? "Free"
                    : formatUsd(Math.max(0, invoice.amountCents - invoice.discountCents))}
                </span>
                <InvoiceBadge status={invoice.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function InvoiceBadge({ status }: { status: InvoiceRow["status"] }) {
  if (status === "paid") return <Badge tone="green">Paid</Badge>;
  if (status === "due") return <Badge tone="amber">Due</Badge>;
  if (status === "waived") return <Badge tone="teal">Free</Badge>;
  if (status === "included") return <Badge tone="brand">Included</Badge>;
  if (status === "void") return <Badge tone="slate">Void</Badge>;
  return <Badge tone="red">Failed</Badge>;
}
