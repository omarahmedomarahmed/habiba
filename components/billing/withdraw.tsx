"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Banknote, CheckCircle2, Clock, Send, XCircle } from "lucide-react";

import {
  requestWithdrawal,
  savePayoutDestination,
  type EarningsState,
} from "@/app/(app)/earnings/actions";
import { Button, Card, Field, Input } from "@/components/ui";
// 19.4 — an English-only surface, so the English shorthand, named as such.
import { formatMoney, formatUsd } from "@/lib/billing/plans";
import type { PayoutStatus } from "@/lib/db/schema";

const INITIAL: EarningsState = {};

/**
 * The manual rail, from the clinician's side. PLAN.md 16.2, 16.3c, 16.10.
 *
 * ## 🔴 Four numbers, not one (16.10)
 *
 * *Available* is the only one they can act on, and it is deliberately the
 * smallest: it is what we hold **minus** anything already requested. A screen
 * that shows a balance including money that is halfway out of the door invites
 * a second request for money that is already gone, and then a refusal that
 * reads like an error. "Available must never include money we cannot actually
 * move" is the whole of 16.10.
 *
 * ## Why every state has a date
 *
 * 16.2 and C74: *"requested" with no date is how trust is lost.* Each row
 * below carries when it moved and, once sent, a link to the transfer receipt
 * the staff member uploaded (16.3c) — so a clinician waiting on money can see
 * something concrete rather than a spinner in a different building.
 *
 * Dates arrive **formatted, from the server** (C70/C84). Nothing here reads a
 * clock or a zone.
 */

export type WithdrawRow = {
  id: string;
  amountCents: number;
  payoutAmountMinor: number;
  payoutCurrency: string;
  status: PayoutStatus;
  requestedAtLabel: string;
  movedAtLabel: string | null;
  proofUrl: string | null;
  rejectedReason: string | null;
  accountName: string;
};

const STATUS: Record<PayoutStatus, { label: string; blurb: string; icon: typeof Clock }> = {
  requested: { label: "Requested", blurb: "We have it. Somebody is on it.", icon: Clock },
  approved: { label: "Approved", blurb: "Checked. The transfer is next.", icon: CheckCircle2 },
  sent: { label: "Sent", blurb: "The transfer has been made.", icon: Send },
  confirmed: { label: "Arrived", blurb: "Confirmed received.", icon: CheckCircle2 },
  rejected: { label: "Not processed", blurb: "See the reason below.", icon: XCircle },
};

function Saving({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function Withdraw({
  heldCents,
  requestedCents,
  sentCents,
  availableCents,
  method,
  methods,
  history,
}: {
  heldCents: number;
  requestedCents: number;
  sentCents: number;
  availableCents: number;
  method: { method: string; identifier: string; accountName: string } | null;
  /** What this deployment offers, from `payouts` settings. 16.1. */
  methods: string[];
  history: WithdrawRow[];
}) {
  const [saveState, saveAction] = useActionState(savePayoutDestination, INITIAL);
  const [askState, askAction] = useActionState(requestWithdrawal, INITIAL);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Money we are holding for you</p>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Held" cents={heldCents} />
          <Figure label="Requested" cents={requestedCents} />
          <Figure label="Sent" cents={sentCents} />
          <Figure label="Available now" cents={availableCents} strong />
        </dl>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Available is what you can withdraw today. It excludes anything already requested, that
          money is on its way and cannot be asked for twice.
        </p>
      </Card>

      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Banknote className="h-4 w-4 text-slate-400" aria-hidden />
          Where your money goes
        </p>

        {method ? (
          <p className="mt-1 text-sm text-slate-600">
            {method.method === "instapay" ? "InstaPay" : "Mobile wallet"} · {method.identifier} ·{" "}
            {method.accountName}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            Not set yet. We cannot send you anything until we know where.
          </p>
        )}

        <form action={saveAction} className="mt-3 space-y-3">
          <Field label="Method">
            <select
              name="method"
              defaultValue={method?.method ?? methods[0]}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m === "instapay" ? "InstaPay bank transfer" : "Mobile wallet (EGP)"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Account or wallet number">
            <Input name="identifier" defaultValue={method?.identifier ?? ""} required />
          </Field>

          <Field
            label="Full name"
            hint="Exactly as it appears on that account. A name the bank cannot match is a transfer that bounces."
          >
            <Input name="accountName" defaultValue={method?.accountName ?? ""} required />
          </Field>

          {saveState.error ? <p className="text-sm text-rose-600">{saveState.error}</p> : null}
          <Saving label="Save payout details" />
        </form>
      </Card>

      {availableCents > 0 && method ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">Withdraw</p>
          <form action={askAction} className="mt-3 flex items-end gap-2">
            <Field label="Amount (USD)">
              <Input
                name="amountDollars"
                type="number"
                step="0.01"
                min="0.01"
                max={(availableCents / 100).toFixed(2)}
                defaultValue={(availableCents / 100).toFixed(2)}
                required
              />
            </Field>
            <Saving label="Request" />
          </form>
          {askState.error ? (
            <p className="mt-2 text-sm text-rose-600">{askState.error}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            We send Egyptian pounds at the rate quoted when you request, and that rate is fixed on
            your request. It does not move while you wait.
          </p>
        </Card>
      ) : null}

      {history.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">Your withdrawals</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {history.map((row) => {
              const state = STATUS[row.status];
              const Icon = state.icon;
              return (
                <li key={row.id} className="py-2.5">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    {formatUsd(row.amountCents)}
                    <span className="text-slate-400">→</span>
                    {formatMoney(row.payoutAmountMinor, row.payoutCurrency.toUpperCase(), "en-US")}
                    <span className="ml-auto text-xs font-normal text-slate-500">
                      {state.label}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {state.blurb} Requested {row.requestedAtLabel}
                    {row.movedAtLabel ? ` · updated ${row.movedAtLabel}` : ""}
                  </p>
                  {row.rejectedReason ? (
                    <p className="mt-1 text-xs text-rose-600">{row.rejectedReason}</p>
                  ) : null}
                  {row.proofUrl ? (
                    <a
                      href={row.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-brand-600"
                    >
                      See the transfer receipt
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Figure({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={
          strong ? "text-lg font-semibold text-slate-900" : "text-lg font-medium text-slate-700"
        }
      >
        {formatUsd(cents)}
      </dd>
    </div>
  );
}
