"use client";

import { useState, useTransition } from "react";

import { confirm, reject } from "@/app/(admin)/admin/transfers/actions";
import { Card } from "@/components/ui";
import { Money } from "@/components/ui/money";

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
  /**
   * 🔴 76.11 — WHICH KIND OF PAYER, so one queue can be worked four ways.
   *
   * An operator clearing a morning's transfers is not doing one job. A
   * patient's session is unblocking somebody sitting on a waiting screen; a
   * company's pot is a finance department that will chase by email; a
   * practice's bill decides whether a clinician is metered tomorrow. The
   * urgency and the checks differ, and a single undifferentiated list made an
   * operator re-derive the kind from the amount and the wording.
   */
  payerType: "patient" | "therapist" | "clinic" | "company";
  /** Their page on the admin side. Null where the payer has no account at all. */
  profileHref: string | null;
  /**
   * 🔴 76.16 — WHAT THE PAYER SAID THIS COVERS, in their own list.
   *
   * An operator holding a bank line for one figure and a claim for the same
   * figure still has a question when the claim is a part payment: a clinician
   * who owes $44 and transferred $32 looks like an underpayment until you can
   * see which four sessions they chose. This is that list, frozen when they
   * opened the sheet, so it describes the transfer rather than the account.
   *
   * Empty for a payment with one subject, which is most of them.
   */
  lines: { label: string; cents: number }[];
};

const PAYER_LABEL: Record<Row["payerType"], string> = {
  patient: "Patient",
  therapist: "Therapist",
  clinic: "Clinic",
  company: "Company",
};

const PAYER_TONE: Record<Row["payerType"], string> = {
  patient: "bg-teal-100 text-teal-800",
  therapist: "bg-indigo-100 text-indigo-800",
  clinic: "bg-violet-100 text-violet-800",
  company: "bg-amber-100 text-amber-900",
};

const TABS = ["all", "patient", "therapist", "clinic", "company"] as const;

const WHAT: Record<string, string> = {
  session: "A session",
  payg_session: "A session, pay as you go",
  subscription: "A subscription",
  pot_topup: "A pot top-up",
};

export function TransferQueue({ rows }: { rows: Row[] }) {
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");

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

  const shown = tab === "all" ? rows : rows.filter((r) => r.payerType === tab);

  return (
    <div className="space-y-3">
      {msg.error ? <p className="text-sm text-rose-600">{msg.error}</p> : null}
      {msg.ok ? <p className="text-sm text-teal-700">{msg.ok}</p> : null}

      {/*
        🔴 76.11 — ONE PAGE, FOUR VIEWS, AND "ALL" IS THE DEFAULT.

        Separate pages per payer would mean an operator has to remember to
        check four of them, and the one they forget is the one with somebody
        waiting on it. So the whole queue is here and the tabs narrow it, with
        the count on each tab because a tab showing zero is worth not clicking.
      */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((name) => {
          const count = name === "all" ? rows.length : rows.filter((r) => r.payerType === name).length;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={
                tab === name
                  ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              }
            >
              {name === "all" ? "All" : PAYER_LABEL[name]} {count}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        {shown.length} waiting, oldest first. Somebody is on a spinner for each.
      </p>

      {shown.map((row) => (
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
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PAYER_TONE[row.payerType]}`}
            >
              {PAYER_LABEL[row.payerType]}
            </span>
            <p className="text-sm font-semibold text-slate-900">
              {/*
                🔴 76.11 — THE NAME IS THE WAY IN TO THE REST OF THE STORY.

                An operator looking at a transfer that does not match usually
                needs the payer's history, not this row: has this company
                topped up before, is this clinician on a plan, did this patient
                already pay for the session. That was a search box away and is
                now a click. Plain text where there is no page to go to, which
                is a guest paying for a session with no account at all.
              */}
              {row.profileHref ? (
                <a href={row.profileHref} className="underline decoration-slate-300 underline-offset-4">
                  {row.payer}
                </a>
              ) : (
                row.payer
              )}{" "}
              · {WHAT[row.purpose] ?? row.purpose}
            </p>
          </div>
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

        {/*
          🔴 76.16 — WHAT THEY SAID IT COVERS, beside the reference rather than
          under it. A part payment is the case this answers: without the list, a
          clinician who owes more than they sent reads as an underpayment.
        */}
        {row.lines.length > 0 ? (
          <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
            <dt className="text-xs text-slate-500">What they said it covers</dt>
            <dd className="mt-1 space-y-0.5">
              {row.lines.map((line, i) => (
                <p
                  key={`${line.label}-${i}`}
                  className="flex items-baseline justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 truncate text-slate-600">{line.label}</span>
                  <span className="shrink-0 text-slate-900 tabular-nums">
                    <Money cents={line.cents} />
                  </span>
                </p>
              ))}
            </dd>
          </div>
        ) : null}
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
