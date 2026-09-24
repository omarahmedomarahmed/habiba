"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldAlert, UserCheck } from "lucide-react";

import {
  cancelRefundAction,
  confirmRefundAction,
  markRefundSentAction,
  returnPotShareAction,
  takeOnRefund,
  type RefundState,
} from "@/app/(admin)/admin/payouts/refund-actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import { formatMoney } from "@/lib/billing/plans";
import { useT } from "@/lib/i18n/client";

const INITIAL: RefundState = {};

/**
 * 🔴 W1-28a: refunds we owe on the manual rail, as their own section of the
 * payout console and in the same shape as its manual queue: take it on, mark
 * sent with the receipt (the ledger reversal posts then, once), confirm
 * arrival, or cancel with a reason. Money facts only, never session content.
 */
export type RefundQueueItem = {
  id: string;
  amountCents: number;
  currency: string;
  payeeName: string | null;
  status: string;
  why: "no_show" | "clinician_cancel" | "pot_share" | "other";
  owned: boolean;
  needsTwoPeople: boolean;
  openedLabel: string;
  proofUrl: string | null;
};

function Go({ label, quiet }: { label: string; quiet?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={quiet ? "secondary" : undefined}
      disabled={pending}
      className="h-8 px-2.5 text-xs"
    >
      {pending ? "…" : label}
    </Button>
  );
}

export function RefundQueue({ rows }: { rows: RefundQueueItem[] }) {
  const t = useT();
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        {t("arefund.title")} · {rows.length}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("arefund.none")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <RefundRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function RefundRow({ row }: { row: RefundQueueItem }) {
  const t = useT();
  const [claimState, claimAction] = useActionState(takeOnRefund, INITIAL);
  const [sentState, sentAction] = useActionState(markRefundSentAction, INITIAL);
  const [confirmState, confirmAction] = useActionState(confirmRefundAction, INITIAL);
  const [cancelState, cancelAction] = useActionState(cancelRefundAction, INITIAL);
  const [potState, potAction] = useActionState(returnPotShareAction, INITIAL);
  const error =
    claimState.error ?? sentState.error ?? confirmState.error ?? cancelState.error ?? potState.error;

  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">
          {formatMoney(row.amountCents, row.currency.toUpperCase(), "en-US")}
        </span>
        <span className="text-sm text-slate-700">{row.payeeName ?? ""}</span>
        <Badge>{row.status}</Badge>
        {row.why !== "other" ? (
          <Badge>
            {t(
              row.why === "no_show"
                ? "arefund.whyNoShow"
                : row.why === "pot_share"
                  ? "arefund.whyPot"
                  : "arefund.whyCancel",
            )}
          </Badge>
        ) : null}
        {row.needsTwoPeople ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
            <ShieldAlert className="h-3 w-3" aria-hidden />
            {t("arefund.twoPeople")}
          </span>
        ) : null}
        {row.owned ? <UserCheck className="h-3 w-3 text-slate-500" aria-hidden /> : null}
        <span className="ml-auto text-xs text-slate-500">{row.openedLabel}</span>
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {row.status === "owed" && !row.owned ? (
          <form action={claimAction}>
            <input type="hidden" name="requestId" value={row.id} />
            <Go label={t("arefund.takeOn")} quiet />
          </form>
        ) : null}

        {row.status === "owed" && row.why === "pot_share" ? (
          <form action={potAction}>
            <input type="hidden" name="requestId" value={row.id} />
            <Go label={t("arefund.returnPot")} />
          </form>
        ) : null}

        {row.status === "owed" && row.why !== "pot_share" ? (
          <form action={sentAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="requestId" value={row.id} />
            <Input name="method" placeholder={t("arefund.method")} required className="h-8 w-28 text-xs" />
            <Input name="identifier" placeholder={t("arefund.identifier")} required className="h-8 w-40 text-xs" />
            <Input name="accountName" placeholder={t("arefund.accountName")} required className="h-8 w-40 text-xs" />
            <Input name="proofUrl" placeholder={t("arefund.proof")} required className="h-8 w-48 text-xs" />
            <Go label={t("arefund.markSent")} />
          </form>
        ) : null}

        {row.status === "sent" ? (
          <form action={confirmAction}>
            <input type="hidden" name="requestId" value={row.id} />
            <Go label={t("arefund.confirm")} />
          </form>
        ) : null}

        {row.status === "owed" ? (
          <form action={cancelAction} className="flex items-end gap-2">
            <input type="hidden" name="requestId" value={row.id} />
            <Input name="reason" placeholder={t("arefund.cancelWhy")} required className="h-8 w-48 text-xs" />
            <Go label={t("arefund.cancel")} quiet />
          </form>
        ) : null}
      </div>
    </li>
  );
}
