"use client";

import { useState, useTransition } from "react";
import { Percent } from "lucide-react";

import { applyInvoiceDiscount, applyUpcomingDiscount } from "@/app/(admin)/admin/actions";
import { Badge, Button, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";

/**
 * One invoice in the Vault, with the discount controls inline.
 *
 * Discounts are entered in dollars and converted here; the server clamps the
 * result to the invoice amount regardless of what arrives.
 */
export function VaultInvoiceRow(props: {
  id: string;
  organizationId: string;
  organizationName: string;
  description: string;
  kind: "session" | "subscription";
  amountCents: number;
  discountCents: number;
  discountReason: string | null;
  status: string;
  issuedAt: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(((props.amountCents - props.discountCents) / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(props.discountCents);
  const [status, setStatus] = useState(props.status);

  const payable = Math.max(0, props.amountCents - applied);
  const settled = status === "paid" || status === "waived" || status === "included";

  const run = (fn: () => Promise<{ error?: string; ok?: boolean }>, onDone: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
      else onDone();
    });

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {props.description}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {props.organizationName} · {props.issuedAt}
            {applied > 0 ? ` · ${formatUsd(applied)} discounted` : ""}
          </span>
        </span>

        <span className="shrink-0 text-end">
          <span className="block text-sm font-semibold tabular-nums text-slate-900">
            {formatUsd(payable)}
          </span>
          {applied > 0 ? (
            <span className="block text-xs text-slate-400 line-through tabular-nums">
              {formatUsd(props.amountCents)}
            </span>
          ) : null}
        </span>

        <Badge
          tone={
            status === "paid"
              ? "green"
              : status === "due"
                ? "amber"
                : status === "waived"
                  ? "teal"
                  : "slate"
          }
        >
          {status}
        </Badge>

        {!settled ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Discount this invoice"
            className="tap-target flex items-center justify-center rounded-lg px-2 text-slate-400 hover:text-slate-800"
          >
            <Percent className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-2.5 rounded-xl bg-slate-50 p-3">
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              aria-label="Discount in dollars"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="6.00"
            />
            <Input
              aria-label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    applyInvoiceDiscount(
                      props.id,
                      Math.round(Number(amount || 0) * 100),
                      reason,
                    ),
                  () => {
                    const cents = Math.min(
                      Math.round(Number(amount || 0) * 100),
                      props.amountCents,
                    );
                    setApplied(cents);
                    if (cents >= props.amountCents) setStatus("waived");
                    setOpen(false);
                  },
                )
              }
            >
              Discount this invoice
            </Button>

            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    applyUpcomingDiscount(
                      props.organizationId,
                      Math.round(Number(amount || 0) * 100),
                      reason,
                    ),
                  () => setOpen(false),
                )
              }
            >
              Credit their next renewal
            </Button>

            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
