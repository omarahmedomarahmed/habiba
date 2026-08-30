"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Receipt,
} from "lucide-react";

import { payInvoices } from "@/app/(app)/billing/actions";
import { Badge, Button, Card } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export type LedgerInvoice = {
  id: string;
  kind: "session" | "subscription";
  description: string;
  amountCents: number;
  discountCents: number;
  discountReason: string | null;
  status: "waived" | "included" | "due" | "paid" | "failed" | "void";
  issuedAt: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** ISO, for ordering. The display strings above are already localised, and
   *  "9 Aug 2026" does not sort. */
  sortAt: string;
  /**
   * What the session actually involved.
   *
   * Null for a subscription period, and for any session old enough to predate
   * usage logging. "Completed session · $6" eleven times is a bill nobody can
   * check; this is what turns one of those rows into something a clinician can
   * recognise as a specific afternoon.
   */
  usage: {
    transcribedSeconds: number;
    noteWritten: boolean;
    copilotQuestions: number;
    riskScans: number;
    translated: boolean;
  } | null;
};

export type LedgerPayment = {
  id: string;
  payerName: string | null;
  grossCents: number;
  platformFeeCents: number;
  settledInvoiceCents: number;
  therapistNetCents: number;
  status: "pending" | "paid" | "refunded" | "failed";
  /** Straight into their account, or held by us pending verification. */
  capture: "destination" | "platform";
  createdAt: string;
  paidAt: string | null;
  /** ISO, for ordering — see LedgerInvoice.sortAt. */
  sortAt: string;
};

type Entry =
  | { kind: "invoice"; at: string; sortAt: string; invoice: LedgerInvoice }
  | { kind: "payment"; at: string; sortAt: string; payment: LedgerPayment };

/**
 * One chronological ledger: what you paid us, and what patients paid you.
 *
 * These used to be two disconnected lists, which meant a therapist could not
 * answer "what happened to my money in March" without reading both and merging
 * them by hand. Direction is carried by the arrow and the sign, never by which
 * list something happens to be in.
 *
 * Outstanding invoices stay pinned at the top with the multi-select, because
 * paying a bill is a task and the rest of this is a record.
 */
export function BillingLedger({
  invoices,
  payments,
  billingEnabled,
}: {
  invoices: LedgerInvoice[];
  payments: LedgerPayment[];
  billingEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const due = useMemo(() => invoices.filter((i) => i.status === "due"), [invoices]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(due.map((i) => i.id)));

  const total = due
    .filter((i) => selected.has(i.id))
    .reduce((sum, i) => sum + Math.max(0, i.amountCents - i.discountCents), 0);

  /*
   * Sorted on the ISO timestamp, never the display string. Ordering
   * "9 Aug 2026" against "10 Jul 2026" lexicographically puts July after
   * August, which is the kind of bug nobody notices until a therapist is
   * trying to reconcile a month.
   */
  const history: Entry[] = useMemo(() => {
    const rows: Entry[] = [
      ...invoices
        .filter((i) => i.status !== "due")
        .map((invoice) => ({
          kind: "invoice" as const,
          at: invoice.issuedAt,
          sortAt: invoice.sortAt,
          invoice,
        })),
      ...payments.map((payment) => ({
        kind: "payment" as const,
        at: payment.paidAt ?? payment.createdAt,
        sortAt: payment.sortAt,
        payment,
      })),
    ];
    return rows.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  }, [invoices, payments]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
                setSelected(selected.size === due.length ? new Set() : new Set(due.map((i) => i.id)))
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
                        {invoice.issuedAt}
                        {invoice.discountCents > 0
                          ? ` · ${formatUsd(invoice.discountCents)} credit applied`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
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
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Everything, in order</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Money you paid us and money patients paid you, in one list. Tap any row for the detail.
          </p>
        </div>

        {history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nothing has settled yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((entry) => {
              const id = entry.kind === "invoice" ? entry.invoice.id : entry.payment.id;
              const open = openId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-start active:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        entry.kind === "payment"
                          ? "bg-teal-50 text-teal-600"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {entry.kind === "payment" ? (
                        <ArrowDownLeft className="h-4 w-4" aria-hidden />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {entry.kind === "invoice"
                          ? entry.invoice.description
                          : `${entry.payment.payerName ?? "Patient"} paid you`}
                      </span>
                      <span className="block text-xs text-slate-500">{entry.at}</span>
                    </span>

                    <span className="shrink-0 text-end">
                      <span
                        className={cn(
                          "block text-sm font-semibold tabular-nums",
                          entry.kind === "payment" ? "text-teal-700" : "text-slate-900",
                        )}
                      >
                        {entry.kind === "payment"
                          ? `+${formatUsd(entry.payment.therapistNetCents)}`
                          : entry.invoice.amountCents === 0
                            ? "Free"
                            : `−${formatUsd(
                                Math.max(0, entry.invoice.amountCents - entry.invoice.discountCents),
                              )}`}
                      </span>
                    </span>

                    <StatusBadge entry={entry} />
                  </button>

                  {open ? (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3.5">
                      {entry.kind === "invoice" ? (
                        <InvoiceDetail invoice={entry.invoice} />
                      ) : (
                        <PaymentDetail payment={entry.payment} />
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ entry }: { entry: Entry }) {
  if (entry.kind === "payment") {
    const status = entry.payment.status;
    if (status === "paid") return <Badge tone="green">Received</Badge>;
    if (status === "pending") return <Badge tone="amber">Awaiting</Badge>;
    if (status === "refunded") return <Badge tone="slate">Refunded</Badge>;
    return <Badge tone="red">Failed</Badge>;
  }

  const status = entry.invoice.status;
  if (status === "paid") return <Badge tone="green">Paid</Badge>;
  if (status === "due") return <Badge tone="amber">Due</Badge>;
  if (status === "waived") return <Badge tone="teal">Free</Badge>;
  if (status === "included") return <Badge tone="brand">Included</Badge>;
  if (status === "void") return <Badge tone="slate">Void</Badge>;
  return <Badge tone="red">Failed</Badge>;
}

function InvoiceDetail({ invoice }: { invoice: LedgerInvoice }) {
  const payable = Math.max(0, invoice.amountCents - invoice.discountCents);
  return (
    <dl className="space-y-1.5 text-sm">
      <Line label="Invoice" value={<span className="font-mono text-xs">{invoice.id.slice(0, 8)}</span>} />
      <Line label="Type" value={invoice.kind === "session" ? "Completed session" : "Subscription"} />
      <Line label="Issued" value={invoice.issuedAt} />
      {invoice.periodStart && invoice.periodEnd ? (
        <Line label="Period" value={`${invoice.periodStart} → ${invoice.periodEnd}`} />
      ) : null}
      <Line label="Amount" value={formatUsd(invoice.amountCents)} />
      {invoice.discountCents > 0 ? (
        <Line
          label="Credit"
          value={
            <span className="text-teal-700">
              −{formatUsd(invoice.discountCents)}
              {invoice.discountReason ? ` · ${invoice.discountReason}` : ""}
            </span>
          }
        />
      ) : null}
      <Line
        label="You paid"
        value={<span className="font-semibold">{invoice.paidAt ? formatUsd(payable) : "—"}</span>}
      />
      {invoice.paidAt ? <Line label="Settled" value={invoice.paidAt} /> : null}

      {invoice.usage ? <UsageBreakdown usage={invoice.usage} /> : null}
    </dl>
  );
}

/**
 * What the money bought.
 *
 * The work, not our cost. A clinician is entitled to know what a charge covered
 * — and a forty-minute session next to a two-minute one that dropped is the
 * difference between a fair bill and one worth querying. What we paid a model
 * for it is our side of the trade and belongs on the admin screens, not on a
 * customer's invoice, where it would start an argument about margin instead of
 * answering the question.
 */
function UsageBreakdown({ usage }: { usage: NonNullable<LedgerInvoice["usage"]> }) {
  const minutes = Math.round(usage.transcribedSeconds / 60);
  const items = [
    minutes > 0 ? `${minutes} minute${minutes === 1 ? "" : "s"} transcribed` : null,
    usage.noteWritten ? "Note written" : null,
    usage.translated ? "Note translated" : null,
    usage.riskScans > 0 ? `${usage.riskScans} risk scan${usage.riskScans === 1 ? "" : "s"}` : null,
    usage.copilotQuestions > 0
      ? `${usage.copilotQuestions} copilot question${usage.copilotQuestions === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean) as string[];

  if (items.length === 0) return null;

  return (
    <div className="mt-2.5 border-t border-slate-200 pt-2.5">
      <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
        What this covered
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-slate-600">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaymentDetail({ payment }: { payment: LedgerPayment }) {
  const ourFee = payment.platformFeeCents - payment.settledInvoiceCents;
  return (
    <dl className="space-y-1.5 text-sm">
      <Line label="Payment" value={<span className="font-mono text-xs">{payment.id.slice(0, 8)}</span>} />
      <Line label="Patient paid" value={formatUsd(payment.grossCents)} />
      <Line label="24Therapy fee" value={<span className="text-slate-500">−{formatUsd(ourFee)}</span>} />
      {payment.settledInvoiceCents > 0 ? (
        <Line
          label="Your bill, settled"
          value={<span className="text-slate-500">−{formatUsd(payment.settledInvoiceCents)}</span>}
        />
      ) : null}
      <Line
        label={payment.capture === "destination" ? "Into your Stripe account" : "Held for you"}
        value={
          <span className="font-semibold text-teal-700">
            {formatUsd(payment.therapistNetCents)}
          </span>
        }
      />
      <Line label="Date" value={payment.paidAt ?? payment.createdAt} />
      {/*
        Two payments, two true sentences. Printing the first one on a held
        payment would be the most consequential lie on the page — it says the
        money is somewhere it is not.
      */}
      <p className="pt-1.5 text-xs leading-relaxed text-slate-500">
        <Receipt className="me-1 inline h-3 w-3" aria-hidden />
        {payment.capture === "destination"
          ? "Paid directly into your own Stripe account — we never held this money. Stripe pays it out to your bank on its own schedule."
          : "Stripe had not finished verifying you when this was paid, so we took it and are holding your share. It moves to your account automatically the moment verification completes."}
      </p>
    </dl>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end text-slate-800 tabular-nums">{value}</dd>
    </div>
  );
}

