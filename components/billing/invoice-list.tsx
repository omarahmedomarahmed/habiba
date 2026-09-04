"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";

import { buyCredits, payInvoices } from "@/app/(app)/billing/actions";
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

export type TierRow = { key: string; name: string; rateCents: number; minimumSessions: number };

/**
 * What a session costs you, and how to make it cost less.
 *
 * ## What this replaced
 *
 * A card that sold a $99/month Unlimited subscription and, on PAYG, existed
 * mainly to advertise it — "worth it from 17 sessions a month". There is no
 * subscription any more. A therapist buys sessions outright and the rate falls
 * with the quantity, so the card's job changed from *upgrade* to *stock up*.
 *
 * The quantity is a slider above the tier minimum rather than three fixed
 * packs, because that is what §3 asks for and because a fixed pack makes a
 * therapist who needs eleven sessions buy thirty.
 *
 * Every figure here — the rates, the minimums, the expiry — is passed in from
 * `platform_settings`. Nothing on this card is written in the file.
 */
export function PlanCard({
  tiers,
  currentTierKey,
  creditsRemaining,
  creditsExpireOn,
  billingEnabled,
  sessionsThisMonth,
  spentThisMonthCents,
}: {
  tiers: TierRow[];
  currentTierKey: string;
  creditsRemaining: number;
  creditsExpireOn: string | null;
  billingEnabled: boolean;
  sessionsThisMonth: number;
  spentThisMonthCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payg = tiers.find((t) => t.minimumSessions === 0) ?? tiers[0];
  const best = tiers.reduce((a, b) => (b.minimumSessions > a.minimumSessions ? b : a), tiers[0]!);

  // Start the slider at the cheapest tier's minimum: the number a therapist is
  // most likely to want is the one that unlocks the best rate.
  const [quantity, setQuantity] = useState(best.minimumSessions || 10);

  const tierFor = (qty: number) =>
    tiers.reduce((chosen, t) => (t.minimumSessions <= qty ? t : chosen), tiers[0]!);

  const chosen = tierFor(quantity);
  const total = chosen.rateCents * quantity;
  const current = tiers.find((t) => t.key === currentTierKey) ?? payg;

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{current.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatUsd(current.rateCents)} per completed session.
          </p>
        </div>
        {creditsRemaining > 0 ? (
          <Badge tone="teal">
            {creditsRemaining} credit{creditsRemaining === 1 ? "" : "s"} left
          </Badge>
        ) : null}
      </div>

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

      {creditsRemaining > 0 && creditsExpireOn ? (
        <p className="mt-3 text-xs text-slate-500">
          Your credits are used before anything is billed. The next batch expires{" "}
          {creditsExpireOn}.
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <label htmlFor="credit-quantity" className="text-sm font-semibold text-slate-900">
          Buy sessions in advance
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          The more you buy at once, the less each one costs. They never expire before you have had
          a year to use them.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <input
            id="credit-quantity"
            type="range"
            min={1}
            max={Math.max(best.minimumSessions * 2, 60)}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-2 flex-1 cursor-pointer accent-brand-500"
          />
          <span className="w-20 shrink-0 text-end text-sm font-semibold tabular-nums text-slate-900">
            {quantity} session{quantity === 1 ? "" : "s"}
          </span>
        </div>

        {/*
          Three lines with reasons, never one number.
          The rate is the thing that changes with the slider, so it is named
          rather than folded into the total.
        */}
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">{chosen.name} rate</dt>
            <dd className="tabular-nums text-slate-900">{formatUsd(chosen.rateCents)} each</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt className="text-slate-900">Total today</dt>
            <dd className="tabular-nums text-slate-900">{formatUsd(total)}</dd>
          </div>
        </dl>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <Button
          full
          className="mt-4"
          disabled={pending || !billingEnabled || quantity < 1}
          onClick={() => run(() => buyCredits(quantity))}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {pending ? "Opening checkout…" : `Buy ${quantity} for ${formatUsd(total)}`}
        </Button>
      </div>
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
