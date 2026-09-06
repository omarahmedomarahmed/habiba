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
export function BundleSlider({
  name,
  rateCents,
  minimum,
  paygRateCents,
  egpRateMicro,
}: {
  name: string;
  rateCents: number;
  minimum: number;
  paygRateCents: number;
  egpRateMicro: number | null;
}) {
  const [quantity, setQuantity] = useState(minimum);
  const [egp, setEgp] = useState(false);

  const totalCents = rateCents * quantity;
  const paygCents = paygRateCents * quantity;
  const savedCents = Math.max(0, paygCents - totalCents);

  const show = (cents: number) =>
    egp && egpRateMicro !== null
      ? formatMoney(convert(cents, egpRateMicro), "EGP")
      : formatMoney(cents, "USD");

  return (
    <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="bundle" className="text-sm font-semibold text-slate-900">
          {name}: how many sessions?
        </label>

        {egpRateMicro !== null ? (
          <button
            type="button"
            onClick={() => setEgp((on) => !on)}
            aria-pressed={egp}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500"
          >
            {egp ? "Show USD" : "Show EGP"}
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
          <span className="text-2xl font-bold text-slate-900">{quantity}</span> sessions at{" "}
          {show(rateCents)} each
        </p>
        <p className="text-right">
          <span className="text-2xl font-bold text-slate-900">{show(totalCents)}</span>
          <span className="block text-xs text-slate-500">paid once, used over 12 months</span>
        </p>
      </div>

      {savedCents > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          The same {quantity} sessions pay-as-you-go would be {show(paygCents)}. You keep{" "}
          {show(savedCents)}.
        </p>
      ) : null}
    </div>
  );
}
