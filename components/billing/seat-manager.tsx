"use client";

import { useState, useTransition } from "react";

import { Money } from "@/components/ui/money";
import { useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";

import { Button, Card } from "@/components/ui";
import { countForm } from "@/lib/i18n/count-form";

export type SeatState = { error?: string; ok?: boolean };

export type SeatQuote = {
  fromSeats: number;
  toSeats: number;
  fromMonthlyCents: number;
  toMonthlyCents: number;
  proratedCents: number;
  daysRemaining: number;
};

/**
 * Seats, and the figure before the click. PLAN.md 62.2 to 62.4, C323, C333, C351.
 *
 * ## 🔴 THE WHOLE RULING IS THE ORDER OF TWO THINGS
 *
 * Somebody picks a number, sees exactly what it costs today and what the
 * account costs a month from then on, and only then presses a button. A slider
 * that changed the count and then said what happened would satisfy every other
 * sentence in this sprint and miss the one that matters.
 *
 * ## 🔴 THE STEP AT THE FIRST BAND BOUNDARY IS NAMED, WHATEVER IT IS
 *
 * Because the rate is retroactive. On the shipped ladder the boundary is seat
 * two and the step is $64 rather than $72: $80 becomes $144, because the first
 * seat reprices from the solo rate to the clinic rate the moment there are two
 * of them. A practice adding their second clinician and finding a number they
 * did not expect is a support ticket and a refund conversation, and the slider
 * is where that is cheapest to prevent. The figure is computed from the bands,
 * never written, so a reprice cannot leave a wrong number on the screen.
 *
 * 🔴 W2-C02: THE ACTIONS ARE PASSED IN. This component imported the solo
 * portal's actions, which W1-02 made refuse a clinic, so the one seat control
 * in the product could not be offered to the clinic admin who owns the seats.
 * Each portal now hands it its own pair, both over `quoteSeatChange` and
 * `applySeatChange`.
 */
export function SeatManager({
  seats,
  monthlyLabel,
  maxSeats = 20,
  quoteSeats,
  saveSeats,
}: {
  seats: number;
  monthlyLabel: React.ReactNode;
  maxSeats?: number;
  quoteSeats: (toSeats: number) => Promise<{ quote?: SeatQuote; error?: string }>;
  saveSeats: (fromSeats: number, toSeats: number) => Promise<SeatState>;
}) {
  const [wanted, setWanted] = useState(seats);
  const [quote, setQuote] = useState<SeatQuote | null>(null);
  const [state, setState] = useState<SeatState>({});
  const [pending, start] = useTransition();
  const t = useT();

  const ask = (next: number) => {
    setWanted(next);
    setQuote(null);
    setState({});
    if (next === seats) return;

    start(async () => {
      const result = await quoteSeats(next);
      if (result.quote) setQuote(result.quote);
      else setState({ error: result.error });
    });
  };

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">{t("seats.title")}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {/*
          🔴 B16 — the count and the bill, at every count, zero included. At
          zero this printed the solo plan's sentence on a practice's page and
          no price at all.
        */}
        {rich(t(`seats.now${countForm(seats)}`, { count: seats, monthly: slot(0) }), [monthlyLabel])}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="range"
          min={0}
          max={maxSeats}
          value={wanted}
          onChange={(event) => ask(Number(event.target.value))}
          className="h-2 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-700"
          aria-label={t("seats.slider")}
        />
        <span className="text-2xl font-bold tabular-nums text-slate-900">{wanted}</span>
      </div>

      {/*
        🔴 The figure, before the button. Two numbers and never one: what is
        owed today, and what the account costs a month from now on. A single
        prorated figure tells somebody what they are about to be charged and
        nothing about what they have agreed to.
      */}
      {quote ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            {rich(t(`seats.quote${countForm(quote.toSeats)}`, { count: quote.toSeats, to: slot(0), from: slot(1) }), [
              <Money cents={quote.toMonthlyCents} />,
              <Money cents={quote.fromMonthlyCents} />,
            ])}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {quote.proratedCents > 0 ? (
              rich(t("seats.payNow", { amount: slot(0), days: quote.daysRemaining }), [
                <Money cents={Math.abs(quote.proratedCents)} />,
              ])
            ) : quote.proratedCents < 0 ? (
              t("seats.noRefund")
            ) : (
              t("seats.nothingNow")
            )}
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm font-semibold text-brand-700">{t("common.saved")}</p>
      ) : null}

      {quote ? (
        <Button
          type="button"
          className="mt-4"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await saveSeats(quote.fromSeats, quote.toSeats);
              setState(result);
              if (result.ok) setQuote(null);
            });
          }}
        >
          {pending ? t("common.saving") : t(`seats.change${countForm(quote.toSeats)}`, { count: quote.toSeats })}
        </Button>
      ) : null}
    </Card>
  );
}
