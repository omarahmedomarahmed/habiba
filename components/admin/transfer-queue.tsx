"use client";

import { useState, useTransition } from "react";

import { confirm, reject } from "@/app/(admin)/admin/transfers/actions";
import { ReceiptModal } from "@/components/admin/receipt-modal";
import { Card } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { MIN_REASON } from "@/lib/admin/reason";

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
 * ## 🔴 76.57 — THE PROOF OPENS IN A MODAL, WITH THE DECISION IN IT
 *
 * It used to open in a new tab, which put the photograph on one screen and the
 * two buttons on another, and a decision taken about evidence in a different
 * window is a decision taken from memory. `ReceiptModal` shows it full size with
 * the reference, the amount and Confirm and Reject on the same surface.
 *
 * The reference stays selectable on the row as well, because an operator is
 * searching for it in a banking app before they ever open the picture.
 */
type Row = {
  id: string;
  purpose: string;
  /** What they sent, in minor units of `currency`. */
  amountCents: number;
  currency: string;
  /** 🔴 76.28 — the same figure, written out by the server. C84. */
  amountLabel: string;
  /** What it settles, in dollars, written out by the server. */
  /** What it settles, in USD cents. 0106. */
  settlesCents: number;
  reference: string | null;
  /**
   * 🔴 76.57 — WHAT KIND OF FILE, NOT WHERE IT IS.
   *
   * This was `proofUrl`, the blob address, and it was serialised into the page
   * for every row in the queue whether anybody opened one or not. Nothing
   * rendered it, so it read as harmless; it is not, because the whole argument
   * for `/admin/transfers/receipt/[id]` is that a read should pass through us
   * and be recorded, and an address in the page source is a read that never
   * needs to. The client needs two facts — is there one, and is it a PDF — and
   * neither of them is a URL.
   */
  proofKind: "image" | "pdf" | null;
  submittedAt: string | null;
  /** Minutes since it was submitted, counted on the server so both renders agree. */
  waitedMinutes?: number | null;
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
  patient: "bg-brand-100 text-brand-800",
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
      {msg.ok ? <p className="text-sm text-brand-700">{msg.ok}</p> : null}

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
  const [looking, setLooking] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const waited = row.waitedMinutes ?? null;

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
            {/*
              🔴 76.28 — FORMATTED BY THE SERVER, because an operator matches
              this against a bank statement.

              It was `(amountCents / 100).toFixed(2)`, which printed a company's
              top-up as "5700000.00 EGP". Nobody reads a seven-digit run of
              characters correctly at a glance, and the whole job on this screen
              is deciding whether a figure equals a line in a banking app.

              It cannot be fixed here: C84 bans `Intl` in a client component,
              and this is one. So the page formats it and passes the string,
              which is the same rule every other figure on this rail follows.
            */}
            {row.amountLabel}
            <span className="ms-2 text-slate-500">
              settles <Money cents={row.settlesCents} />
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
                onDone(await confirm(row.id, { amountCents: row.amountCents, settlesCents: row.settlesCents }));
              })
            }
            className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600 hover:bg-brand-400 active:bg-brand-600 disabled:opacity-40"
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
            {row.proofKind !== null ? (
              /*
                🔴 76.57 — A BUTTON, NOT A LINK, because the decision is in the
                modal it opens. The bytes still come through our own route,
                which checks the role, writes an audit row and streams them, so
                the browser never learns where the file is stored.
              */
              <button
                type="button"
                onClick={() => setLooking(true)}
                className="font-medium text-brand-700 underline"
              >
                View the evidence
              </button>
            ) : (
              <span className="text-amber-700">🔴 none uploaded</span>
            )}
          </dd>
        </div>

        {/*
          🔴 76.57 — WHAT THEY SAID IT COVERS MOVED INTO THE MODAL.

          It was here AND there, which is the same five words twice in a console
          with no room to spare, and the row is not where the question gets
          asked. An operator holding a bank line for one figure and a claim for
          the same figure only wonders which sessions it covers once they are
          looking at the receipt, and by then they are in the modal.
        */}
      </dl>

      {looking && (
        <ReceiptModal
          /*
           * 🔴 THE WAITING FIGURE IS COMPUTED HERE AND HANDED DOWN, so the row
           * and the modal cannot disagree about how long somebody has been on a
           * spinner. It is the same `waited` the row prints two lines up.
           */
          row={{ ...row, waitedLabel: waited === null ? null : `waiting ${String(waited)} min` }}
          pending={pending}
          error={modalError}
          onClose={() => {
            setLooking(false);
            setModalError(null);
          }}
          onConfirm={() =>
            start(async () => {
              const result = await confirm(row.id, { amountCents: row.amountCents, settlesCents: row.settlesCents });
              /*
               * 🔴 THE MODAL STAYS OPEN ON A FAILURE, and closes on a success.
               *
               * A confirmation that failed while the operator was looking at
               * the evidence is a thing they need to read with the evidence
               * still in front of them. Closing on both would send them back to
               * a queue where the row is still there and nothing says why.
               */
              if (result.error) setModalError(result.error);
              else {
                setLooking(false);
                setModalError(null);
              }
              onDone(result);
            })
          }
          onReject={(why) =>
            start(async () => {
              const result = await reject(row.id, why);
              if (result.error) setModalError(result.error);
              else {
                setLooking(false);
                setModalError(null);
              }
              onDone(result);
            })
          }
        />
      )}

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
            disabled={pending || reason.trim().length < MIN_REASON}
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
