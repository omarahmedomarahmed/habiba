"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui";
import { TopUpStepper } from "@/components/billing/top-up-stepper";
import { useT } from "@/lib/i18n/client";
import type { PotStep } from "@/lib/billing/manual-entry";

/**
 * How anybody in Egypt pays us, until there is a gateway.
 *
 * ## 🔴 ONE COMPONENT FOR ALL THREE FLOWS
 *
 * A session, a subscription and a pot top-up are the same act: read an account,
 * send money from a banking app, say you have. Three components would be three
 * copies of the Arabic, three chances to forget the rejection path, and three
 * places to fix the day the account number changes. The only real difference is
 * whether the payer chooses the amount, and that is one prop.
 *
 * ## 🔴 THE THREE STATES, AND THE MIDDLE ONE IS THE DESIGN
 *
 *   details  →  submitted, waiting for a person  →  confirmed or rejected
 *
 * The middle state is not a loading spinner. It is a **durable state on the
 * server** that the payer can close the tab on, go to work, and come back to.
 * A spinner that only exists while the page is open would mean a patient who
 * locked their phone loses the fact that they paid, and the whole rail rests on
 * them not losing that.
 *
 * ## 🔴 THE LABEL DIFFERS BY AUDIENCE AND THE DETAILS DO NOT
 *
 * A patient and a therapist in Egypt recognise **InstaPay**, which is the rail
 * they use from their phone. A company finance team recognises **Bank Transfer**
 * and would be puzzled by a consumer brand on something they file. Same account
 * underneath, different word on top, and the word is chosen by the server from
 * the audience rather than guessed here.
 *
 * ## 🔴 A REFERENCE OR A RECEIPT, not both and not neither
 *
 * Neither is unverifiable and wastes the operator's afternoon. Both turns away
 * somebody whose banking app shows a reference but will not export a receipt.
 * `submitProof` is where that rule actually lives; the button below only stops
 * the obvious case of an empty form.
 */
export type TransferView = {
  label: string;
  fields: { key: string; label: string; value: string; hint: string }[];
  cardsComingSoon: boolean;
  unconfigured: boolean;
};

export type LiveState =
  | { state: "none" }
  | { state: "awaiting_proof"; paymentId: string }
  | { state: "submitted"; paymentId: string; submittedAt: string | null }
  | { state: "rejected"; reason: string };

export type TransferFormState = { error?: string; ok?: boolean };

/** How often a waiting payer's page re-asks the server. */
const POLL_MS = 15_000;

export function PayByTransfer({
  details,
  amountLabel,
  taxNote,
  what,
  live,
  action,
  askAmount = false,
  minimumLabel,
  rateLabel,
  steps,
}: {
  details: TransferView;
  /** "1,000 EGP", already formatted by the server in the payer's language. */
  amountLabel: string;
  /** 🔴 75.7 — the tax inside the figure above, in pounds. Empty where there is none. */
  taxNote?: string;
  /** "this session", "your bill", "your pot". Server copy, already translated. */
  what: string;
  live: LiveState;
  action: (prev: TransferFormState, form: FormData) => Promise<TransferFormState>;
  /**
   * 🔴 Only a pot. A session and an invoice cost what they cost, and asking a
   * patient to type the price is asking them to get it wrong.
   */
  askAmount?: boolean;
  /** The floor, formatted on the server. Only meaningful beside `askAmount`. */
  minimumLabel?: string;
  /**
   * 🔴 "50 EGP", only meaningful beside `askAmount`, and required by it.
   *
   * A payer typing dollars and transferring pounds needs the sum in between.
   * Without it the form asks for one currency and the account details above it
   * take another, and the payer does the conversion in their head at a rate we
   * have not agreed to.
   */
  rateLabel?: string;
  /**
   * 🔴 76.1 — the rungs of the top-up stepper, built on the server.
   *
   * Required by `askAmount` and meaningless without it. Every label inside is
   * already formatted in the reader's language, because the browser is not
   * allowed to format money (C84) and this is the screen where that matters
   * most: these are the figures somebody types into a banking app.
   */
  steps?: PotStep[];
}) {
  const t = useT();
  const router = useRouter();
  const [state, submit] = useActionState(action, {} as TransferFormState);

  /*
   * 🔴 THE WAIT IS WHAT MAKES THIS A PRODUCT RATHER THAN A FORM.
   *
   * A patient who has paid for a session at eleven at night is waiting on an
   * operator, and the moment that operator presses Confirm their session
   * becomes joinable. Without this they find out by reloading, and somebody in
   * that state does not reload — they decide it is broken.
   *
   * `router.refresh()` rather than a fetch loop: the whole answer is a server
   * render, and the page that holds this component is the thing that knows
   * where to send them next.
   */
  useEffect(() => {
    if (live.state !== "submitted") return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [live.state, router]);

  /* ------------------------------------------------------ already waiting -- */

  if (live.state === "submitted") {
    return (
      <Card className="border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-900">{t("transfer.checking")}</p>
        <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
          {t("transfer.checkingBody")}
        </p>
        {/*
          🔴 SAID EXPLICITLY, because the instinct is to sit and stare at it.
          A person told they may close the page closes it; a person not told
          waits, and a waiting person is the one who decides this is broken.
        */}
        <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-amber-900">
          {t("transfer.closePage")}
        </p>
      </Card>
    );
  }

  /* ---------------------------------------------------------- turned down -- */

  if (live.state === "rejected") {
    return (
      <Card className="border-rose-200 bg-rose-50 p-5">
        <p className="text-sm font-semibold text-rose-900">{t("transfer.rejected")}</p>
        {/*
          🔴 THEIR WORDS, VERBATIM. The operator wrote a reason the payer can act
          on, and paraphrasing it here or replacing it with a generic sentence
          would throw away the only thing that makes a rejection survivable.
        */}
        <p className="mt-2 rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-rose-900">
          {live.reason}
        </p>
        <p className="mt-3 text-sm text-rose-900/90">{t("transfer.rejectedBody")}</p>
      </Card>
    );
  }

  /* ------------------------------------------------------- not set up yet -- */

  if (details.unconfigured) {
    return (
      <Card className="border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-900">{t("transfer.unset")}</p>
        {/*
          🔴 An empty details list must SAY it is empty. Rendering nothing, or
          rendering a plausible-looking blank account, is how somebody transfers
          money into the void.
        */}
        <p className="mt-1 text-sm text-slate-600">{t("transfer.unsetBody")}</p>
      </Card>
    );
  }

  /* ---------------------------------------------------------- the details -- */

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900">{details.label}</p>
      <p className="mt-1 text-sm text-slate-600">
        {askAmount ? (
          <>
            {t("transfer.sendAtLeast", { amount: minimumLabel ?? "" })} · {what}
          </>
        ) : (
          <>
            {t("transfer.send")} <strong className="text-slate-900">{amountLabel}</strong> · {what}
          </>
        )}
      </p>

      {/*
        🔴 75.7 — WHY THE FIGURE IS BIGGER THAN THE FEE THEY WERE QUOTED.

        An Egyptian patient is asked for 1,140 pounds for a 1,000 pound session.
        With no line saying so that reads as a markup, and a payer who thinks
        they are being overcharged does not transfer, they email. Rendered only
        when there is tax, so nothing untrue is said about a country that
        charges none.
      */}
      {taxNote ? (
        <p className="mt-1 text-xs text-slate-500">{t("transfer.taxNote", { tax: taxNote })}</p>
      ) : null}

      <dl className="mt-4 space-y-2">
        {details.fields.map((f) => (
          <div key={f.key} className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{f.label}</dt>
            {/* Selectable, because they are copying this into a banking app. */}
            <dd className="mt-0.5 font-mono text-sm break-all text-slate-900 select-all">
              {f.value}
            </dd>
            {f.hint ? <p className="mt-1 text-[11px] text-slate-500">{f.hint}</p> : null}
          </div>
        ))}
      </dl>

      {details.cardsComingSoon ? (
        <p className="mt-3 text-xs text-slate-500">{t("transfer.cardsSoon")}</p>
      ) : null}

      {/*
        🔴 A PLAIN FORM WITH `encType`, not a fetch. A receipt is a 6 MB photo
        from a phone on Egyptian mobile data, and a multipart post is the one
        upload path that survives a browser deciding to retry it.
      */}
      <form
        action={submit}
        encType="multipart/form-data"
        className="mt-5 space-y-3 border-t border-slate-100 pt-4"
      >
        {/*
          🔴 76.1 — THE STEPPER REPLACED A TEXT BOX IN DOLLARS.

          It used to be `<input name="amount" inputMode="decimal">` with the
          rate underneath. On a rail with no processor that is how somebody
          sends $5 or $50,000 by slipping on a zero, and neither is reversible.
          The field that posts is hidden and carries the CREDIT; the server
          recomputes the tax from it rather than trusting a total the browser
          worked out.
        */}
        {askAmount && steps ? (
          <TopUpStepper
            steps={steps}
            onConfirm={(step) => (
              <>
                <input type="hidden" name="amount" value={String(step.creditCents / 100)} />
                <p className="text-[11px] text-slate-500">
                  {t("transfer.rateNote", { rate: rateLabel ?? "" })}
                </p>
              </>
            )}
          />
        ) : null}

        <label className="block text-sm font-medium text-slate-800" htmlFor="transfer-ref">
          {t("transfer.refLabel")}
        </label>
        <input
          id="transfer-ref"
          name="reference"
          placeholder={t("transfer.refPlaceholder")}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
        />
        <p className="text-[11px] text-slate-500">{t("transfer.refHint")}</p>

        <label className="block text-sm font-medium text-slate-800" htmlFor="transfer-proof">
          {t("transfer.proofLabel")}
          <input
            id="transfer-proof"
            name="proof"
            type="file"
            accept="image/*,application/pdf"
            className="mt-1 block w-full text-sm text-slate-600 file:me-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
          />
        </label>

        {state.error ? (
          <p role="alert" className="text-sm text-rose-600">
            {state.error}
          </p>
        ) : null}

        <Declare />
      </form>
    </Card>
  );
}

function Declare() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white disabled:opacity-40"
    >
      {pending ? t("transfer.sending") : t("transfer.paid")}
    </button>
  );
}
