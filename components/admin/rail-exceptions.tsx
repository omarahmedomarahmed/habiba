"use client";

import { useState, useTransition } from "react";

import {
  resolveTransferException,
  retryException,
} from "@/app/(admin)/admin/transfers/exception-actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Money } from "@/components/ui/money";
import type { ManualPaymentException } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

export type ExceptionRow = {
  id: string;
  payer: string;
  what: string;
  /** 🔴 A15: the bank-line figure in the payer's currency, as `OpenCarts` has it. */
  amountLabel: string;
  settlesCents: number;
  kind: ManualPaymentException;
  detail: string | null;
  raisedAt: string | null;
};

const KIND: Record<ManualPaymentException, MessageKey> = {
  grant_failed: "arail.grantFailed",
  not_payable: "arail.notPayable",
  overpaid: "arail.overpaid",
};

/**
 * 🔴 W2-A03 / A4: confirmed money that did not do its job, as work. Above the
 * open carts and below the queue: the queue is people waiting on us right
 * now, and this is money we already hold that somebody has to decide about.
 */
export function RailExceptions({ rows }: { rows: ExceptionRow[] }) {
  const t = useT();
  if (rows.length === 0) return null;

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-slate-900">{t("arail.title")}</p>
      <ul className="space-y-3">
        {rows.map((row) => (
          <ExceptionItem key={row.id} row={row} />
        ))}
      </ul>
    </Card>
  );
}

function ExceptionItem({ row }: { row: ExceptionRow }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<string | null>(null);

  return (
    <li className="space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="amber">{t(KIND[row.kind])}</Badge>
        <span className="font-semibold text-slate-900">{row.payer}</span>
        <span className="text-slate-500">{row.what}</span>
        {/*
          🔴 A15: the pounds the payer actually sent lead, because an exception
          is settled against a bank line. The dollars follow, smaller.
        */}
        <span className="font-semibold text-slate-900">{row.amountLabel}</span>
        <span className="text-xs text-slate-500">
          <Money cents={row.settlesCents} />
        </span>
        {row.raisedAt ? <span className="text-xs text-slate-400">{row.raisedAt.slice(0, 16).replace("T", " ")}</span> : null}
      </div>
      {row.detail ? <p className="text-xs text-slate-600">{row.detail}</p> : null}
      {said ? <p className="text-xs text-rose-600">{said}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {row.kind === "grant_failed" ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await retryException(row.id);
                setSaid(result.error ?? null);
              })
            }
          >
            {t("arail.retry")}
          </Button>
        ) : null}
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("arail.note")}
          className="h-9 w-72 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || note.trim().length < 10}
          onClick={() =>
            start(async () => {
              const result = await resolveTransferException(row.id, note);
              setSaid(result.error ?? null);
            })
          }
        >
          {t("arail.resolve")}
        </Button>
      </div>
    </li>
  );
}
