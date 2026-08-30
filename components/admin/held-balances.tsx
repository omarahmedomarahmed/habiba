"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Send, ShieldCheck } from "lucide-react";

import { releaseTherapistEarnings } from "@/app/(admin)/admin/actions";
import { Badge, Button, Card } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { fullName } from "@/lib/utils";

export type HeldRow = {
  therapistId: string;
  firstName: string;
  lastName: string | null;
  email: string;
  payoutsEnabled: boolean;
  hasAccount: boolean;
  heldCents: number;
};

/**
 * Other people's money, and how much of it we have.
 *
 * The single number on this page that is a liability rather than a
 * result — everything else in the vault is revenue, spend and margin. It is
 * first, it is labelled as somebody else's, and every row carries the reason it
 * has not gone out yet, because "why is this still here" is the only question
 * anyone will ever ask of this table.
 *
 * The release button is not the mechanism. Three automatic paths already move
 * this money; this is for the clinician on the phone whose webhook never
 * arrived, and it reports Stripe's own refusal rather than swallowing it.
 */
export function HeldBalances({
  rows,
  totalHeldCents,
  outOfBalanceCents,
}: {
  rows: HeldRow[];
  totalHeldCents: number;
  outOfBalanceCents: number;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
        Held for clinicians
      </h2>

      {/*
        The books not balancing is not a warning, it is an incident. `journal`
        refuses to write an unbalanced transaction, so a non-zero here means
        something wrote to the table that was not `journal` — and the number is
        how much of one.
      */}
      {outOfBalanceCents !== 0 ? (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-red-800">The ledger does not balance</p>
            <p className="mt-0.5 text-sm text-red-700">
              Out by {formatUsd(Math.abs(outOfBalanceCents))}. Every transaction is posted through
              one function that rejects an unbalanced set of legs, so this means something else
              wrote to the table. Do not adjust it away — find the writer.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {rows.length === 0
              ? "Nothing held"
              : `${rows.length} clinician${rows.length === 1 ? "" : "s"}`}
          </p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">
            {formatUsd(totalHeldCents)}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            Every patient payment went straight into its clinician&apos;s own account. We are
            holding nothing.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <HeldRowItem key={row.therapistId} row={row} />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function HeldRowItem({ row }: { row: HeldRow }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {fullName(row.firstName, row.lastName, row.email)}
          </p>
          <p className="truncate text-xs text-slate-500">{row.email}</p>
        </div>
        <p className="shrink-0 text-sm font-bold text-slate-900 tabular-nums">
          {formatUsd(row.heldCents)}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!row.hasAccount ? (
          <Badge tone="red">No Stripe account</Badge>
        ) : row.payoutsEnabled ? (
          <Badge tone="amber">Verified — should have released</Badge>
        ) : (
          <Badge tone="slate">Awaiting Stripe verification</Badge>
        )}

        {/*
          Offered only where it could work. A release button on a clinician with
          no connected account is a button whose only possible outcome is an
          error message.
        */}
        {row.hasAccount ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setMessage(null);
                const result = await releaseTherapistEarnings(row.therapistId);
                if (result.error) setError(result.error);
                else setMessage(`Released ${formatUsd(result.movedCents ?? 0)}`);
              })
            }
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Releasing…" : "Release now"}
          </Button>
        ) : null}
      </div>

      {message ? <p className="mt-1.5 text-xs text-emerald-700">{message}</p> : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </li>
  );
}
