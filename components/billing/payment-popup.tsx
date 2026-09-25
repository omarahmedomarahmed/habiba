"use client";

import { useEffect, useState } from "react";

import { PayByTransfer } from "@/components/billing/pay-by-transfer";
import { useT } from "@/lib/i18n/client";
import type { PotStep } from "@/lib/billing/manual-entry";
import type {
  TransferFormState,
  TransferView,
  LiveState,
  PaymentLineView,
} from "@/components/billing/pay-by-transfer";

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
  /**
   * 🔴 76.10 — WHO IS PAYING, SAID ON THE SCREEN.
   *
   * The same component serves four payers and the bank details underneath are
   * identical for all of them. That is the right implementation and the wrong
   * experience: a clinic manager and a company's finance officer both arrive at
   * a white sheet with an IBAN on it, and neither can tell at a glance that it
   * is the RIGHT sheet — whether they are paying the practice's bill or their
   * employer's pot.
   *
   * So the sheet names itself. It is also what a payments operator needs when
   * somebody sends a screenshot of this screen asking why the amount is wrong.
   */
  payerType: "patient" | "therapist" | "clinic" | "company";
};

export function PaymentPopup({
  subject,
  details,
  amountLabel,
  taxNote,
  live,
  action,
  askAmount,
  minimumCents,
  rateLabel,
  steps,
  lines,
  /** Rendered in the success state: "Join the session" / "Back to your account". */
  onwardHref,
  onwardLabel,
  /**
   * 🔴 76.9 — HOW THE MINIMISED STATE LOOKS, and it is not a style choice.
   *
   * `"button"` is a full-width control in the page's flow, which is right on a
   * screen somebody opened in order to pay: the bill IS the page.
   *
   * `"orb"` is a small floating circle, and it is right for a patient. A
   * patient minimising a payment is going back to the app to do something
   * else, and a bar across the top of their screen would follow them into a
   * session. It sits where the SOS orb sits, a size down and in the platform's
   * own colour rather than red, because red on a patient's screen already
   * means one thing and it is not money.
   */
  minimised = "button",
  /** Starts open when they arrived here to pay, rather than to read a page. */
  openInitially = false,
  /**
   * 🔴 76.13 — CALLED WHEN THE SHEET OPENS, and it writes a row on the server.
   *
   * The whole rail rests on the middle state being durable, and it used to
   * become durable one step too late: the row existed from the moment somebody
   * pressed Submit, so the commonest real sequence left no record at all. A
   * payer opens the sheet, reads the account number, switches to their banking
   * app, sends the money, and closes the browser. They have paid us and there
   * is no claim.
   *
   * Opening is the signal. The bar in their portal is then a route back to this
   * screen, and finishing it is one tap rather than a memory of which page it
   * was on.
   */
  onOpen,
  /**
   * 🔴 76.34 — THE WAY OUT THAT IS NOT PAYING, and it was missing entirely.
   *
   * Opening the sheet writes an `awaiting_proof` row, which is right: it is the
   * record of somebody who went to their banking app, and the red bar it puts
   * across their portal is how they get back here. But a payer who reads the
   * account number and decides not to send it had no way to clear that bar, so
   * their only two exits were paying or learning to ignore a warning bar. A
   * person who learns to ignore this one ignores the next one too.
   *
   * 🔴 IT IS ABSENT ONCE PROOF IS IN. From that moment the payment is a claim
   * about money that belongs to an operator, and a control that removed it from
   * the queue would be a way to make a transfer vanish from the only record
   * this rail has. The server refuses it as well: `cancelCart` has the state in
   * its WHERE clause.
   */
  onCancel,
  onChoose,
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
  minimumCents?: number;
  rateLabel?: string;
  steps?: PotStep[];
  /** 🔴 76.16 — what the total covers. Server-formatted, empty where obvious. */
  lines?: PaymentLineView[];
  onwardHref?: string;
  onwardLabel?: string;
  onOpen?: () => Promise<void>;
  onCancel?: () => Promise<void>;
  onChoose?: (creditCents: number) => Promise<void>;
  minimised?: "button" | "orb";
  openInitially?: boolean;
  storageKey: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(openInitially);
  /* Two taps to cancel, because the first one is easy to hit by accident. */
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  /*
   * 🔴 READ IN AN EFFECT, NEVER DURING RENDER.
   *
   * `localStorage` during render is a hydration mismatch, and it throws
   * outright in a private window or with site data blocked. Both are read as
   * "the payment screen is broken" by somebody holding a bank app. So the first
   * paint is always the server's answer and this only ever corrects it.
   */
  /*
   * 🔴 B46 — AND READ ONCE. The key is the bar's request to open the sheet on
   * the page it navigates to, so it is spent here. It used to stay set from the
   * first press, and the sheet then reopened over the page on every load, with
   * the Pay now button nowhere to be seen.
   */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(`pay:${storageKey}`) === "open") {
        window.localStorage.removeItem(`pay:${storageKey}`);
        setOpen(true);
      }
    } catch {
      /* Private window, blocked storage. The server's answer stands. */
    }
  }, [storageKey]);

  /*
   * 🔴 AND WHEN IT RENDERS ALREADY OPEN, which is how a patient always meets
   * it: they followed a link whose whole purpose was to pay, so there is no
   * tap to hang the write off. Runs once per mount.
   */
  useEffect(() => {
    if (openInitially) void onOpen?.().catch(() => undefined);
  }, []);

  const remember = (next: boolean) => {
    setOpen(next);
    /*
     * Fire and forget, deliberately. The sheet must appear the instant it is
     * tapped: somebody holding a banking app should never wait on a round trip
     * to read an account number, and a failure here costs the bar rather than
     * the payment, which they can still complete from this very screen.
     */
    if (next) void onOpen?.().catch(() => undefined);
    try {
      if (!next) window.localStorage.removeItem(`pay:${storageKey}`);
    } catch {
      /* Nothing to remember. The payment itself is on the server regardless. */
    }
  };

  /*
   * Escape minimises, as the button does (live walkthrough: a keyboard user
   * had no way out of the sheet but a control they could not see).
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") remember(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /*
   * 🔴 76.37 — ONE CONTROL, DECLARED ONCE, RENDERED ON THE ENTRY.
   *
   * It is absent the moment proof is in. From then the payment is a claim about
   * money that belongs to an operator, and a button that removed it from the
   * queue would be a way to make a transfer vanish from the only record this
   * rail has. The server refuses it too: `cancelCart` has the state in its
   * WHERE clause, so this is the second lock rather than the only one.
   */
  const cancelControl =
    onCancel && (live.state === "none" || live.state === "awaiting_proof") ? (
      confirmingCancel ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">{t("pop.cancelSure")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{t("pop.cancelSureBody")}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={cancelling}
              onClick={() => {
                setCancelling(true);
                void onCancel()
                  .then(() => {
                    /*
                     * 🔴 FORGET THE SHEET TOO. The row is gone on the server;
                     * a browser still holding `pay:<key>` would re-open an
                     * empty sheet on the next page load and look like the
                     * cancel had not worked.
                     */
                    try {
                      window.localStorage.removeItem(`pay:${storageKey}`);
                    } catch {
                      /* Nothing remembered, nothing to forget. */
                    }
                    setOpen(false);
                  })
                  .finally(() => {
                    setCancelling(false);
                    setConfirmingCancel(false);
                  });
              }}
              className="h-10 flex-1 rounded-xl bg-amber-600 text-sm font-semibold text-white disabled:opacity-40"
            >
              {cancelling ? t("common.saving") : t("pop.cancelYes")}
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={() => setConfirmingCancel(false)}
              className="h-10 flex-1 rounded-xl bg-white text-sm font-semibold text-slate-700"
            >
              {t("pop.cancelNo")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          className="h-10 w-full rounded-xl bg-slate-100 text-sm font-semibold text-slate-600"
        >
          {t("pop.cancel")}
        </button>
      )
    ) : null;

  if (!open) {
    const label = live.state === "submitted" ? t("pop.track") : t("pop.open");

    if (minimised === "orb") {
      return (
        <button
          type="button"
          onClick={() => remember(true)}
          aria-label={label}
          /*
           * 🔴 BELOW the SOS orb's z-index, deliberately and permanently.
           *
           * They can both be on screen, and if they ever overlap the crisis
           * button is the one that must be on top. C235's rule is that the
           * patient's crisis path never depends on money; a payment reminder
           * covering it would be that rule broken by a stacking context.
           */
          className="fixed end-3 bottom-24 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-navy-600 shadow-lg"
        >
          {/* A banknote, drawn rather than typed, so no font decides its size. */}
          <span aria-hidden className="block h-4 w-6 rounded-[3px] border-2 border-current" />
          {live.state === "submitted" ? (
            <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400" />
          ) : null}
        </button>
      );
    }

    /*
      🔴 76.37 — AND THE WAY OUT SITS BESIDE THE WAY IN, not inside the sheet.
      ---------------------------------------------------------------------
      It was under the form in the open sheet. That is the one place somebody
      who has decided NOT to pay will never look: they closed it. So the bar at
      the top of their portal kept saying they owed us something, the only
      control that could clear it was behind a sheet they had shut, and their
      two exits were paying or learning to ignore a warning bar.

      It is on the entry now. The pay button and the cancel sit together,
      because "I am going to do this" and "I am not going to do this" are the
      two answers to the same question and they belong in the same place.
    */
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => remember(true)}
          className="h-11 w-full rounded-xl bg-brand-500 text-sm font-semibold text-navy-600"
        >
          {label}
        </button>
        {cancelControl}
      </div>
    );
  }

  return (
    /*
      🔴 76.9 — THE SHEET STOPS ABOVE THE BOTTOM NAV, it does not cover it.
      A payer who has minimised in their head but not on the screen still needs
      to leave, and a modal over the tab bar makes the way out the one control
      that is hidden. `pb-20` on mobile clears it; from `sm` up the nav is a
      sidebar and the sheet centres normally.
    */
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-20 sm:items-center sm:pb-0">
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
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {t(`pop.for.${subject.payerType}` as "pop.for.patient")}
            </p>
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
          minimumCents={minimumCents}
          rateLabel={rateLabel}
          steps={steps}
          lines={lines}
          onChoose={onChoose}
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
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-navy-600"
          >
            {onwardLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
