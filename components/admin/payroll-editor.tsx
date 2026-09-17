"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  addEmployeeAction,
  endEmploymentAction,
  setSalaryAction,
  type PayrollActionState,
} from "@/app/(admin)/admin/actuals/actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Money } from "@/components/ui/money";

/**
 * The payroll, editable, under the month by month result it feeds.
 *
 * ## 🔴 EVERY FIGURE IS FORMATTED ON THE SERVER OR BY `Money`
 *
 * C84: no `"use client"` file may call `toLocaleString` or anything on `Intl`.
 * The runtime's locale is not the user's locale, the two passes disagree, and
 * the figure that flickers is a salary. `Money` takes cents and does the dollar
 * formatting with an explicit locale, and offers the pound conversion off the
 * operator's own rate.
 *
 * ## 🔴 A RAISE IS A NEW DATE, AND THE FORM SAYS SO
 *
 * The salary field sits next to a month, always, and the button says "Save from
 * this month". There is no edit-in-place, because there is no such thing here:
 * changing what somebody is paid is an event with a date, and a form that let a
 * founder change the number alone would be a form that quietly restated every
 * earlier month of the table above it.
 */

export type PayrollPerson = {
  id: string;
  name: string;
  title: string;
  queue: string | null;
  startedOn: string;
  endedOn: string | null;
  currentCents: number | null;
  history: { monthlyCents: number; effectiveFrom: string; note: string | null }[];
};

export function PayrollEditor({
  people,
  thisMonth,
  monthlyTotalCents,
}: {
  people: PayrollPerson[];
  /** `YYYY-MM-01`, from the server, so the default date is not a browser's idea of today. */
  thisMonth: string;
  /** What the payroll costs this month, so the table's own total is on the table. */
  monthlyTotalCents: number;
}) {
  const [open, setOpen] = useState(false);

  const here = people.filter((p) => !p.endedOn);
  const gone = people.filter((p) => p.endedOn);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Employees</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {here.length === 0
              ? "Nobody on the payroll, so the salaries column above is zero, not unknown."
              : `${here.length} on the payroll, costing `}
            {here.length > 0 && <Money cents={monthlyTotalCents} />}
            {here.length > 0 && " a month."}
          </p>
        </div>
        <Button type="button" onClick={() => setOpen((was) => !was)}>
          {open ? "Close" : "Add"}
        </Button>
      </div>

      {open && <AddForm thisMonth={thisMonth} onDone={() => setOpen(false)} />}

      {people.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 text-start font-medium">Name</th>
                <th className="py-2 text-start font-medium">Job</th>
                <th className="py-2 text-start font-medium">Queue</th>
                <th className="py-2 text-start font-medium">From</th>
                <th className="py-2 text-end font-medium">Salary</th>
                <th className="py-2 text-end font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {[...here, ...gone].map((person) => (
                <PersonRow key={person.id} person={person} thisMonth={thisMonth} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PersonRow({ person, thisMonth }: { person: PayrollPerson; thisMonth: string }) {
  const [state, action] = useActionState<PayrollActionState, FormData>(setSalaryAction, {});
  const [leave, leaveAction] = useActionState<PayrollActionState, FormData>(endEmploymentAction, {});
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
      <tr className={`border-b border-slate-100 ${person.endedOn ? "text-slate-400" : ""}`}>
        <td className="py-2">
          <span className={person.endedOn ? "" : "font-medium text-slate-900"}>{person.name}</span>
          {person.endedOn && (
            <Badge className="ms-2">left {person.endedOn.slice(0, 7)}</Badge>
          )}
        </td>
        <td className="py-2 text-slate-600">{person.title}</td>
        <td className="py-2 text-slate-600">{person.queue ?? "no queue"}</td>
        <td className="py-2 tabular-nums text-slate-600">{person.startedOn.slice(0, 7)}</td>
        <td className="py-2 text-end tabular-nums">
          {person.currentCents === null ? (
            <span className="text-amber-700">no salary set</span>
          ) : (
            <Money cents={person.currentCents} />
          )}
          {person.history.length > 1 && (
            <button
              type="button"
              onClick={() => setShowHistory((was) => !was)}
              className="ms-2 text-xs text-slate-500 underline"
            >
              {person.history.length} changes
            </button>
          )}
        </td>
        <td className="py-2">
          <form action={action} className="flex items-center justify-end gap-1">
            <input type="hidden" name="employeeId" value={person.id} />
            <Input
              name="salary"
              type="number"
              min="0"
              step="1"
              required
              className="w-24"
              aria-label="Salary"
            />
            <Input
              name="effectiveFrom"
              type="date"
              defaultValue={thisMonth}
              required
              className="w-36"
              aria-label="From"
            />
            <Save label="Save" />
          </form>
          {state.error && <p className="mt-1 text-end text-xs text-rose-700">{state.error}</p>}
          {state.ok && <p className="mt-1 text-end text-xs text-teal-700">{state.ok}</p>}

          <form action={leaveAction} className="mt-1 flex items-center justify-end gap-1">
            <input type="hidden" name="employeeId" value={person.id} />
            {person.endedOn ? (
              <>
                <input type="hidden" name="endedOn" value="" />
                <Save label="Return" />
              </>
            ) : (
              <>
                <Input
                  name="endedOn"
                  type="date"
                  className="w-36"
                  aria-label="Last month paid"
                />
                <Save label="They left" />
              </>
            )}
          </form>
          {leave.error && <p className="mt-1 text-end text-xs text-rose-700">{leave.error}</p>}
          {leave.ok && <p className="mt-1 text-end text-xs text-teal-700">{leave.ok}</p>}
        </td>
      </tr>

      {showHistory && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={6} className="px-2 py-2">
            <p className="text-xs text-slate-500">
              Each month is costed at the row in force that month.
            </p>
            <ul className="mt-1 space-y-0.5">
              {person.history.map((row) => (
                <li key={row.effectiveFrom} className="text-xs text-slate-600 tabular-nums">
                  {row.effectiveFrom.slice(0, 7)} <Money cents={row.monthlyCents} />
                  {row.note ? <span className="text-slate-400"> {row.note}</span> : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function AddForm({ thisMonth, onDone }: { thisMonth: string; onDone: () => void }) {
  const [state, action] = useActionState<PayrollActionState, FormData>(addEmployeeAction, {});

  if (state.ok) {
    /* Closing on the next render rather than during one. */
    queueMicrotask(onDone);
  }

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-5">
      {/*
        🔴 `aria-label` AND NO `placeholder`, which is one string each rather than
        two and the more correct carrier of the two. A placeholder disappears the
        moment somebody types, so a form that leans on one leaves a half-filled
        row of boxes nobody can name. 45.8: fewer English literals, better form.
      */}
      <Input name="name" required aria-label="Name" />
      <Input name="title" required aria-label="Job" />
      <Input name="queue" aria-label="Queue" />
      <Input name="salary" type="number" min="0" step="1" required aria-label="Salary" />
      <Input
        name="startedOn"
        type="date"
        defaultValue={thisMonth}
        required
        aria-label="From"
      />
      <div className="sm:col-span-5">
        <Save label="Add" />
        {state.error && <span className="ms-2 text-xs text-rose-700">{state.error}</span>}
        {state.ok && <span className="ms-2 text-xs text-teal-700">{state.ok}</span>}
      </div>
    </form>
  );
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving" : label}
    </Button>
  );
}
