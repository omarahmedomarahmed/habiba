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
import { useLocale, useT } from "@/lib/i18n/client";
import { localeTag } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";

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

/* 37L.2 — keys, resolved at render. See the nav and the orb for the pattern. */
const STATUS: Record<PayoutStatus, { label: MessageKey; blurb: MessageKey; icon: typeof Clock }> = {
  requested: { label: "twd.statusRequested", blurb: "twd.statusRequestedBody", icon: Clock },
  approved: { label: "twd.statusApproved", blurb: "twd.statusApprovedBody", icon: CheckCircle2 },
  sent: { label: "twd.statusSent", blurb: "twd.statusSentBody", icon: Send },
  confirmed: { label: "twd.statusArrived", blurb: "twd.statusArrivedBody", icon: CheckCircle2 },
  rejected: { label: "twd.statusRejected", blurb: "twd.statusRejectedBody", icon: XCircle },
};

function Saving({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
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
  const t = useT();
  const locale = useLocale();
  const [saveState, saveAction] = useActionState(savePayoutDestination, INITIAL);
  const [askState, askAction] = useActionState(requestWithdrawal, INITIAL);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">{t("twd.holding")}</p>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label={t("twd.held")} cents={heldCents} />
          <Figure label={t("twd.statusRequested")} cents={requestedCents} />
          <Figure label={t("twd.statusSent")} cents={sentCents} />
          <Figure label={t("twd.availableNow")} cents={availableCents} strong />
        </dl>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {t("twd.availableNote")}
        </p>
      </Card>

      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Banknote className="h-4 w-4 text-slate-400" aria-hidden />
          {t("twd.where")}
        </p>

        {method ? (
          <p className="mt-1 text-sm text-slate-600">
            {method.method === "instapay" ? t("twd.instapay") : t("twd.wallet")} ·{" "}
            {method.identifier} ·{" "}
            {method.accountName}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            {t("twd.notSet")}
          </p>
        )}

        <form action={saveAction} className="mt-3 space-y-3">
          <Field label={t("twd.method")}>
            <select
              name="method"
              defaultValue={method?.method ?? methods[0]}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m === "instapay" ? t("twd.instapayFull") : t("twd.walletFull")}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("twd.identifier")}>
            <Input name="identifier" defaultValue={method?.identifier ?? ""} required />
          </Field>

          <Field
            label={t("twd.fullName")}
            hint={t("twd.fullNameHint")}
          >
            <Input name="accountName" defaultValue={method?.accountName ?? ""} required />
          </Field>

          {saveState.error ? <p className="text-sm text-rose-600">{saveState.error}</p> : null}
          <Saving label={t("twd.saveDetails")} />
        </form>
      </Card>

      {availableCents > 0 && method ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">{t("twd.withdraw")}</p>
          <form action={askAction} className="mt-3 flex items-end gap-2">
            <Field label={t("twd.amountUsd")}>
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
            <Saving label={t("twd.request")} />
          </form>
          {askState.error ? (
            <p className="mt-2 text-sm text-rose-600">{askState.error}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            {t("twd.rateNote")}
          </p>
        </Card>
      ) : null}

      {history.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">{t("twd.yours")}</p>
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
                    {formatMoney(
                      row.payoutAmountMinor,
                      row.payoutCurrency.toUpperCase(),
                      localeTag(locale),
                    )}
                    <span className="ml-auto text-xs font-normal text-slate-500">
                      {t(state.label)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(state.blurb)} {t("twd.requestedOn", { date: row.requestedAtLabel })}
                    {row.movedAtLabel
                      ? ` · ${t("twd.updatedOn", { date: row.movedAtLabel })}`
                      : ""}
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
                      {t("twd.receipt")}
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
