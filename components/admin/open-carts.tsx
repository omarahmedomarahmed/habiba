"use client";

import { useState, useTransition } from "react";

import { confirmUnclaimed } from "@/app/(admin)/admin/transfers/actions";
import { Card } from "@/components/ui";
import { Money } from "@/components/ui/money";

/**
 * 🔴 76.15 — PAYMENTS SOMEBODY OPENED AND NEVER SUBMITTED.
 *
 * ## What an operator uses this for
 *
 * Money arrives in our bank as a line with a name on it. Usually a claim is
 * waiting in the queue above and the two match. Sometimes there is no claim at
 * all, because the payer opened the sheet, read the account number, sent the
 * money from their banking app and never came back.
 *
 * Before the cart existed there was nothing to look at. Now there is a row that
 * usually carries the amount and the payer, and this is the list an operator
 * searches when a bank line will not match anything.
 *
 * ## 🔴 IT IS NOT A QUEUE, AND IT IS BUILT SO IT CANNOT BE WORKED LIKE ONE
 *
 * Nobody in this list has claimed anything, and most of them never paid: an
 * open payment is created by reading an account number. A list with a Confirm
 * button beside every row would be a screen for inventing payments.
 *
 * So it is collapsed by default, it says how many, and the only act on a row is
 * behind a disclosure that demands a written reason first. That reason stays on
 * the payment for ever, which is the point: every later screen showing this
 * money also shows that nobody ever proved it arrived.
 */
export type CartRow = {
  id: string;
  payer: string;
  payerType: "patient" | "therapist" | "clinic" | "company";
  what: string;
  settlesCents: number;
  openedAt: string | null;
};

export function OpenCarts({ rows }: { rows: CartRow[] }) {
  const [shown, setShown] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-start"
      >
        <span className="text-sm font-semibold text-slate-800">
          {rows.length} opened and never submitted
        </span>
        <span className="text-xs text-slate-500">{shown ? "Hide" : "Look"}</span>
      </button>

      {shown ? (
        <>
          <p className="px-1 text-xs leading-relaxed text-slate-500">
            {/*
              🔴 The warning is the first thing, not a footnote. Somebody
              arriving here is holding an unmatched bank line and is looking for
              a reason to press a button.
            */}
            Opening a payment only means somebody read our account number. Match a bank line
            you already have, never invent one.
          </p>

          {msg.error ? <p className="px-1 text-sm text-rose-600">{msg.error}</p> : null}
          {msg.ok ? <p className="px-1 text-sm text-brand-700">{msg.ok}</p> : null}

          <Card className="divide-y divide-slate-100">
            {rows.map((row) => (
              <CartItem key={row.id} row={row} onDone={setMsg} />
            ))}
          </Card>
        </>
      ) : null}
    </section>
  );
}

function CartItem({
  row,
  onDone,
}: {
  row: CartRow;
  onDone: (m: { error?: string; ok?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {row.payer} · {row.what}
          </p>
          <p className="text-xs text-slate-500">
            {row.payerType} · opened {row.openedAt?.slice(0, 10) ?? "recently"}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-900">
          <Money cents={row.settlesCents} />
        </p>
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`why-${row.id}`}>
            What you saw in the bank. Stays on the payment.
          </label>
          <textarea
            id={`why-${row.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              /*
                🔴 Disabled until there is a sentence, the same rule the
                rejection panel follows. An override with no reason is
                indistinguishable from a mistake.
              */
              disabled={pending || reason.trim().length < 10}
              onClick={() =>
                start(async () => {
                  const result = await confirmUnclaimed(row.id, reason);
                  onDone(result);
                  if (result.ok) setOpen(false);
                })
              }
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {pending ? "Crediting…" : "Credit without proof"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-xs font-medium text-slate-500 underline"
        >
          I have this in the bank
        </button>
      )}
    </div>
  );
}
