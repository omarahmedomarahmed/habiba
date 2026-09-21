"use client";

import { useState } from "react";

import { Card } from "@/components/ui";
import { Money } from "@/components/ui/money";

/**
 * What actually happened, month by month, in the shape the forecast uses.
 *
 * ## 🔴 THE SAME COLUMNS AS `/admin/financial-model`, ON PURPOSE
 *
 * Month, therapists, sessions, revenue, AI, salaries, net, cash. A reader
 * holding the two screens side by side is doing the only thing worth doing with
 * a forecast, and a column that appears on one and not the other makes that
 * comparison an argument about layout.
 *
 * ## 🔴 AND A ROW THE FORECAST DOES NOT HAVE: money that is not ours
 *
 * VAT collected, what clinicians are owed, and employer pot balances. All three
 * are in the bank and none of them is revenue, and the single commonest way a
 * young company believes it is profitable is by looking at a balance that
 * includes other people's money. It is behind a toggle rather than in the main
 * table because it is not part of the result, and putting it in the same row of
 * figures would invite exactly the addition it exists to prevent.
 *
 * ## C84
 *
 * Nothing here calls `toLocaleString` or `Intl`. Counts are plain integers
 * rendered as strings; every money figure goes through `Money`, which formats
 * with an explicit locale and reveals the pound value off the operator's rate.
 */

export type ActualRow = {
  month: string;
  index: number;
  sessions: number;
  therapists: number;
  patients: number;
  recordedSessions: number;
  sessionRevenueCents: number;
  subscriptionRevenueCents: number;
  otherRevenueCents: number;
  revenueCents: number;
  aiCostMicrocents: number;
  payrollCents: number;
  headcount: number;
  otherSpendCents: number;
  fxCents: number;
  typedCostsCents: number;
  spendCents: number;
  netCents: number;
  cashMovedCents: number;
  cashCents: number;
  capitalInCents: number;
  bankBalanceCents: number;
  heldForOthersCents: number;
  oursCents: number;
  vatCollectedCents: number;
  owedToCliniciansCents: number;
  potMovementCents: number;
};

export function ActualsTable({
  months,
  totals,
  notMeasured,
}: {
  months: ActualRow[];
  totals: {
    sessions: number;
    revenueCents: number;
    aiCostMicrocents: number;
    payrollCents: number;
    otherSpendCents: number;
    typedCostsCents: number;
    spendCents: number;
    netCents: number;
    capitalInCents: number;
  };
  notMeasured: readonly { what: string; why: string; fix: string }[];
}) {
  const [showHeld, setShowHeld] = useState(false);

  if (months.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-base font-semibold text-slate-900">Month by month</h2>
        <p className="mt-1 text-sm text-slate-500">
          No session, no payment, no model call, nobody on the payroll.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Month by month</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Counted, never assumed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHeld((was) => !was)}
          className="text-xs text-slate-500 underline"
        >
          {showHeld ? "Hide" : "Not ours"}
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 text-start font-medium">Month</th>
              <th className="py-2 text-end font-medium">Therapists</th>
              <th className="py-2 text-end font-medium">Sessions</th>
              <th className="py-2 text-end font-medium">Earned</th>
              <th className="py-2 text-end font-medium">AI</th>
              <th className="py-2 text-end font-medium">Salaries</th>
              <th className="py-2 text-end font-medium">Other</th>
              <th className="py-2 text-end font-medium">Spent</th>
              <th className="py-2 text-end font-medium">Net</th>
              {/*
                🔴 "TRADING" AND NOT "CASH", and the rename is the fix.

                This column is the `cash` ledger account accumulated from zero:
                what six months of trading did to the balance. Headed "Cash" it
                read as the bank balance, which it is not and never was — the
                money the founders put in has never been in it. The balance now
                has its own card above, and this column says what it is.
              */}
              <th className="py-2 text-end font-medium">Trading</th>
              <th className="py-2 text-end font-medium">Ours</th>
              {showHeld && <th className="py-2 text-end font-medium">VAT held</th>}
              {showHeld && <th className="py-2 text-end font-medium">Owed out</th>}
              {showHeld && <th className="py-2 text-end font-medium">Pots</th>}
            </tr>
          </thead>
          <tbody>
            {months.map((row) => (
              <tr key={row.month} className="border-b border-slate-100">
                <td className="py-2 text-slate-600 tabular-nums">{row.month}</td>
                <td className="py-2 text-end tabular-nums text-slate-600">{String(row.therapists)}</td>
                <td className="py-2 text-end tabular-nums text-slate-600">{String(row.sessions)}</td>
                <td className="py-2 text-end tabular-nums text-slate-900">
                  <Money cents={row.revenueCents} />
                </td>
                <td className="py-2 text-end tabular-nums text-slate-600">
                  {microcents(row.aiCostMicrocents)}
                </td>
                <td className="py-2 text-end tabular-nums text-slate-600">
                  <Money cents={row.payrollCents} />
                  {/*
                    🔴 THE MULTIPLICATION SIGN IS LOAD-BEARING, and the first draft
                    did not have it.

                    The headcount sat beside the wage bill as a bare number, so a
                    month costing $3,500 with seven people on the payroll rendered
                    as "$3,500 7" and read, in a right-aligned column of figures, as
                    $35,007. A margin is not a separator when both sides are digits.
                    Caught by screenshotting the page and reading it rather than by
                    asserting that it rendered, which is this repository's whole
                    argument about §6 in one cell.
                  */}
                  {row.headcount > 0 && (
                    <span className="ms-1.5 text-xs text-slate-500">×{String(row.headcount)}</span>
                  )}
                </td>
                <td className="py-2 text-end tabular-nums text-slate-600">
                  <Money cents={row.otherSpendCents + row.fxCents + row.typedCostsCents} />
                  {/*
                    🔴 A MONTH WITH NOTHING TYPED IN IS NOT A MONTH WITH NO
                    OVERHEADS, and a blank cell says the opposite. Video, the
                    bank's charge and hosting reach this page only when somebody
                    types them, so the months nobody has typed carry a mark and
                    the editor at the bottom names them.
                  */}
                  {row.typedCostsCents === 0 && (
                    <span className="ms-1 text-xs text-amber-700" title="nothing typed in">
                      ?
                    </span>
                  )}
                </td>
                <td className="py-2 text-end tabular-nums text-slate-600">
                  <Money cents={row.spendCents} />
                </td>
                <td
                  className={`py-2 text-end font-medium tabular-nums ${
                    row.netCents < 0 ? "text-rose-700" : "text-brand-700"
                  }`}
                >
                  <Money cents={row.netCents} />
                </td>
                <td className="py-2 text-end tabular-nums text-slate-600">
                  <Money cents={row.cashCents} />
                </td>
                <td
                  className={`py-2 text-end tabular-nums ${
                    row.oursCents < 0 ? "text-rose-700" : "text-slate-900"
                  }`}
                >
                  <Money cents={row.oursCents} />
                </td>
                {showHeld && (
                  <td className="py-2 text-end tabular-nums text-slate-500">
                    <Money cents={row.vatCollectedCents} />
                  </td>
                )}
                {showHeld && (
                  <td className="py-2 text-end tabular-nums text-slate-500">
                    <Money cents={row.owedToCliniciansCents} />
                  </td>
                )}
                {showHeld && (
                  <td className="py-2 text-end tabular-nums text-slate-500">
                    <Money cents={row.potMovementCents} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-medium">
              <td className="py-2 text-slate-900">Total</td>
              <td className="py-2" />
              <td className="py-2 text-end tabular-nums text-slate-900">{String(totals.sessions)}</td>
              <td className="py-2 text-end tabular-nums text-slate-900">
                <Money cents={totals.revenueCents} />
              </td>
              <td className="py-2 text-end tabular-nums text-slate-600">
                {microcents(totals.aiCostMicrocents)}
              </td>
              <td className="py-2 text-end tabular-nums text-slate-600">
                <Money cents={totals.payrollCents} />
              </td>
              <td className="py-2 text-end tabular-nums text-slate-600">
                <Money cents={totals.otherSpendCents + totals.typedCostsCents} />
              </td>
              <td className="py-2 text-end tabular-nums text-slate-600">
                <Money cents={totals.spendCents} />
              </td>
              <td
                className={`py-2 text-end tabular-nums ${
                  totals.netCents < 0 ? "text-rose-700" : "text-brand-700"
                }`}
              >
                <Money cents={totals.netCents} />
              </td>
              <td className="py-2" />
              <td className="py-2" />
              {showHeld && <td className="py-2" />}
              {showHeld && <td className="py-2" />}
              {showHeld && <td className="py-2" />}
            </tr>
          </tfoot>
        </table>
      </div>

      {showHeld && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          None of the three is revenue: a tax authority's, clinicians', employers'. In the bank,
          not ours.
        </p>
      )}

      {/*
        🔴 WHAT IS MISSING, BESIDE THE TABLE AND NOT UNDER IT.
        A table with no "assumed" badges reads as complete, so the gaps have to
        be as visible as the figures. Each one says what would make it appear.
      */}
      <div className="mt-4 rounded-lg bg-amber-50 p-3">
        <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">
          Not counted
        </p>
        <ul className="mt-1 space-y-1">
          {notMeasured.map((gap) => (
            <li key={gap.what} className="text-xs leading-relaxed text-amber-900">
              <strong>{gap.what}:</strong> {gap.why} <em>Fix: {gap.fix}.</em>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/**
 * 🔴 Model spend is carried in microcents all the way here, because 91% of calls
 * round to zero in whole cents and a table of zeroes is how the old usage report
 * came to be believed.
 */
function microcents(value: number): string {
  const dollars = value / 100_000;
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}c`;
  return `${(value / 1000).toFixed(2)}c`;
}
