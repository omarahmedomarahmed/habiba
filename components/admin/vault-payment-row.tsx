"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";

import { refundPatient } from "@/app/(admin)/admin/actions";
import { Badge, Button, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";

/**
 * One patient→therapist payment in the Vault, with the refund control inline.
 *
 * The refund reverses the transfer out of the therapist's balance and returns
 * our fee too, so the numbers on the row above it change the moment it goes
 * through. Refunding is deliberately here and not on the therapist's own
 * billing page — see the comment on the action.
 */
export function VaultPaymentRow(props: {
  id: string;
  sessionId: string;
  payerName: string | null;
  therapistName: string | null;
  organizationName: string | null;
  grossCents: number;
  platformFeeCents: number;
  settledInvoiceCents: number;
  therapistNetCents: number;
  status: "pending" | "paid" | "refunded" | "failed";
  when: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(props.status);

  const ourCut = props.platformFeeCents - props.settledInvoiceCents;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {props.payerName ?? "Patient"} → {props.therapistName ?? "Clinician"}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {props.organizationName ?? "—"} · {props.when} · we kept {formatUsd(ourCut)}
            {props.settledInvoiceCents > 0
              ? ` · ${formatUsd(props.settledInvoiceCents)} of their bill settled`
              : ""}
          </span>
        </span>

        <span className="shrink-0 text-end">
          <span className="block text-sm font-semibold tabular-nums text-slate-900">
            {formatUsd(props.grossCents)}
          </span>
          <span className="block text-xs tabular-nums text-slate-400">
            {formatUsd(props.therapistNetCents)} to them
          </span>
        </span>

        <Badge
          tone={
            status === "paid"
              ? "green"
              : status === "pending"
                ? "amber"
                : status === "refunded"
                  ? "slate"
                  : "red"
          }
        >
          {status}
        </Badge>

        {status === "paid" ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Refund this payment"
            className="tap-target flex items-center justify-center rounded-lg px-2 text-slate-400 hover:text-slate-800"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
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

          <p className="text-xs leading-relaxed text-slate-500">
            Refunds {formatUsd(props.grossCents)} to the patient, pulls{" "}
            {formatUsd(props.therapistNetCents)} back out of the clinician&apos;s Stripe balance and
            returns our {formatUsd(ourCut)} fee.
            {props.settledInvoiceCents > 0
              ? " Any 24Therapy invoice settled from this payment goes back to due."
              : ""}
          </p>

          <Input
            aria-label="Reason for the refund"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Clinician never joined the room"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await refundPatient(props.id, reason);
                  if (result?.error) setError(result.error);
                  else {
                    setStatus("refunded");
                    setOpen(false);
                  }
                })
              }
            >
              {pending ? "Refunding…" : `Refund ${formatUsd(props.grossCents)}`}
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
