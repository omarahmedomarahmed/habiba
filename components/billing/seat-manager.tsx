"use client";

import { useState, useTransition } from "react";

import { quoteSeats, saveSeats, type SeatState } from "@/app/(app)/billing/actions";
import { Button, Card } from "@/components/ui";

export type SeatQuote = {
  fromSeats: number;
  toSeats: number;
  fromMonthlyLabel: string;
  toMonthlyLabel: string;
  proratedLabel: string;
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
 */
export function SeatManager({
  seats,
  monthlyLabel,
  maxSeats = 20,
}: {
  seats: number;
  monthlyLabel: string;
  maxSeats?: number;
}) {
  const [wanted, setWanted] = useState(seats);
  const [quote, setQuote] = useState<SeatQuote | null>(null);
  const [state, setState] = useState<SeatState>({});
  const [pending, start] = useTransition();

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
      <h2 className="text-sm font-semibold text-slate-900">Seats</h2>
      <p className="mt-1 text-sm text-slate-600">
        {seats === 0
          ? "You are on your own plan. Add seats to bring colleagues onto one account."
          : `${seats} ${seats === 1 ? "seat" : "seats"}, ${monthlyLabel} a month.`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="range"
          min={0}
          max={maxSeats}
          value={wanted}
          onChange={(event) => ask(Number(event.target.value))}
          className="h-2 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-700"
          aria-label="Number of seats"
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
            {quote.toSeats} {quote.toSeats === 1 ? "seat" : "seats"} costs{" "}
            <strong className="font-semibold text-slate-900">{quote.toMonthlyLabel}</strong> a
            month, up from {quote.fromMonthlyLabel}.
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {quote.proratedCents > 0 ? (
              <>
                You pay{" "}
                <strong className="font-semibold text-slate-900">{quote.proratedLabel}</strong>{" "}
                now for the {quote.daysRemaining}{" "}
                {quote.daysRemaining === 1 ? "day" : "days"} left in this month.
              </>
            ) : quote.proratedCents < 0 ? (
              <>
                Removing seats does not refund this month. Your colleagues keep everything
                until it ends, and the smaller bill starts at renewal.
              </>
            ) : (
              <>Nothing to pay now. The new figure starts at renewal.</>
            )}
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-sm font-semibold text-teal-700">Saved.</p>
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
          {pending ? "Saving…" : `Change to ${quote.toSeats} seats`}
        </Button>
      ) : null}
    </Card>
  );
}
