"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  addCapitalAction,
  removeCapitalAction,
  setOtherCostAction,
  type PayrollActionState,
} from "@/app/(admin)/admin/actuals/actions";
import { Button, Card, Input } from "@/components/ui";
import { Money } from "@/components/ui/money";

/**
 * The two things a founder types that nothing in the product can know.
 *
 * ## 🔴 CAPITAL IN, because the balance was wrong without it
 *
 * `/admin/actuals` accumulated the `cash` ledger account from zero, so a company
 * that raised money and spent some of it reported a large negative balance. That
 * sum was right about the rows it had and silent about the one row nothing ever
 * writes: money arriving in a bank account because somebody put it there.
 *
 * ## 🔴 OTHER COSTS, and the amber line is the point
 *
 * Video, the bank's charge on a transfer, hosting, an accountant. Nothing in the
 * product buys any of them, so a month with no figure typed is a month nobody
 * typed, NOT a month that cost nothing. The list below says which months are
 * empty by name, because a blank in a table reads as a zero and this one is not.
 *
 * ## C84
 *
 * No `toLocaleString`, no `Intl`. Money through `Money`, months as plain strings
 * the server produced.
 */

export type CapitalRow = {
  id: string;
  amountCents: number;
  receivedOn: string;
  source: string;
  note: string | null;
};

export type OtherCostRow = {
  id: string;
  kind: string;
  month: string;
  amountCents: number;
  note: string | null;
};

export function BankEditor({
  capital,
  costs,
  kinds,
  months,
  thisMonth,
}: {
  capital: CapitalRow[];
  costs: OtherCostRow[];
  /** Every kind, with what it is for, from the server. */
  kinds: { value: string; label: string; hint: string }[];
  /** Every `YYYY-MM` the business has had, newest last. */
  months: string[];
  /** `YYYY-MM-01` from the server, never a browser's idea of today. */
  thisMonth: string;
}) {
  const [adding, setAdding] = useState(false);
  const totalIn = capital.reduce((sum, row) => sum + row.amountCents, 0);

  /*
   * 🔴 THE MONTHS WITH NOTHING TYPED, NAMED.
   *
   * The reason this list exists rather than a count: "3 months missing" is a
   * number somebody nods at, and "2026-04, 2026-05, 2026-06" is a list somebody
   * fills in.
   */
  const typedIn = new Set(costs.map((row) => row.month));
  const empty = months.filter((month) => !typedIn.has(month));

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Money in that is not revenue</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {capital.length === 0 ? (
                "Nothing recorded yet."
              ) : (
                <>
                  <Money cents={totalIn} /> put in, across {String(capital.length)}{" "}
                  {capital.length === 1 ? "contribution" : "contributions"}.
                </>
              )}
            </p>
          </div>
          <Button type="button" onClick={() => setAdding((was) => !was)}>
            {adding ? "Close" : "Add"}
          </Button>
        </div>

        {adding && <AddCapitalForm thisMonth={thisMonth} onDone={() => setAdding(false)} />}

        {capital.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">Arrived</th>
                  <th className="py-2 text-start font-medium">Whose</th>
                  <th className="py-2 text-end font-medium">Amount</th>
                  {/*
                    🔴 ps-6 ON BOTH THE HEADER AND THE CELL, and it is the same
                    defect as the `$3,500 7` salary cell one screen up.

                    A right-aligned money column against a left-aligned text
                    column with nothing between them renders as
                    "$25,000the money we started with", and the header renders as
                    "AmountNote". Found by screenshotting the page and reading
                    it, which is the only thing that finds this class of bug.
                  */}
                  <th className="py-2 ps-6 text-start font-medium">Note</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {capital.map((row) => (
                  <CapitalRowView key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Savings, an angel cheque, a grant. In the bank, never revenue.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="text-base font-semibold text-slate-900">
          Costs nothing in the product buys
        </h2>
        {/*
          🔴 ONE LINE, NOT ONE PER BLOCK. "Typing 0 against a month removes that
          month's figure" was under each of the seven kinds, which is the same
          sentence seven times and sixty-three words of a console that has no
          room to spare. A rule that applies to every block belongs above them.
        */}
        <p className="mt-0.5 text-sm text-slate-500">
          Type each month&apos;s figure; 0 removes one. A blank is nobody typed it, not nothing
          spent.
        </p>

        {empty.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3">
            <p className="text-xs leading-relaxed text-amber-900">
              <strong>No figure typed for {String(empty.length)} of them:</strong>{" "}
              {empty.join(", ")}. Those read above as months that cost nothing.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {kinds.map((kind) => (
            <KindBlock
              key={kind.value}
              kind={kind}
              rows={costs.filter((row) => row.kind === kind.value)}
              months={months}
              thisMonth={thisMonth.slice(0, 7)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function CapitalRowView({ row }: { row: CapitalRow }) {
  const [state, action] = useActionState<PayrollActionState, FormData>(removeCapitalAction, {});

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 tabular-nums text-slate-600">{row.receivedOn.slice(0, 7)}</td>
      <td className="py-2 font-medium text-slate-900">{row.source}</td>
      <td className="py-2 text-end tabular-nums text-slate-900">
        <Money cents={row.amountCents} />
      </td>
      <td className="py-2 ps-6 text-slate-500">{row.note ?? ""}</td>
      <td className="py-2 text-end">
        <form action={action}>
          <input type="hidden" name="id" value={row.id} />
          <SubmitButton label="Remove" />
        </form>
        {state.error && <p className="text-xs text-rose-700">{state.error}</p>}
      </td>
    </tr>
  );
}

function AddCapitalForm({ thisMonth, onDone }: { thisMonth: string; onDone: () => void }) {
  const [state, action] = useActionState<PayrollActionState, FormData>(addCapitalAction, {});

  if (state.ok) {
    return (
      <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
        {state.ok}{" "}
        <button type="button" onClick={onDone} className="underline">
          Close
        </button>
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="text-slate-600">Whose money</span>
        <Input name="source" required placeholder="founders" />
      </label>
      <label className="text-sm">
        <span className="text-slate-600">Amount, in dollars</span>
        <Input name="amount" type="number" step="0.01" min="0.01" required />
      </label>
      <label className="text-sm">
        <span className="text-slate-600">When it arrived</span>
        <Input name="receivedOn" type="date" defaultValue={thisMonth} required />
      </label>
      <label className="text-sm">
        <span className="text-slate-600">Note</span>
        <Input name="note" placeholder="optional" />
      </label>
      <div className="sm:col-span-2">
        <SubmitButton label="Record it" />
        {state.error && <p className="mt-1 text-sm text-rose-700">{state.error}</p>}
      </div>
    </form>
  );
}

function KindBlock({
  kind,
  rows,
  months,
  thisMonth,
}: {
  kind: { value: string; label: string; hint: string };
  rows: OtherCostRow[];
  months: string[];
  thisMonth: string;
}) {
  const [state, action] = useActionState<PayrollActionState, FormData>(setOtherCostAction, {});
  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{kind.label}</p>
          <p className="text-xs text-slate-500">{kind.hint}</p>
        </div>
        <p className="text-sm tabular-nums text-slate-600">
          {rows.length === 0 ? (
            <span className="text-amber-700">nothing typed</span>
          ) : (
            <>
              <Money cents={total} /> over {String(rows.length)}{" "}
              {rows.length === 1 ? "month" : "months"}
            </>
          )}
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded bg-slate-100 px-2 py-1 text-xs tabular-nums text-slate-700"
            >
              {row.month} <Money cents={row.amountCents} />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="kind" value={kind.value} />
        <label className="text-xs">
          <span className="text-slate-500">Month</span>
          <select
            name="month"
            defaultValue={thisMonth}
            className="block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-slate-500">Dollars</span>
          <Input name="amount" type="number" step="0.01" min="0" required className="w-28" />
        </label>
        <label className="text-xs grow">
          <span className="text-slate-500">Note</span>
          <Input name="note" placeholder="optional" />
        </label>
        <SubmitButton label="Save" />
      </form>

      {state.error && <p className="mt-1 text-sm text-rose-700">{state.error}</p>}
      {state.ok && <p className="mt-1 text-sm text-teal-700">{state.ok}</p>}
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving" : label}
    </Button>
  );
}
