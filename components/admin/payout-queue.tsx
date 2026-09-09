"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, ShieldAlert, UserCheck } from "lucide-react";

import {
  approve,
  confirm,
  markSent,
  reject,
  takeOn,
  type QueueState,
} from "@/app/(admin)/admin/payouts/actions";
import { Badge, Button, Card, Input } from "@/components/ui";
// 19.4 — an English-only surface, so the English shorthand, named as such.
import { formatMoney, formatUsd } from "@/lib/billing/plans";
import type { PayoutStatus } from "@/lib/db/schema";

const INITIAL: QueueState = {};

/**
 * The manual payout queue, which is somebody's job. PLAN.md 16.3, 16.3a–d.
 *
 * ## 🔴 Age is the first thing on the row
 *
 * Not the amount and not the name. A payout request is a promise, and the
 * failure mode 16.3 names is not "wrong" but "stuck" — money somebody is owed
 * and cannot see moving. An overdue row is red and says how many hours,
 * because a queue where the oldest item does not look different is a queue
 * worked newest-first.
 *
 * ## The refusals are not in this file
 *
 * Approving your own payout, or approving a transfer to details you edited
 * yourself, is refused by `lib/billing/payouts.ts` and by two CHECK
 * constraints. This screen shows *that a second person is needed*; it does not
 * decide it. A permission enforced in a component is a permission enforced
 * nowhere.
 */

export type QueueRow = {
  id: string;
  therapistName: string;
  amountCents: number;
  payoutAmountMinor: number;
  payoutCurrency: string;
  method: string;
  identifier: string;
  accountName: string;
  status: PayoutStatus;
  entity: string;
  ageHours: number;
  overdue: boolean;
  needsTwoPeople: boolean;
  owned: boolean;
  requestedAtLabel: string;
  proofUrl: string | null;
};

export type AutomatedRow = {
  id: string;
  therapistName: string;
  amountCents: number;
  status: string;
  createdAtLabel: string;
};

function Go({ label, tone }: { label: string; tone?: "quiet" }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={tone === "quiet" ? "secondary" : undefined}
      disabled={pending}
      className="h-8 px-2.5 text-xs"
    >
      {pending ? "…" : label}
    </Button>
  );
}

export function PayoutQueue({
  manual,
  automated,
}: {
  manual: QueueRow[];
  automated: AutomatedRow[];
}) {
  const [tab, setTab] = useState<"manual" | "automated">("manual");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Tab active={tab === "manual"} onClick={() => setTab("manual")}>
          Manual · {manual.length} to do
        </Tab>
        <Tab active={tab === "automated"} onClick={() => setTab("automated")}>
          Automated · {automated.length} records
        </Tab>
      </div>

      {tab === "manual" ? (
        manual.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500">
            Nothing waiting. Every withdrawal has been dealt with.
          </Card>
        ) : (
          <ul className="space-y-3">
            {manual.map((row) => (
              <ManualRow key={row.id} row={row} />
            ))}
          </ul>
        )
      ) : (
        <Card className="p-4">
          <p className="text-sm text-slate-500">
            Stripe Connect payouts. These have already happened. This is a record, not a task.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {automated.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-medium text-slate-900">{row.therapistName}</span>
                <span className="text-slate-500">{formatUsd(row.amountCents)}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {row.status} · {row.createdAtLabel}
                </span>
              </li>
            ))}
            {automated.length === 0 ? (
              <li className="py-2 text-sm text-slate-400">Nothing yet.</li>
            ) : null}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600"
      }
    >
      {children}
    </button>
  );
}

function ManualRow({ row }: { row: QueueRow }) {
  const [claimState, claimAction] = useActionState(takeOn, INITIAL);
  const [approveState, approveAction] = useActionState(approve, INITIAL);
  const [sentState, sentAction] = useActionState(markSent, INITIAL);
  const [confirmState, confirmAction] = useActionState(confirm, INITIAL);
  const [rejectState, rejectAction] = useActionState(reject, INITIAL);

  const error =
    claimState.error ??
    approveState.error ??
    sentState.error ??
    confirmState.error ??
    rejectState.error;

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              row.overdue
                ? "inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                : "inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            }
          >
            {row.overdue ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
            {row.ageHours}h old
          </span>

          <span className="text-sm font-semibold text-slate-900">{row.therapistName}</span>
          <Badge>{row.status}</Badge>
          <Badge>{row.entity === "eg" ? "Egyptian entity" : "US entity"}</Badge>

          {row.needsTwoPeople ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              Two people
            </span>
          ) : null}
          {row.owned ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <UserCheck className="h-3 w-3" aria-hidden />
              Owned
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-sm text-slate-700">
          {formatUsd(row.amountCents)} →{" "}
          <span className="font-semibold">
            {formatMoney(row.payoutAmountMinor, row.payoutCurrency.toUpperCase(), "en-US")}
          </span>{" "}
          by {row.method === "instapay" ? "InstaPay" : "wallet"} to {row.identifier}
        </p>
        <p className="text-xs text-slate-500">
          Account name: {row.accountName} · requested {row.requestedAtLabel}
        </p>

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!row.owned ? (
            <form action={claimAction}>
              <input type="hidden" name="requestId" value={row.id} />
              <Go label="Take it on" tone="quiet" />
            </form>
          ) : null}

          {row.status === "requested" ? (
            <form action={approveAction}>
              <input type="hidden" name="requestId" value={row.id} />
              <Go label="Approve" />
            </form>
          ) : null}

          {row.status === "approved" ? (
            <form action={sentAction} className="flex items-end gap-2">
              <input type="hidden" name="requestId" value={row.id} />
              <Input
                name="proofUrl"
                placeholder="Link to the transfer screenshot"
                required
                className="h-8 w-64 text-xs"
              />
              <Go label="Mark sent" />
            </form>
          ) : null}

          {row.status === "sent" ? (
            <form action={confirmAction}>
              <input type="hidden" name="requestId" value={row.id} />
              <Go label="Confirm arrival" />
            </form>
          ) : null}

          {row.status !== "sent" ? (
            <form action={rejectAction} className="flex items-end gap-2">
              <input type="hidden" name="requestId" value={row.id} />
              <Input
                name="reason"
                placeholder="Why not. The clinician reads this"
                required
                className="h-8 w-64 text-xs"
              />
              <Go label="Reject" tone="quiet" />
            </form>
          ) : null}
        </div>
      </Card>
    </li>
  );
}
