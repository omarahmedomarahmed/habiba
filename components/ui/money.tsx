"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { egpFor } from "@/app/actions/fx";
import { formatMoney } from "@/lib/billing/plans";
import { useLocale } from "@/lib/i18n/client";
import { localeTag } from "@/lib/i18n/config";

/**
 * 🔴 76.7 — EVERY PRICE IN THIS PRODUCT, IN DOLLARS, THAT WILL TELL YOU ITS POUNDS.
 *
 * ## The decision underneath
 *
 * The product quotes dollars. Everybody reading it in the launch market thinks
 * in pounds. Rendering both everywhere doubles the width of every table and
 * puts a second figure beside a number that is only sometimes the question; a
 * currency toggle makes a person hunt for a control to answer one question
 * about one number.
 *
 * So the dollars are the text and the pounds are one interaction away, on the
 * figure itself. Hover on a pointer, tap on a phone.
 *
 * ## Nothing is converted until somebody asks
 *
 * A screen with forty prices does no conversions at all until a person points
 * at one of them, and then exactly one. The answer is remembered for the life
 * of the component, because the rate does not move while somebody reads a page.
 *
 * ## The browser never does the arithmetic
 *
 * C84, and more than C84. The rate is an operator's setting, changed the
 * afternoon the pound moves, and a browser that could compute this figure is a
 * browser that could show one we would not honour. `egpFor` returns a string
 * already formatted on the server; this component renders it and nothing else.
 *
 * 🔴 The DOLLAR side is formatted here and that is deliberate: `formatMoney`
 * takes an explicit locale, so it is deterministic on both passes. C84 bans
 * reading the RUNTIME's locale, which is why the locale comes from the i18n
 * provider rather than from the machine.
 */
export function Money({
  cents,
  /**
   * 🔴 76.7 — THE CURRENCY THIS FIGURE IS ALREADY IN. Defaults to dollars.
   *
   * A few figures in this product are settled in a currency read off a column
   * rather than assumed: the patient's billing breakdown says so in its own
   * header, *"the breakdown underneath stays in the settlement currency"*. When
   * that column is not dollars there is nothing to reveal, because the reader is
   * already looking at their own money, and offering to convert it would be
   * offering to convert pounds into pounds.
   *
   * The first version of this component had no such prop, and a codemod that
   * wrapped those three rows silently hardcoded them to USD. A figure labelled
   * in the wrong currency is the one rendering bug a reader cannot detect.
   */
  currency = "USD",
  /** Rendered instead of the formatted dollars, when a caller has its own wording. */
  children,
  className,
}: {
  cents: number;
  currency?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const locale = useLocale();
  const isUsd = currency.toUpperCase() === "USD";
  const [egp, setEgp] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    if (!isUsd) return;
    setShown(true);
    if (egp !== null) return;
    /*
     * Failure is silence, on purpose. This is a convenience on top of a figure
     * that is already correct and already readable; a red error in a tooltip
     * over a price would say something alarming about the price itself.
     */
    egpFor(cents)
      .then(setEgp)
      .catch(() => setEgp(null));
  }, [cents, egp, isUsd]);

  /*
   * 🔴 A HOLD, NOT AN INSTANT POP. "A few seconds" of intent, so that a pointer
   * crossing a table of prices on its way somewhere else does not fire a
   * request per cell and flash a tooltip per cell.
   */
  const onEnter = () => {
    timer.current = setTimeout(reveal, 450);
  };

  const onLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setShown(false);
  };

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <span
      className={
        isUsd
          ? `relative inline-flex cursor-help items-baseline underline decoration-dotted decoration-slate-300 underline-offset-4 ${className ?? ""}`
          : className
      }
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={reveal}
      onBlur={onLeave}
      /* A phone has no hover. A tap is the whole interaction there. */
      onClick={reveal}
      tabIndex={isUsd ? 0 : undefined}
      role={isUsd ? "button" : undefined}
      aria-label={children ? undefined : formatMoney(cents, currency, localeTag(locale))}
    >
      {children ?? formatMoney(cents, currency, localeTag(locale))}

      {shown ? (
        <span
          role="status"
          className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg"
        >
          {egp ?? "…"}
        </span>
      ) : null}
    </span>
  );
}
