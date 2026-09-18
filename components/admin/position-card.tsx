"use client";

import { Card } from "@/components/ui";
import { Money } from "@/components/ui/money";
import type { Position } from "@/lib/data/actuals";

/**
 * Where the company stands, in the four numbers a founder opens this page for.
 *
 * ## 🔴 THE BALANCE AND WHAT IS SPENDABLE ARE TWO NUMBERS, SIDE BY SIDE
 *
 * The bank account holds VAT collected and not yet remitted, everything
 * clinicians have earned and not been paid, and every employer's unspent pot.
 * All of it is one balance and none of it can be spent, and the commonest way a
 * young company convinces itself it has a year of runway is by dividing the
 * whole balance by the burn.
 *
 * So the big figure is **ours**, the balance sits beside it as the smaller
 * number, and the held amount is subtracted in the open. Putting the balance in
 * the large type and the deduction in a footnote would be the same screen
 * arranged to mislead.
 *
 * ## 🔴 AND WHY THE TABLE BELOW STILL SAYS "CASH"
 *
 * That column is what TRADING did to the balance, accumulated, which is the
 * figure that belongs beside a month's earnings and spending. This card is the
 * balance itself. Two different questions, and the version of this page that had
 * only the first answered the second by accident and got it wrong by exactly the
 * amount the founders had put in.
 *
 * ## C84
 *
 * No `toLocaleString`, no `Intl`. Every money figure goes through `Money`, and
 * the runway is a number of months printed by hand with one decimal.
 */
export function PositionCard({ position, months }: { position: Position; months: number }) {
  const {
    bankBalanceCents,
    heldForOthersCents,
    oursCents,
    capitalInCents,
    monthlyBurnCents,
    burnWindowMonths,
    runwayMonths,
    deepestCents,
    deepestMonth,
  } = position;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Where we stand</h2>
        <p className="text-xs text-slate-500">
          {months === 0
            ? "Nothing has traded yet."
            : `Counted over ${String(months)} ${months === 1 ? "month" : "months"}.`}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Ours to spend"
          tone={oursCents < 0 ? "bad" : "good"}
          value={<Money cents={oursCents} />}
          note="The balance, less everything somebody else can ask for"
        />
        <Figure
          label="In the bank"
          value={<Money cents={bankBalanceCents} />}
          note={
            <>
              of which <Money cents={heldForOthersCents} /> is not ours
            </>
          }
        />
        <Figure
          label="Burning"
          tone={monthlyBurnCents === null ? "good" : "plain"}
          value={
            monthlyBurnCents === null ? (
              <span className="text-teal-700">nothing</span>
            ) : (
              <>
                <Money cents={monthlyBurnCents} />
                <span className="text-sm font-normal text-slate-400"> /mo</span>
              </>
            )
          }
          note={
            monthlyBurnCents === null
              ? `The last ${String(burnWindowMonths)} ${burnWindowMonths === 1 ? "month" : "months"} made money`
              : `Average of the last ${String(burnWindowMonths)} ${burnWindowMonths === 1 ? "month" : "months"}, not the last one`
          }
        />
        <Figure
          label="Runway"
          tone={runwayMonths !== null && runwayMonths < 3 ? "bad" : "plain"}
          value={
            runwayMonths === null ? (
              <span className="text-teal-700">no burn</span>
            ) : (
              <>
                {runwayMonths.toFixed(1)}
                <span className="text-sm font-normal text-slate-400"> months</span>
              </>
            )
          }
          note={
            runwayMonths === null
              ? "A runway for a company that is not burning is not a number"
              : "Ours, divided by the burn. Never the whole balance"
          }
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Put in so far: <Money cents={capitalInCents} />.{" "}
        {deepestMonth !== null && deepestCents < oursCents ? (
          <>
            The lowest we have been is <Money cents={deepestCents} /> in {deepestMonth}.
          </>
        ) : (
          <>This is the lowest we have been.</>
        )}{" "}
        <span className="text-slate-400">
          The forecast next door produces these same four from assumptions. Read them side by
          side; do not average them.
        </span>
      </p>
    </Card>
  );
}

function Figure({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: React.ReactNode;
  note: React.ReactNode;
  tone?: "good" | "bad" | "plain";
}) {
  const colour =
    tone === "bad" ? "text-rose-700" : tone === "good" ? "text-teal-700" : "text-slate-900";

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${colour}`}>{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}
