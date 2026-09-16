"use client";

import { useState } from "react";

import { useT } from "@/lib/i18n/client";
import type { PotStep } from "@/lib/billing/manual-entry";

/**
 * 🔴 76.1 — HOW MUCH A COMPANY IS PUTTING IN, CHOSEN WITHOUT A KEYBOARD.
 *
 * ## The whole component holds one number, and it is an index
 *
 * Not an amount. An index into `steps`, every rung of which arrived from the
 * server with its dollars, its pounds, its tax and its sessions already
 * written out in the reader's language.
 *
 * That is not an optimisation, it is C84. `Intl` inside a client component
 * renders one string during the server pass and another in the browser, and
 * these are the figures somebody copies into a banking app. It is also the
 * difference between Arabic-Indic and Western digits for half this market. So
 * the browser does no arithmetic and no formatting: it moves an index and
 * renders what it was given, which leaves no number for the two sides to
 * disagree about.
 *
 * ## Why the buttons are large and the field is gone
 *
 * A pot is the one place in this product where the PAYER picks the figure. On
 * a rail with no processor, a text box in dollars is how somebody sends $5 or
 * $50,000 by slipping on a zero, and neither one can be reversed. Stepping in
 * fixed increments makes the set of amounts we accept exactly the set we can
 * render, and it makes the wrong amount something you have to work at.
 */
export function TopUpStepper({
  steps,
  onConfirm,
}: {
  steps: PotStep[];
  /** Rendered under the summary. Receives the chosen credit, in USD cents. */
  onConfirm: (step: PotStep) => React.ReactNode;
}) {
  const t = useT();
  const [i, setI] = useState(0);

  /*
   * An empty ladder means an operator has configured a ceiling below the floor.
   * Say so rather than rendering a stepper with nothing to step through.
   */
  if (steps.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{t("topup.unavailable")}</p>
    );
  }

  const step = steps[Math.min(i, steps.length - 1)]!;
  const atFloor = i <= 0;
  const atCeiling = i >= steps.length - 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {t("topup.choose")}
      </p>

      {/* ---------------------------------------------------- the stepper -- */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <StepButton
          label={t("topup.less")}
          sign="minus"
          disabled={atFloor}
          onClick={() => setI((n) => Math.max(0, n - 1))}
        />

        <div className="min-w-0 flex-1 text-center">
          {/*
            🔴 DOLLARS LARGE, POUNDS SMALL, AND BOTH ALWAYS PRESENT.
            The pot is denominated in dollars and the bank moves pounds. A
            finance team shown one and asked for the other converts in their
            head at a rate we have not agreed to.
          */}
          <p className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">
            {step.usdLabel}
          </p>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">{step.egpLabel}</p>
        </div>

        <StepButton
          label={t("topup.more")}
          sign="plus"
          disabled={atCeiling}
          onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}
        />
      </div>

      {/*
        🔴 THE SUM A FINANCE TEAM DOES ON PAPER, DONE FOR THEM.
        "10% coverage" is abstract and "covers 50 sessions" is a decision. It
        is their OWN coverage rate, read from their pot, not an average.
      */}
      <p className="mt-4 rounded-xl bg-brand-50 p-3 text-center text-sm font-medium text-brand-900">
        {t("topup.covers", { count: String(step.sessions) })}
      </p>

      {/* ------------------------------------------------- what they send -- */}
      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
        <Row label={t("topup.credit")} value={step.egpLabel} />
        {/*
          Rendered only where there is tax, so nothing untrue is said about a
          jurisdiction that charges none.
        */}
        {step.vatEgpLabel ? <Row label={t("topup.vat")} value={step.vatEgpLabel} /> : null}
        <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-1.5">
          <dt className="text-sm font-semibold text-slate-900">{t("topup.send")}</dt>
          <dd className="text-base font-bold text-slate-900 tabular-nums">{step.totalEgpLabel}</dd>
        </div>
      </dl>

      {/*
        🔴 THE CHOSEN CREDIT TRAVELS AS A HIDDEN FIELD IN THE CALLER'S FORM.
        The server recomputes the tax from it rather than trusting a total the
        browser worked out, which is the same rule the session rail follows:
        a payer who can post what they owe is a payer who owes less.
      */}
      <div className="mt-4">{onConfirm(step)}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * 🔴 A REAL BUTTON WITH A REAL LABEL, not a glyph with an aria-label bolted on.
 *
 * The sign is drawn rather than typed: a `+` or `−` as text inherits the
 * paragraph's font and lands optically off centre in one of the two scripts
 * this product renders. Two `span`s cannot.
 */
function StepButton({
  label,
  sign,
  disabled,
  onClick,
}: {
  label: string;
  sign: "plus" | "minus";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition active:scale-95 disabled:opacity-30 disabled:active:scale-100"
    >
      <span className="relative block h-5 w-5">
        <span className="absolute top-1/2 left-0 h-0.5 w-5 -translate-y-1/2 rounded-full bg-current" />
        {sign === "plus" ? (
          <span className="absolute top-0 left-1/2 h-5 w-0.5 -translate-x-1/2 rounded-full bg-current" />
        ) : null}
      </span>
    </button>
  );
}
