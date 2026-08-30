"use client";

import { ArrowUpRight, Clock, CreditCard, Receipt, Undo2 } from "lucide-react";

import { Card, EmptyState } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export type PaymentRow = {
  id: string;
  payerName: string | null;
  grossCents: number;
  therapistNetCents: number;
  settledInvoiceCents: number;
  status: "pending" | "paid" | "refunded" | "failed";
  capture: "destination" | "platform";
  paymentBrand: string | null;
  paymentLast4: string | null;
  receiptUrl: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type TransferRow = {
  id: string;
  amountCents: number;
  status: "pending" | "paid" | "failed";
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
};

/**
 * Every patient payment, with how it was paid and where it went.
 *
 * The card brand and last four are here for one reason: a patient emails their
 * therapist asking which card they used, and until now the honest answer was
 * "I have no idea". Four digits answers it. Nothing more is stored — no token,
 * no fingerprint, nothing that could charge the card again.
 *
 * `capture` is shown, not hidden, on any payment we held. A clinician looking
 * at a payment that has not reached their bank deserves to see *why* on the row
 * itself rather than working it out from a balance that does not add up.
 */
export function PaymentHistory({
  payments,
  transfers,
}: {
  payments: PaymentRow[];
  transfers: TransferRow[];
}) {
  if (payments.length === 0 && transfers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Receipt className="h-5 w-5" aria-hidden />}
          title="No patient payments yet"
          body="Set a price on a session link or on the Crisis Radar and payments appear here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {payments.length > 0 ? (
        <Card className="overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Patient payments
          </p>
          <ul className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <li key={payment.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-slate-900">
                      {payment.payerName || "A patient"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span>{payment.paidAt ?? payment.createdAt}</span>
                      {payment.paymentBrand ? (
                        <span className="inline-flex items-center gap-1 capitalize">
                          <CreditCard className="h-3 w-3" aria-hidden />
                          {payment.paymentBrand}
                          {payment.paymentLast4 ? ` ·${payment.paymentLast4}` : ""}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">
                      {formatUsd(payment.therapistNetCents)}
                    </p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      of {formatUsd(payment.grossCents)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusChip status={payment.status} />
                  {payment.status === "paid" && payment.capture === "platform" ? (
                    <Chip tone="amber" icon={<Clock className="h-3 w-3" aria-hidden />}>
                      Held until payouts open
                    </Chip>
                  ) : null}
                  {payment.settledInvoiceCents > 0 ? (
                    <Chip tone="slate">
                      {formatUsd(payment.settledInvoiceCents)} of your bills settled
                    </Chip>
                  ) : null}
                  {payment.receiptUrl ? (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Receipt
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {transfers.length > 0 ? (
        <Card className="overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Released to your Stripe account
          </p>
          <ul className="divide-y divide-slate-100">
            {transfers.map((transfer) => (
              <li key={transfer.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{transfer.paidAt ?? transfer.createdAt}</p>
                  {transfer.status === "failed" ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-red-600">
                      Did not go through — we will try again.
                      {transfer.failureReason ? ` ${transfer.failureReason}` : ""}
                    </p>
                  ) : transfer.status === "pending" ? (
                    <p className="mt-0.5 text-xs text-amber-600">In flight</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm font-bold text-slate-900 tabular-nums">
                  {formatUsd(transfer.amountCents)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function StatusChip({ status }: { status: PaymentRow["status"] }) {
  if (status === "paid") return <Chip tone="green">Paid</Chip>;
  if (status === "pending") return <Chip tone="amber">Not completed</Chip>;
  if (status === "refunded") {
    return (
      <Chip tone="slate" icon={<Undo2 className="h-3 w-3" aria-hidden />}>
        Refunded
      </Chip>
    );
  }
  return <Chip tone="red">Failed</Chip>;
}

function Chip({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "red" | "slate";
  icon?: React.ReactNode;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
