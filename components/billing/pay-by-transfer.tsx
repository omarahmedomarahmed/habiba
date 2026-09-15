"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * How anybody in Egypt pays us, until there is a gateway.
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
 * So this component renders what the server says the state is. It polls, it
 * does not hold anything, and closing it costs nothing.
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

export function PayByTransfer({
  details,
  amountLabel,
  what,
  live,
  onSubmit,
}: {
  details: TransferView;
  /** "1,000 EGP", already formatted by the server in the payer's currency. */
  amountLabel: string;
  /** "this session", "your October invoice", "your pot". */
  what: string;
  live: LiveState;
  onSubmit: (input: { reference: string; proofUrl: string | null }) => Promise<{ error?: string }>;
}) {
  const t = useT();
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
        <p className="mt-3 text-sm text-rose-900/90">
          {t("transfer.rejectedBody")}
        </p>
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
        <p className="mt-1 text-sm text-slate-600">
          {t("transfer.unsetBody")}
        </p>
      </Card>
    );
  }

  /* ---------------------------------------------------------- the details -- */

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900">{details.label}</p>
      <p className="mt-1 text-sm text-slate-600">
        {t("transfer.send")} <strong className="text-slate-900">{amountLabel}</strong> · {what}
      </p>

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

      <div className="mt-5 border-t border-slate-100 pt-4">
        <label htmlFor="transfer-ref" className="text-sm font-medium text-slate-800">
          {t("transfer.refLabel")}
        </label>
        <input
          id="transfer-ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("transfer.refPlaceholder")}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          {t("transfer.refHint")}
        </p>

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

        <button
          type="button"
          disabled={pending || reference.trim().length < 3}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await onSubmit({ reference: reference.trim(), proofUrl: null });
              if (result.error) setError(result.error);
            })
          }
          className="mt-3 h-11 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? t("transfer.sending") : t("transfer.paid")}
        </button>
      </div>
    </Card>
  );
}
