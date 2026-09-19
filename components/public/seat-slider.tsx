"use client";

import { useState } from "react";

import { PriceTag } from "@/components/money/price-tag";

/**
 * 🔴 76.72 — THE SLIDER INSIDE THE CLINIC CARD.
 *
 * A clinic's price is the one number on this page a visitor cannot read off a
 * card, because it depends on how many people they have. The band table further
 * down the page answers it exhaustively; this answers it in the two seconds
 * somebody spends on a pricing card, which is when the question is actually
 * asked.
 *
 * ## It computes nothing, for the same reason `SeatLadder` computes nothing
 *
 * It is handed one monthly figure per seat count, worked out on the server by
 * `seatMonthlyCents` over `platform_settings`, and it indexes into that list.
 * Doing the arithmetic here would give this product two implementations of the
 * retroactive seat rule, one that bills and one that quotes, and C60 is the
 * record of what a public page keeping its own copy of a number costs.
 */
export function SeatSlider({
  monthlyByCount,
  rateMicro,
  locale,
  label,
  countLabels,
}: {
  /** Index 0 is one seat. Server-computed, one entry per count. */
  monthlyByCount: number[];
  rateMicro: number | null;
  locale: string;
  label: string;
  /** One label per slider position, resolved on the server. C353. */
  countLabels: string[];
}) {
  /* Starts at three: the shape of a practice rather than the cheapest row. */
  const [count, setCount] = useState(Math.min(3, monthlyByCount.length));
  const selected = monthlyByCount[count - 1] ?? 0;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <PriceTag usdCents={selected} rateMicro={rateMicro} locale={locale} size="lg" />
      </div>
      <p className="mt-1 text-sm text-slate-600">{countLabels[count - 1] ?? ""}</p>

      <label htmlFor="seat-card-slider" className="sr-only">
        {label}
      </label>
      <input
        id="seat-card-slider"
        type="range"
        min={1}
        max={monthlyByCount.length}
        value={count}
        onChange={(event) => { setCount(Number(event.target.value)); }}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500"
      />
    </div>
  );
}
