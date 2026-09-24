"use client";

import { useState } from "react";

import { PriceTag } from "@/components/money/price-tag";

export type SeatBandRow = {
  /** "1 to 2", "5 or more". Built on the server, in the reader's language. */
  range: string;
  /** "Included" or "$80 each". */
  rate: React.ReactNode;
  /** The monthly figure at the first count in this band, in USD cents. */
  monthlyCents: number;
};

/**
 * The seat ladder on the public pricing page. PLAN.md 62.10, C323.
 *
 * ## 🔴 THE SLIDER COMPUTES NOTHING
 *
 * It is handed one monthly figure per seat count, worked out on the server by
 * `seatMonthlyCents` from `platform_settings`, and it indexes into that list.
 *
 * The obvious build passes the bands down and does the arithmetic here, which
 * gives this product two implementations of the retroactive rule: one that bills
 * and one that quotes. C60 is what happens when a public page keeps its own copy
 * of a number, and this is the same hazard with an extra step, because a second
 * implementation can be correct on the day it is written and drift on the day the
 * rule changes.
 *
 * So the client holds an index and nothing else. The figure a visitor drags to is
 * the figure `currentSeatBill` would charge them, because it is the same call.
 */
export function SeatLadder({
  rows,
  monthlyByCount,
  rateMicro,
  locale,
  strings,
}: {
  rows: SeatBandRow[];
  /** Index 0 is one seat. Worked out on the server, one per count. */
  monthlyByCount: number[];
  rateMicro: number | null;
  locale: string;
  strings: {
    headSeats: string;
    headRate: string;
    headMonthly: string;
    sliderLabel: string;
    /**
     * 🔴 C353 — ONE LABEL PER SLIDER POSITION, NOT A FUNCTION.
     *
     * This was `seats: (count: number) => string`, and the comment at the call
     * site explained why: the plural should be decided where the dictionary is,
     * on the server, rather than by a client component gluing two strings
     * together. The reasoning was right and the mechanism could not work. A
     * function cannot cross into a client component, so React threw
     * "Functions cannot be passed directly to Client Components" while
     * rendering, and `/pricing` returned 500 in production from the day the
     * seat ladder shipped until C353.
     *
     * The intention survives exactly, in the shape `monthlyByCount` already
     * uses on the prop above it: the server resolves every label it could need,
     * one per slider position, and hands over an array. Plural rules stay in
     * the dictionary, and a language with six plural forms is served correctly
     * because `t` is called per count with the real number.
     */
    seatsByCount: string[];
  };
}) {
  const [count, setCount] = useState(Math.min(3, monthlyByCount.length));
  const selected = monthlyByCount[count - 1] ?? 0;

  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {/*
        🔴 `overflow-x-auto` on the table and not on the page. Three columns of
        figures at 360px is the one thing on this page that cannot be made
        narrower without lying about a number.
      */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* 🔴 19.3 — `text-start`, never `text-left`. Arabic is a layout. */}
            <tr className="border-b border-slate-200 text-start text-xs uppercase tracking-wide text-slate-600">
              <th scope="col" className="px-5 py-3 font-medium">
                {strings.headSeats}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {strings.headRate}
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                {strings.headMonthly}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.range} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-900">{row.range}</td>
                <td className="px-5 py-3 text-slate-600">{row.rate}</td>
                <td className="px-5 py-3">
                  <PriceTag usdCents={row.monthlyCents} rateMicro={rateMicro} locale={locale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
        <label
          htmlFor="seat-ladder"
          className="text-xs font-medium uppercase tracking-wide text-slate-600"
        >
          {strings.sliderLabel}
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <input
            id="seat-ladder"
            type="range"
            min={1}
            max={monthlyByCount.length}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="h-2 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-700"
          />
          <span className="text-sm font-medium tabular-nums text-slate-700">
            {strings.seatsByCount[count - 1] ?? ""}
          </span>
          <PriceTag usdCents={selected} rateMicro={rateMicro} locale={locale} size="lg" />
        </div>
      </div>
    </div>
  );
}
