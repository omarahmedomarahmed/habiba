"use client";

import { useEffect, useRef, useState } from "react";

import { Money } from "@/components/ui/money";
import { MIN_REASON } from "@/lib/admin/reason";

/**
 * 🔴 76.57 — THE EVIDENCE, FULL SIZE, WITH THE DECISION IN THE SAME FRAME.
 *
 * ## What was here before, and why it was not enough
 *
 * A link. `Open the receipt` opened a new tab, the tab 302'd to a blob, and the
 * operator was now looking at a photograph in a browser tab with no reference,
 * no amount, no payer and no buttons. To decide they had to go back to the
 * queue, find the row again, and remember what the photograph said.
 *
 * **A decision made in one window about evidence in another is a decision made
 * from memory.** The commonest way a manual payment queue goes wrong is a row
 * approved against the receipt above it, and the way you get that is by making
 * somebody hold two things in their head.
 *
 * So: the photograph fills the screen, the reference and the amount sit under
 * it where they can be compared to what is IN it, and Confirm and Reject are on
 * the same surface. Nothing about the decision happens anywhere else.
 *
 * ## 🔴 REJECT STILL DEMANDS A SENTENCE, and the demand moved here with it
 *
 * The queue row's rule was that the button does nothing until a reason is
 * typed, because a rejection is a person who believes they paid us. That rule
 * is not weakened by the decision moving into a modal; it is repeated here, on
 * the same textarea, with the same warning that they read it word for word.
 *
 * ## 🔴 THE IMAGE IS NOT THE BLOB
 *
 * `src` is our own route, which checks `requireStaff`, writes an audit row and
 * streams the bytes. The browser never learns the storage address, so there is
 * no URL to copy out and open again unaudited. The download button is the same
 * route with `?download=1`, which is recorded as a different act, because a
 * copy that leaves the building is not the same as a look.
 *
 * ## C84
 *
 * No `toLocaleString`, no `Intl`. The amount comes through `Money`; everything
 * else is a string the server wrote.
 */

export type ReceiptSubject = {
  id: string;
  payer: string;
  purpose: string;
  /** B57: what it is for, in words. The raw purpose is a code and never shown. */
  purposeLabel: string;
  reference: string | null;
  /** What they sent, written out by the server. */
  amountLabel: string;
  /** What it settles, in USD cents, for `Money`. */
  settlesCents: number;
  /**
   * 🔴 76.57 — HOW LONG THEY HAVE BEEN WAITING, WRITTEN OUT BY THE SERVER.
   *
   * This was the raw `submittedAt` ISO string, and the modal rendered
   * "submitted 2026-09-18T18:28:34.939Z" under the heading. Nobody reads that,
   * and the one thing the operator actually wants from it — has this person
   * been on a spinner for forty minutes — was the one thing it did not say. The
   * queue row beside it already showed "waiting 1 min", so the modal was the
   * less readable of two views of the same fact.
   *
   * C84: the server writes the sentence, because this file may not touch `Intl`.
   */
  waitedLabel: string | null;
  /** `image`, `pdf`, or null when nothing was uploaded. */
  proofKind: "image" | "pdf" | null;
  lines: { label: string; cents: number }[];
};

export function ReceiptModal({
  row,
  onClose,
  onConfirm,
  onReject,
  pending,
  error,
}: {
  row: ReceiptSubject;
  onClose: () => void;
  onConfirm: () => void;
  onReject: (reason: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [broken, setBroken] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const src = `/admin/transfers/receipt/${row.id}`;

  /*
   * 🔴 ESCAPE CLOSES IT, AND FOCUS LANDS INSIDE IT.
   *
   * An operator works this queue with a banking app on a second screen and a
   * keyboard, not a mouse. A modal that can only be dismissed by finding a
   * small cross is a modal that gets left open over the row underneath.
   */
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`What ${row.payer} sent us: ${row.purposeLabel}`}
      /*
       * Clicking the backdrop closes; clicking the panel must not. The check on
       * the target is what stops a drag that ends outside the panel from
       * throwing away a half-typed rejection reason.
       */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-4 w-full max-w-4xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              What {row.payer} sent us
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {row.purposeLabel}
              {row.waitedLabel ? `, ${row.waitedLabel}` : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="h-10 shrink-0 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
          >
            Close
          </button>
        </div>

        {/* ------------------------------------------------ the evidence -- */}
        <div className="bg-slate-100 p-3">
          {row.proofKind === null ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              🔴 <strong>Nothing was uploaded.</strong> Nothing here to check the bank line
              against.
            </p>
          ) : broken ? (
            <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">
              🔴 <strong>The receipt is missing from the store.</strong> Do not confirm
              without it.
            </p>
          ) : row.proofKind === "pdf" ? (
            <object
              data={src}
              type="application/pdf"
              className="h-[55vh] w-full rounded-xl bg-white"
              aria-label="The receipt, as a PDF"
            >
              <p className="p-4 text-sm text-slate-700">
                This browser will not display the PDF.{" "}
                <a href={`${src}?download=1`} className="font-medium text-brand-700 underline">
                  Download it instead
                </a>
                .
              </p>
            </object>
          ) : (
            /*
             * 🔴 `max-h-[55vh]` AND `object-contain`, never a fixed height.
             *
             * These are photographs taken on a phone, so they arrive portrait,
             * landscape and occasionally rotated. A box that crops is a box that
             * cuts the amount off the bottom of somebody's banking app, and the
             * operator would never know it had.
             *
             * 🔴 AND 55, NOT 70, WHICH THE SCREENSHOT DECIDED. At 70 the picture
             * filled a laptop screen and pushed "Reference they gave" below the
             * fold, so an operator comparing the reference in the photograph
             * with the reference we were given had to scroll between them —
             * which is the exact thing this modal was built to stop. The whole
             * argument is one frame, and a frame you scroll is two.
             */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`The receipt ${row.payer} uploaded`}
              onError={() => setBroken(true)}
              className="mx-auto max-h-[55vh] w-auto max-w-full rounded-xl bg-white object-contain"
            />
          )}
        </div>

        {/* ------------------------------------- what it is meant to be -- */}
        <dl className="grid gap-2 p-4 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Reference they gave</dt>
            <dd className="mt-0.5 font-mono text-sm break-all text-slate-900 select-all">
              {row.reference || "none"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">What they say they sent</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">{row.amountLabel}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">What it settles</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">
              <Money cents={row.settlesCents} />
            </dd>
          </div>

          {row.lines.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3 sm:col-span-3">
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
          )}
        </dl>

        {/* ------------------------------------------------ the decision -- */}
        <div className="border-t border-slate-200 p-4">
          {error && (
            <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>
          )}

          {rejecting ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <label htmlFor={`modal-why-${row.id}`} className="text-xs font-medium text-rose-900">
                Why. They read this word for word.
              </label>
              <textarea
                id={`modal-why-${row.id}`}
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full rounded-xl border border-rose-200 p-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || reason.trim().length < MIN_REASON}
                  onClick={() => onReject(reason.trim())}
                  className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Reject with this reason
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setRejecting(false)}
                  className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600 hover:bg-brand-400 active:bg-brand-600 disabled:opacity-40"
              >
                {pending ? "Working" : "Approve this payment"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setRejecting(true)}
                className="h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                Reject
              </button>

              {row.proofKind !== null && (
                <a
                  href={`${src}?download=1`}
                  className="ms-auto h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 ring-inset leading-10"
                >
                  Download the evidence
                </a>
              )}
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Both are audited, with your name.
          </p>
        </div>
      </div>
    </div>
  );
}
