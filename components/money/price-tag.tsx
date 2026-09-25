"use client";

import { useMoneyDisplay } from "@/components/money/display";

import { useState } from "react";

import { formatMoney } from "@/lib/billing/plans";
import { convert } from "@/lib/billing/money";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * A price in USD. Hover it to see the pounds, press it to keep them.
 *
 * ## 🔴 WHY THE BADGE IS GONE
 *
 * There used to be a small outlined `EGP` button sitting immediately after the
 * amount, and it read as part of the amount:
 *
 *     $80 EGP
 *
 * Which says, to anybody skimming, that this price is eighty Egyptian pounds
 * and somebody left a dollar sign on it by mistake. Two currency marks on one
 * figure is ambiguous no matter how the second one is styled, because the
 * reader has to already know it is a control to read it as one. A previous pass
 * at this (21R.8) moved the unit in between to break them apart, which turned
 * "$80 EGP" into "$80 / session EGP" and made the badge stranger rather than
 * clearer.
 *
 * So the control is the number. Hovering or focusing it shows what the price is
 * in pounds, ABOVE the figure and out of the inline flow, where it cannot be
 * mistaken for part of it. Pressing it keeps that currency. The dotted rule
 * under the figure is the affordance, which is the one convention that says
 * "there is more here" without being a second currency mark.
 *
 * The peek is positioned rather than inserted because an inline peek would
 * change the figure's width on hover, and a control that moves out from under
 * the cursor when you point at it flickers between its two states forever.
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
   * What the price is *per*, rendered after the amount: "$4 / session".
   *
   * It was introduced (21R.8) to wedge apart the figure and the EGP badge,
   * which read as one string. The badge is gone, so it is back to being what
   * its name says, and it stays a prop rather than a `<span>` at the call site
   * so the whole price reads as one baseline-aligned unit.
   */
  unit?: string;
}) {
  /* Pounds lead wherever the page says they do (every signed-in screen); dollars on the website. */
  const t = useT();
  const [egp, setEgp] = useState(useMoneyDisplay().primary === "EGP");
  const [peeking, setPeeking] = useState(false);
  const showEgp = egp && rateMicro !== null;

  const usd = formatMoney(usdCents, "USD", locale);
  const pounds = rateMicro === null ? null : formatMoney(convert(usdCents, rateMicro), "EGP", locale);
  const shown = showEgp && pounds !== null ? pounds : usd;
  const other = showEgp ? usd : pounds;

  const figure = cn("font-semibold text-slate-900", size === "lg" && "text-2xl");

  /*
   * No rate means no second currency, so there is nothing to press and the
   * figure is plain text. A disabled button here would be a control that
   * announces itself and then refuses, which is worse than no control.
   */
  if (rateMicro === null) {
    return (
      <span className={cn("inline-flex items-baseline gap-1.5", className)}>
        <span className={figure}>{usd}</span>
        {unit ? <span className="text-sm font-normal text-slate-500">{unit}</span> : null}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <button
        type="button"
        onClick={() => {
          setEgp((on) => !on);
        }}
        onPointerEnter={() => {
          setPeeking(true);
        }}
        onPointerLeave={() => {
          setPeeking(false);
        }}
        onFocus={() => {
          setPeeking(true);
        }}
        onBlur={() => {
          setPeeking(false);
        }}
        aria-pressed={showEgp}
        /*
         * The amount leads, so the control is announced as the price it is and
         * then as the thing pressing it does. An `aria-label` of the action
         * alone would replace the figure, and a screen reader would reach a
         * price card that never says the price.
         */
        aria-label={`${shown}. ${
          showEgp ? t("money.showUsd") : t("money.showEgp")
        }`}
        className={cn(
          "relative cursor-pointer underline decoration-dotted decoration-from-font underline-offset-4",
          "decoration-slate-400 transition-colors hover:decoration-brand-600",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
          figure,
        )}
      >
        {shown}
        {/*
          Out of the inline flow, so the figure never changes width, and
          `aria-hidden` because the button's own label already carries it. A
          pointer user reads this; a screen reader reads the label; neither
          gets it twice.
        */}
        {/*
          🔴 CENTRED WITHOUT NAMING A SIDE.
          `left-1/2 -translate-x-1/2` is the usual idiom and it is direction
          neutral, because `left: 50%` is the same physical point either way.
          `verify:sprint19` cannot see that, and it is right not to try: a rule
          that allows `left-` in one pairing is a rule with a hole in it, and
          19.3 exists because a "localised" interface that renders identically
          in Arabic is how nobody notices nobody localised it.
          `inset-x-0` with an automatic inline margin centres the same way and
          names no side at all, so there is nothing to exempt.
        */}
        <span
          aria-hidden
          data-peek={peeking ? "on" : "off"}
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-full z-10 mx-auto mb-1.5 w-fit",
            "whitespace-nowrap rounded-lg bg-navy-500 px-2 py-1 text-xs font-medium text-white shadow-sm",
            "transition-opacity duration-150",
            peeking ? "opacity-100" : "opacity-0",
          )}
        >
          {other}
        </span>
      </button>

      {unit ? <span className="text-sm font-normal text-slate-500">{unit}</span> : null}
    </span>
  );
}
