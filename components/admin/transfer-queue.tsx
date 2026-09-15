"use client";

import { useState, useTransition } from "react";

import { confirm, reject } from "@/app/(admin)/admin/transfers/actions";
import { Card } from "@/components/ui";

/**
 * The queue an operator works, by the minute.
 *
 * ## 🔴 REJECT NEEDS A REASON BEFORE THE BUTTON DOES ANYTHING
 *
 * Not a confirm dialog afterwards, not a reason typed into a follow-up email.
 * The textarea is on the row and the button is disabled until it has a sentence
 * in it, because a rejection is a person who believes they paid us, and
 * "rejected" with no explanation guarantees a support ticket and loses the trust
 * the whole rail runs on.
 *
 * ## 🔴 THE PROOF OPENS IN A NEW TAB, and the reference is selectable
 *
 * An operator is checking this against a banking app on a second screen. The two
 * things they need are the reference to search for and the receipt to look at,
 * so both are one interaction away and neither is truncated.
 */
type Row = {
  id: string;
  purpose: string;
  /** What they sent, in minor units of `currency`. */
  amountCents: number;
  currency: string;
  /** What it settles, in USD cents. 0106. */
  settlesCents: number;
  reference: string | null;
  proofUrl: string | null;
  submittedAt: string | null;
  payer: string;
};

const WHAT: Record<string, string> = {
  session: "A session",
  payg_session: "A session, pay as you go",
  subscription: "A subscription",
  pot_topup: "A pot top-up",
};

export function TransferQueue({ rows }: { rows: Row[] }) {
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  if (rows.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-semibold text-slate-900">Nothing waiting</p>
        <p className="mt-1 text-sm text-slate-500">
          They appear the moment somebody says they have sent one.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {msg.error ? <p className="text-sm text-rose-600">{msg.error}</p> : null}
      {msg.ok ? <p className="text-sm text-teal-700">{msg.ok}</p> : null}

      <p className="text-xs text-slate-500">
        {rows.length} waiting, oldest first. Somebody is on a spinner for each.
      </p>

      {rows.map((row) => (
        <TransferRow key={row.id} row={row} onDone={setMsg} />
      ))}
    </div>
  );
}

function TransferRow({
  row,
  onDone,
}: {
  row: Row;
  onDone: (m: { error?: string; ok?: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [pending, start] = useTransition();

  const waited = row.submittedAt
    ? Math.round((Date.now() - new Date(row.submittedAt).getTime()) / 60000)
    : null;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {row.payer} · {WHAT[row.purpose] ?? row.purpose}
          </p>
          {/*
            🔴 THE NUMBER THEY SENT FIRST, BECAUSE THAT IS WHAT THE STATEMENT SAYS.
            The operator is matching a line in a banking app, and that line is in
            pounds. What it settles is beside it in grey: it is what we will
            credit, and it is the one number the payer never saw.
          */}
          <p className="mt-0.5 text-sm text-slate-600">
            {(row.amountCents / 100).toFixed(2)} {row.currency}
            <span className="ms-2 text-slate-400">
              settles ${(row.settlesCents / 100).toFixed(2)}
            </span>
            {waited !== null ? (
              <span className={waited > 15 ? "ms-2 font-semibold text-rose-600" : "ms-2 text-slate-500"}>
                waiting {waited} min
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                onDone(await confirm(row.id));
              })
            }
            className="h-10 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            Confirm
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting((r) => !r)}
            className="h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Reference they gave</dt>
          <dd className="mt-0.5 font-mono text-sm break-all text-slate-900 select-all">
            {row.reference || "none"}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Proof</dt>
          <dd className="mt-0.5 text-sm">
            {row.proofUrl ? (
              /*
                🔴 75.2 — through our own route, which audits the read and then
                redirects. A link straight to the blob is a read nobody can
                account for afterwards, and this is a photograph of somebody's
                banking app.
              */
              <a
                href={`/admin/transfers/receipt/${row.id}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-600 underline"
              >
                Open the receipt
              </a>
            ) : (
              <span className="text-slate-500">none uploaded</span>
            )}
          </dd>
        </div>
      </dl>

      {rejecting ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <label htmlFor={`why-${row.id}`} className="text-xs font-medium text-rose-900">
            Why. They read this word for word.
          </label>
          <textarea
            id={`why-${row.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="No transfer found with that reference. Check it and send again."
            className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || reason.trim().length < 10}
            onClick={() =>
              start(async () => {
                onDone(await reject(row.id, reason));
                setRejecting(false);
              })
            }
            className="mt-2 h-9 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Reject and tell them
          </button>
        </div>
      ) : null}
    </Card>
  );
}
