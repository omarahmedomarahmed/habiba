"use client";

import { useEffect, useRef, useState } from "react";

import { useMoneyDisplay } from "@/components/money/display";
import { useLocale } from "@/lib/i18n/client";
import { localeTag } from "@/lib/i18n/config";
import { formatDisplay, moneyLabels, type DisplayCurrency } from "@/lib/money/convert";

/**
 * 🔴 EVERY AMOUNT IN THE PRODUCT, IN THE READER'S CURRENCY, THAT TELLS ITS OTHER ONE.
 *
 * The books are kept in dollars. Everybody using the product in Egypt reads
 * pounds, so pounds lead and the dollars are one hover or one tap away on the
 * figure itself; the website and the console lead with dollars and reveal the
 * pounds the same way (`MoneyDisplayProvider`).
 *
 * The pounds are the same integer arithmetic on the same operator rate that a
 * transfer or a card is asked for (`lib/money/convert.ts`), and the rate comes
 * from the server with the page. With no rate, the stored figure is shown as
 * it is and nothing is revealed.
 *
 * Formatted with the reader's language tag, never the machine's (C84), so
 * the server pass and the browser pass print the same bytes.
 */
export function Money({
  cents,
  /** The currency the stored figure is in. Dollars unless a column says otherwise. */
  currency = "USD",
  className,
}: {
  cents: number;
  currency?: string;
  className?: string;
}) {
  const locale = useLocale();
  const { primary, rateMicro } = useMoneyDisplay();
  const code = currency.toUpperCase();
  const tag = localeTag(locale);
  /* A figure settled in any other currency is that currency, and there is nothing to reveal. */
  const known = code === "EGP" || code === "USD";
  const { shown, other } = known
    ? moneyLabels({ minor: cents, amountIn: code as DisplayCurrency, primary, rateMicro, locale: tag })
    : { shown: formatDisplay(cents, code, tag), other: null };
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = () => setOpen(true);
  /* A short hold, so a pointer crossing a table does not flash every cell. */
  const onEnter = () => {
    timer.current = setTimeout(reveal, 250);
  };
  const onLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (!other) return <span className={className}>{shown}</span>;
  return (
    <span
      className={`relative inline-flex cursor-help items-baseline underline decoration-dotted decoration-slate-300 underline-offset-4 ${className ?? ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={reveal}
      onBlur={onLeave}
      /* A phone has no hover. A tap toggles. */
      onClick={(event) => {
        event.stopPropagation();
        setOpen((was) => !was);
      }}
      tabIndex={0}
      role="button"
      aria-label={`${shown}, ${other}`}
    >
      {shown}
      {open ? (
        <span
          role="status"
          className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg"
        >
          {other}
        </span>
      ) : null}
    </span>
  );
}
