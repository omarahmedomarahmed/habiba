"use client";

import { useEffect, useState } from "react";

import { PaymentPopup, type PaymentSubject } from "@/components/billing/payment-popup";
import { Money } from "@/components/ui/money";
import { useT } from "@/lib/i18n/client";
import type {
  LiveState,
  PaymentLineView,
  TransferFormState,
  TransferView,
} from "@/components/billing/pay-by-transfer";

/**
 * 🔴 76.16 — A CLINICIAN PICKS WHICH INVOICES THIS TRANSFER COVERS.
 *
 * ## What was wrong with one button
 *
 * A pay-as-you-go clinician accrues one invoice per session, so eleven sessions
 * is eleven rows and the rail's only control said pay all of it. The month they
 * actually have is three disputed and eight due today, and the product's answer
 * to that was pay nothing. Egypt is the market where that matters most, because
 * a transfer is not a card: there is no partial capture and no one-tap retry.
 *
 * ## 🔴 THE BROWSER PICKS. IT DOES NOT PRICE.
 *
 * This component holds a set of ids and nothing else. Every figure on the screen
 * arrives from the server already written out — the total in pounds, each line
 * in pounds — through `quote`, on the same debounce and for the same two reasons
 * as the pot stepper one sprint earlier:
 *
 *   * C84. `Intl` in a client component renders different digits in the browser
 *     from the server pass, and this is the number somebody types into a bank.
 *   * A total the browser worked out is a total the browser decided. Every money
 *     path here reads amounts from stored rows, and the endpoint that once took
 *     a price from a request body is the reason the rule exists.
 *
 * ## 🔴 TICKING A BOX OPENS NOTHING
 *
 * `quote` writes nothing. The cart opens when the SHEET opens, because that is
 * the moment somebody is about to read an account number, and a row per tick
 * would fill an operator's screen with people who were still deciding.
 */
export function BillPicker({
  invoices,
  subject,
  details,
  amountLabel,
  lines,
  live,
  action,
  quote,
  onOpen,
  /** 🔴 76.34 — passed straight through. See `PaymentPopup`. */
  onCancel,
  storageKey,
}: {
  invoices: { id: string; description: string; cents: number; issuedAt: string }[];
  subject: PaymentSubject;
  details: TransferView;
  /** The server's opening figure: the whole bill, or an open cart's own total. */
  amountLabel: string;
  lines: PaymentLineView[];
  live: LiveState;
  action: (prev: TransferFormState, form: FormData) => Promise<TransferFormState>;
  quote: (
    ids: string[],
  ) => Promise<{ amountLabel: string; lines: PaymentLineView[]; totalCents: number }>;
  onOpen: (ids: string[]) => Promise<void>;
  onCancel?: () => Promise<void>;
  storageKey: string;
}) {
  const t = useT();

  /*
   * 🔴 EVERYTHING SELECTED TO BEGIN WITH, which is what the page already said
   * they owe. A picker that opened empty would make paying the whole bill — the
   * commonest act by a distance — eleven taps of work.
   */
  const [picked, setPicked] = useState<string[]>(() => invoices.map((i) => i.id));
  const [quoted, setQuoted] = useState<{ amountLabel: string; lines: PaymentLineView[] } | null>(
    null,
  );
  /*
   * 🔴 NOTHING IS ASKED UNTIL SOMETHING IS CHANGED. The figures the server
   * already rendered are the answer for the whole bill, so quoting on mount
   * would be a round trip that can only ever return what is on screen — once
   * per visit, for every clinician in this market, most of whom pay all of it.
   */
  const [touched, setTouched] = useState(false);

  /*
   * 🔴 A LIVE PAYMENT FREEZES THE PICKER, and this is the rule rather than a
   * nicety. Once there is a claim in flight the figures on this screen belong to
   * that claim: changing the selection under it would show a payer a list their
   * bank transfer does not match. They finish it or an operator decides it.
   */
  const locked = live.state === "submitted" || live.state === "awaiting_proof";

  /*
   * Debounced, like the stepper's: somebody clearing ten boxes means it once.
   * A failure leaves the server's opening figure on screen, which is the whole
   * bill, and the sheet still works.
   */
  useEffect(() => {
    if (locked || !touched) return;
    const timer = setTimeout(() => {
      void quote(picked)
        .then((next) => setQuoted({ amountLabel: next.amountLabel, lines: next.lines }))
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [picked, quote, locked, touched]);

  const choose = (next: string[]) => {
    setTouched(true);
    setPicked(next);
  };

  const showing = locked ? null : quoted;
  const nothing = !locked && picked.length === 0;

  return (
    <div className="space-y-3">
      {/*
        🔴 ONLY WHEN THERE IS SOMETHING TO CHOOSE BETWEEN. One unpaid invoice is
        not a choice, and a list of one with a tick beside it is a control that
        asks a question with one answer.
      */}
      {invoices.length > 1 && !locked ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{t("bill.pick")}</p>
            <button
              type="button"
              onClick={() =>
                choose(picked.length === invoices.length ? [] : invoices.map((i) => i.id))
              }
              className="text-xs font-medium text-brand-800 underline"
            >
              {picked.length === invoices.length ? t("bill.none") : t("bill.all")}
            </button>
          </div>

          <ul className="mt-3 space-y-1">
            {invoices.map((invoice) => {
              const on = picked.includes(invoice.id);
              return (
                <li key={invoice.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 active:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        choose(
                          on
                            ? picked.filter((id) => id !== invoice.id)
                            : [...picked, invoice.id],
                        )
                      }
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-800">
                        {invoice.description}
                      </span>
                      <span className="block text-xs text-slate-500">{invoice.issuedAt}</span>
                    </span>
                    {/*
                      🔴 76.7 — DOLLARS, revealing pounds on hover or a tap, like
                      every other figure in the product. The pounds on the sheet
                      below are the ones that leave their bank; these are the
                      invoice amounts, and an invoice is denominated in dollars.
                    */}
                    <span className="shrink-0 text-sm font-medium text-slate-900">
                      <Money cents={invoice.cents} />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {nothing ? (
            <p role="alert" className="mt-2 px-2 text-xs text-rose-600">
              {t("bill.pickOne")}
            </p>
          ) : null}
        </div>
      ) : null}

      <PaymentPopup
        storageKey={storageKey}
        onOpen={() => onOpen(picked)}
        onCancel={onCancel}
        subject={subject}
        details={details}
        amountLabel={showing?.amountLabel ?? amountLabel}
        lines={showing?.lines ?? lines}
        live={live}
        action={action}
      />
    </div>
  );
}
