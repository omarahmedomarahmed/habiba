"use client";

import { useEffect, useState } from "react";

import { PayByTransfer } from "@/components/billing/pay-by-transfer";
import { useT } from "@/lib/i18n/client";
import type { PotStep } from "@/lib/billing/manual-entry";
import type { TransferFormState, TransferView, LiveState } from "@/components/billing/pay-by-transfer";

/**
 * 🔴 76.4 — ONE PAYMENT SCREEN, FOR EVERY PAYER THIS PRODUCT HAS.
 *
 * ## Why one
 *
 * A patient paying for a session, a clinician paying their bill, a clinic
 * paying for seats and a company funding a pot were four screens in four
 * layouts. They ask for the same thing in the same way from the same bank
 * account, and the only real differences are the heading and whether the payer
 * chooses the figure. Four copies meant four places to forget the tax line,
 * and the tax line had already been forgotten once.
 *
 * ## The rule this exists to hold
 *
 * **Closing it must never lose anything.** There is no processor on this rail:
 * the `manual_payments` row IS the record, and the payer's own claim is the
 * only evidence anybody checked anything. So the popup holds NO payment state
 * of its own. Every figure, the live state and the uploaded receipt arrive from
 * the server on each render. What the browser remembers is one thing — whether
 * this person had it open — and losing that is worth nothing.
 *
 * That is why reopening shows the receipt back rather than the upload form. A
 * payer who has sent money and cannot tell whether it registered sends it
 * again, and on this rail there is nothing to reverse the second one.
 *
 * ## The one payer who is different
 *
 * A company picks its own amount, so its popup re-renders when the amount
 * changes. A patient and a clinician are shown what they owe, which is read
 * from a row and is not theirs to move.
 */

export type PaymentSubject = {
  /**
   * 🔴 76.6 — THE READER'S OWN NAME, AND NEVER ANYBODY ELSE'S.
   *
   * It is `viewerName` rather than `payerName` because the rename is the rule.
   * C243 bans a payer's name from any money surface, on the reasoning that a
   * therapist's earnings screen showing who PAID reveals which employer covers
   * which patient. This popup is the one screen where a name is safe, and only
   * because of who is looking at it: the person reading it is the person
   * paying, so the name is their own.
   *
   * A prop called `payerName` invites the opposite. Somebody rendering this on
   * an operator's queue would reach for the payer on the row, and it would look
   * right. `viewerName` has one correct source at every call site, which is the
   * signed-in actor, and `verify:rail` holds the other half by refusing to let
   * this component be imported by a therapist- or admin-facing surface.
   */
  viewerName: string;
  /** "Nile Practice" / "Cairo Foundry". Null for a guest with no account. */
  orgName: string | null;
  /** "Session with Dr Mona, Tuesday 9pm" — what the money is for, in their words. */
  what: string;
};

export function PaymentPopup({
  subject,
  details,
  amountLabel,
  taxNote,
  live,
  action,
  askAmount,
  minimumLabel,
  rateLabel,
  steps,
  /** Rendered in the success state: "Join the session" / "Back to your account". */
  onwardHref,
  onwardLabel,
  /** Starts open when they arrived here to pay, rather than to read a page. */
  openInitially = false,
  /** Stable key for remembering open state. The payment's ref, never a person. */
  storageKey,
}: {
  subject: PaymentSubject;
  details: TransferView;
  amountLabel: string;
  taxNote?: string;
  live: LiveState;
  action: (prev: TransferFormState, form: FormData) => Promise<TransferFormState>;
  askAmount?: boolean;
  minimumLabel?: string;
  rateLabel?: string;
  steps?: PotStep[];
  onwardHref?: string;
  onwardLabel?: string;
  openInitially?: boolean;
  storageKey: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(openInitially);

  /*
   * 🔴 READ IN AN EFFECT, NEVER DURING RENDER.
   *
   * `localStorage` during render is a hydration mismatch, and it throws
   * outright in a private window or with site data blocked. Both are read as
   * "the payment screen is broken" by somebody holding a bank app. So the first
   * paint is always the server's answer and this only ever corrects it.
   */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(`pay:${storageKey}`) === "open") setOpen(true);
    } catch {
      /* Private window, blocked storage. The server's answer stands. */
    }
  }, [storageKey]);

  const remember = (next: boolean) => {
    setOpen(next);
    try {
      if (next) window.localStorage.setItem(`pay:${storageKey}`, "open");
      else window.localStorage.removeItem(`pay:${storageKey}`);
    } catch {
      /* Nothing to remember. The payment itself is on the server regardless. */
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => remember(true)}
        className="h-11 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white"
      >
        {live.state === "submitted" ? t("pop.track") : t("pop.open")}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/*
        🔴 CLICKING ANYWHERE OUTSIDE CLOSES IT, which is only safe because
        nothing is lost by closing. A half-typed reference is not a payment;
        the transfer either happened in their bank or it did not.
      */}
      <button
        type="button"
        aria-label={t("pop.close")}
        onClick={() => remember(false)}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={subject.what}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-slate-50 p-4 shadow-2xl sm:rounded-3xl"
      >
        {/* ------------------------------------------------ who and what -- */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-slate-900">
              {subject.what}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {subject.orgName ? `${subject.viewerName} · ${subject.orgName}` : subject.viewerName}
            </p>
          </div>
          {/*
            🔴 MINIMISE, not just close. Somebody mid-transfer who needs their
            banking app is not abandoning the payment, and the bar this leaves
            behind is how they get back to it.
          */}
          <button
            type="button"
            onClick={() => remember(false)}
            aria-label={t("pop.minimise")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600"
          >
            <span className="block h-0.5 w-4 rounded-full bg-current" />
          </button>
        </div>

        {/*
          🔴 76.5 — THE CARD SLOT. This is where the Egyptian gateway lands.

          Rendered disabled rather than omitted, for two reasons that are both
          about people rather than code. A payer who sees only a bank account
          assumes we are too small to take a card and says so to their finance
          team; a payer told it is coming waits for it. And this popup is the
          page a gateway asks to see when they ask "where would you put us" —
          an empty space with a date on it answers that question better than a
          description.

          🔴 WHAT MUST STAY TRUE WHEN IT IS SWITCHED ON. The seam is deliberate
          and narrow:

            - **The amount is never the browser's.** The transfer half already
              works this way: the form posts the CREDIT a company chose, or
              nothing at all for a payer who is told what they owe, and the
              server recomputes the tax and the total. A gateway must be handed
              a figure derived on the server from the same helpers
              (`sessionTransferMoney`, `potTopUpMoney`), never one read out of
              this component's props.
            - **No key reaches this file.** A gateway's public key belongs in a
              server-rendered iframe or a redirect, and its secret belongs in
              `lib/env.ts` beside the others, which is why this slot holds no
              configuration of its own.
            - **One live claim per thing being paid for**, which the partial
              unique index on `manual_payments` already enforces. A card
              authorisation racing a bank transfer for the same session must
              lose to the index rather than to a check somebody remembered.
            - **The tax is the same number on both rails.** `country_settings`
              is the one source, and a gateway that computes its own VAT is a
              second opinion about what a patient was charged.
        */}
        {details.cardsComingSoon ? (
          <div className="mb-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-center">
            <p className="text-sm font-semibold text-slate-500">{t("transfer.cardsSoon")}</p>
          </div>
        ) : null}

        <PayByTransfer
          hideCardsSoon
          details={details}
          amountLabel={amountLabel}
          taxNote={taxNote}
          what={subject.what}
          live={live}
          action={action}
          askAmount={askAmount}
          minimumLabel={minimumLabel}
          rateLabel={rateLabel}
          steps={steps}
        />

        {/*
          🔴 THE WAY ONWARD, ONLY ONCE THERE IS SOMEWHERE TO GO.
          A patient whose session is paid wants the room; a clinician or a
          company wants their account back. Rendered by the caller's `live`
          state rather than guessed here.
        */}
        {onwardHref && onwardLabel ? (
          <a
            href={onwardHref}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white"
          >
            {onwardLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
