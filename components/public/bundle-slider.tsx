"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/billing/plans";
import { convert } from "@/lib/billing/money";

/**
 * Drag to buy more. PLAN.md 17.4.
 *
 * ## Why a slider earns its place here
 *
 * The three cards answer "what does one session cost". They do not answer the
 * question a therapist with a real caseload actually has, which is *"what does
 * my month cost"* — and a page that makes somebody open a calculator has lost
 * them. The minimum is the bundle's own minimum and the total is live.
 *
 * ## The saving is stated against pay-as-you-go, not against nothing
 *
 * "$2 a session" next to "save 50%" invites the reader to check, and they
 * should be able to: the comparison is the pay-as-you-go rate for the same
 * quantity, both figures on screen. A percentage with no baseline is a claim
 * rather than arithmetic.
 *
 * Every number here comes from `platform_settings` through the server
 * component that renders this one — nothing is typed into this file, and the
 * EGP rate arrives as a prop for the reason in `PriceTag`: a component that
 * fetched its own rate would disagree with the checkout.
 */
/** The server left `{count}` and friends in place; the numbers live here. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (whole, key: string) => values[key] ?? whole,
  );
}

export function BundleSlider({
  name,
  rateCents,
  minimum,
  paygRateCents,
  egpRateMicro,
  locale,
  strings,
}: {
  name: string;
  rateCents: number;
  minimum: number;
  paygRateCents: number;
  egpRateMicro: number | null;
  /** 19.4 — the reader's locale, from the server. */
  locale: string;
  /**
   * 🔴 21R.8 / C84 — the words arrive as props, resolved on the server.
   *
   * A client component cannot call `getI18n()`, and one that reaches for the
   * runtime renders one language on the server pass and another after
   * hydration. The strings that still carry `{count}` and friends are
   * substituted below, where the numbers exist.
   */
  strings: {
    label: string;
    showEgp: string;
    showUsd: string;
    at: string;
    once: string;
    saved: string;
  };
}) {
  const [quantity, setQuantity] = useState(minimum);
  const [egp, setEgp] = useState(false);

  const totalCents = rateCents * quantity;
  const paygCents = paygRateCents * quantity;
  const savedCents = Math.max(0, paygCents - totalCents);

  const show = (cents: number) =>
    egp && egpRateMicro !== null
      ? formatMoney(convert(cents, egpRateMicro), "EGP", locale)
      : formatMoney(cents, "USD", locale);

  return (
    <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label
          htmlFor="bundle"
          className="text-sm font-semibold text-slate-900"
        >
          {strings.label}
        </label>

        {egpRateMicro !== null ? (
          <button
            type="button"
            onClick={() => setEgp((on) => !on)}
            aria-pressed={egp}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500"
          >
            {egp ? strings.showUsd : strings.showEgp}
          </button>
        ) : null}
      </div>

      <input
        id="bundle"
        type="range"
        min={minimum}
        max={minimum * 10}
        step={1}
        value={quantity}
        onChange={(event) => setQuantity(Number(event.target.value))}
        className="mt-4 w-full accent-brand-500"
        aria-valuetext={`${quantity} sessions`}
      />

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-slate-600">
          {fill(strings.at, {
            count: String(quantity),
            price: show(rateCents),
          })}
        </p>
        <p className="text-end">
          <span className="text-2xl font-bold text-slate-900">
            {show(totalCents)}
          </span>
          <span className="block text-xs text-slate-500">{strings.once}</span>
        </p>
      </div>

      {savedCents > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          {fill(strings.saved, {
            count: String(quantity),
            payg: show(paygCents),
            saved: show(savedCents),
          })}
        </p>
      ) : null}
    </div>
  );
}
