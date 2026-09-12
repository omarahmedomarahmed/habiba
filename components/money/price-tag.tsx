"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/billing/plans";
import { convert } from "@/lib/billing/money";
import { cn } from "@/lib/utils";

/**
 * A price in USD, with a small EGP toggle beside it. PLAN.md 16.4.
 *
 * ## Why the rate is a prop and never a fetch
 *
 * The server already knows the rate — it quoted it, it froze it onto the
 * transaction where there is one, and it can refuse the pair (C37). A
 * component that fetched its own rate would show a number the receipt does not
 * agree with, which is the exact failure 16.6 exists to prevent.
 *
 * ## Why the first render is always USD
 *
 * C70/C84: this renders on the server pass and again in the browser, and the
 * two must produce the same bytes. A component that read a stored preference
 * during render would differ between the passes on the first paint. The toggle
 * is a *user action* — after a click the two passes have already agreed.
 *
 * `formatMoney` pins `en-US`, so the digits and the grouping are the same in
 * every browser. 19.4 is where the locale becomes a parameter carried from
 * the server like the zone was; until then, deterministic beats native.
 */
export function PriceTag({
  usdCents,
  rateMicro,
  locale,
  className,
  size = "base",
  unit,
}: {
  usdCents: number;
  /** EGP per USD, x1e6. Null when we cannot price the pair — then no toggle. */
  rateMicro: number | null;
  /**
   * 🔴 19.4 — a BCP 47 tag from the server, never read off the runtime.
   *
   * Same argument as the zone (C70/C84): the browser's locale and the
   * server's differ, and a component that asks the runtime renders one thing
   * on the server pass and another after hydration.
   */
  locale: string;
  className?: string;
  size?: "base" | "lg";
  /**
   * 🔴 21R.8 — what the price is *per*, rendered between the amount and the
   * currency toggle.
   *
   * Read aloud, the pricing card used to say "four dollars EGP per session":
   * the toggle sits next to the number, so a small button labelled `EGP`
   * reads as part of the amount to anybody skimming. Putting the unit in
   * between separates them — "$4 / session · EGP" — and the caller no longer
   * has to place a `<span>` after a component that ends in a button.
   */
  unit?: string;
}) {
  const [egp, setEgp] = useState(false);
  const showEgp = egp && rateMicro !== null;

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className={cn("font-semibold text-slate-900", size === "lg" && "text-2xl")}>
        {showEgp
          ? formatMoney(convert(usdCents, rateMicro!), "EGP", locale)
          : formatMoney(usdCents, "USD", locale)}
      </span>

      {unit ? <span className="text-sm font-normal text-slate-500">{unit}</span> : null}

      {rateMicro !== null ? (
        <button
          type="button"
          onClick={() => setEgp((on) => !on)}
          aria-pressed={showEgp}
          aria-label={showEgp ? "Show this price in dollars" : "Show this price in Egyptian pounds"}
          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
        >
          {showEgp ? "USD" : "EGP"}
        </button>
      ) : null}
    </span>
  );
}

/**
 * 🔴 16.6b / C76 — the EGP settlement disclosure, on the screen with the button.
 *
 * The therapist absorbs the exchange difference when they choose to pay in
 * EGP. That is only a fair deal if the rate and the dollar amount it settles
 * are visible **before** they press the button, so this component takes both
 * and renders both. It is deliberately not collapsible and deliberately not a
 * tooltip: a disclosure somebody has to open is a disclosure they discover
 * afterwards, which is the thing C76 forbids.
 */
export function EgpDisclosure({
  payMinor,
  settlesCents,
  rateMicro,
  spreadBps,
  quotedAtLabel,
  locale,
}: {
  payMinor: number;
  settlesCents: number;
  rateMicro: number;
  spreadBps: number;
  /** Formatted on the server, in the reader's zone. C84 — never a Date here. */
  quotedAtLabel: string;
  /** 19.4 — from the server, like the zone. */
  locale: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">
        You pay {formatMoney(payMinor, "EGP", locale)}
      </p>
      <p className="mt-1 leading-relaxed">
        That settles {formatMoney(settlesCents, "USD", locale)} at{" "}
        {(rateMicro / 1_000_000).toFixed(2)} EGP to the dollar, quoted {quotedAtLabel}.
        {spreadBps > 0
          ? ` Includes a ${(spreadBps / 100).toFixed(2)}% conversion charge.`
          : " We add nothing to the rate."}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        The dollar price is the price. Paying in pounds is a convenience at today&apos;s rate, and
        the difference is yours.
      </p>
    </div>
  );
}
