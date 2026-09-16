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
  | { state: "submitted"; paymentId: string; submittedAt: string | null; proofUrl?: string | null }
  | { state: "rejected"; reason: string };

export type TransferFormState = { error?: string; ok?: boolean };

/** One thing the total covers, already converted and formatted by the server. */
export type PaymentLineView = { label: string; amountLabel: string };

/**
 * 🔴 76.16 — WHAT THE TOTAL IS MADE OF, and it renders in TWO states.
 *
 * A single figure is enough when a payment has one subject. It is not enough for
 * a pay-as-you-go clinician who chose four of eleven unpaid sessions: the number
 * they are asked for matches nothing they can see, and the only way to check it
 * is to add up a list on another screen.
 *
 * 🔴 IT RENDERS AGAIN AFTER SUBMITTING, which is the half that is easy to miss.
 * The waiting state is a screen somebody comes back to hours later, and "waiting
 * to be checked" with no list is an answer to a question they are no longer
 * asking. What they want then is which four sessions this was.
 *
 * Nothing here adds up: the sum is `amountLabel`, computed on the server from
 * stored rows, and a total assembled in the browser from strings would be a
 * second opinion about what somebody owes.
 */
function Lines({ lines }: { lines?: PaymentLineView[] }) {
  if (!lines || lines.length === 0) return null;

  return (
    <ul className="mt-3 space-y-1 rounded-xl bg-white/70 p-3">
      {lines.map((line, i) => (
        <li key={`${line.label}-${i}`} className="flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-slate-600">{line.label}</span>
          <span className="shrink-0 font-medium text-slate-900 tabular-nums">
            {line.amountLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

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
  lines,
  hideCardsSoon = false,
  onChoose,
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
  /**
   * 🔴 76.16 — what this total covers, formatted on the server.
   *
   * Empty for a payment with one obvious subject, which is most of them: the
   * heading already said "Session with Dr Mona" and repeating it as a list of
   * one is noise on the screen where somebody is copying an account number.
   */
  lines?: PaymentLineView[];
  /** 🔴 76.5 — the popup renders the notice in its card slot instead. */
  hideCardsSoon?: boolean;
  /** 🔴 76.13 — saves the company's chosen figure as their open payment. */
  onChoose?: (creditCents: number) => Promise<void>;
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

        <Lines lines={lines} />

        {/*
          🔴 76.4 — THEIR OWN RECEIPT, HANDED BACK.

          A payer who sent money, closed the page and came back has exactly one
          question: did that register. Showing the upload form again answers "no
          idea", and somebody who cannot tell whether a transfer landed sends a
          second one. There is no processor here to reverse it.
        */}
        {live.proofUrl ? (
          <a
            href={live.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-3 rounded-xl bg-white/70 p-3 text-sm font-medium text-amber-900"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-200 text-xs font-bold"
            >
              ✓
            </span>
            {t("pop.proofSent")}
          </a>
        ) : null}
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

      {/*
        🔴 76.16 — ABOVE THE ACCOUNT DETAILS, not below the form.
        The order on this screen is decide, then copy, then declare. A list of
        what they are paying for belongs in the deciding half: somebody who has
        already reached the IBAN has stopped reading and is in their banking app.
      */}
      <Lines lines={lines} />

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

      {/*
        🔴 76.5 — SAID ONCE, and the popup is where it is said.

        This line and the card slot in `PaymentPopup` were both rendering, so a
        payer read "card payments coming soon" twice on one screen. The slot is
        the better place: it occupies the space a card form will take, which is
        what makes it an answer to "where would a gateway go" rather than a
        footnote. `hideCardsSoon` is passed by the popup and by nothing else.
      */}
      {details.cardsComingSoon && !hideCardsSoon ? (
        <p className="mt-3 text-xs text-slate-500">{t("transfer.cardsSoon")}</p>
      ) : null}

      {/*
        🔴 A PLAIN FORM WITH `encType`, not a fetch. A receipt is a 6 MB photo
        from a phone on Egyptian mobile data, and a multipart post is the one
        upload path that survives a browser deciding to retry it.
      */}
      {/*
        🔴 76.12 — THE ONE SENTENCE THAT DECIDES WHETHER MONEY CAN BE ALLOCATED.

        There is no processor on this rail. A transfer arrives in our bank as a
        line with somebody's name on it and nothing linking it to an account, so
        a payer who sends the money and closes the page has paid us and cannot
        be credited: the operator has a bank line they cannot match and the
        payer has a session that never unlocks.

        Pressing Submit is what makes the two halves findable. It is the single
        most important instruction on this screen and it used to be implied by a
        button label, so it is stated, in red, above the field it is about.

        🔴 IT IS NOT A WARNING ABOUT DANGER, it is an instruction about
        sequence, which is why it names the order: send first, then submit.
      */}
      <p
        role="alert"
        className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-sm leading-relaxed font-bold text-red-700"
      >
        {t("pop.submitAlert")}
      </p>

      <form
        action={submit}
        encType="multipart/form-data"
        className="mt-3 space-y-3 border-t border-slate-100 pt-4"
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
            onChoose={onChoose}
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
      {/*
        🔴 76.12 — "Submit", because that is the act. The old label was "I have
        paid", which describes something they did in a banking app and not the
        thing this button does. Somebody who has paid and reads a button saying
        "I have paid" can reasonably close the page, and on this rail that
        leaves us a bank line nobody can match.
      */}
      {pending ? t("transfer.sending") : t("pop.submitCta")}
    </button>
  );
}
