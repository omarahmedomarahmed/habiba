"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveTransferFields } from "@/app/(admin)/admin/settings/actions";
import { Button, Card } from "@/components/ui";

/**
 * The bank details a payer is shown, in the operator's own words. 73.11.
 *
 * ## 🔴 THE LABEL IS A FIELD, NOT A CONSTANT
 *
 * Which rails an Egyptian bank offers this quarter is not something a deploy
 * should be needed to keep up with. An operator adds a row, names it "InstaPay
 * handle" or "Mobile wallet number", puts the number in, writes an example
 * underneath, and ticks who sees it.
 *
 * ## 🔴 AND IT IS LOCKED WHILE ANYBODY IS TRANSFERRING
 *
 * The refusal comes from the server, with the count in it. Editing the account
 * number while eleven people are mid-transfer sends eleven real payments into an
 * account we are no longer checking, and there is no processor to ask about it.
 */
type Field = {
  key: string;
  label: string;
  value: string;
  hint: string;
  labelAr?: string;
  hintAr?: string;
  audiences: string[];
};

const WHO = [
  ["patient", "Patients"],
  ["therapist", "Therapists"],
  ["clinic", "Clinics"],
  ["company", "Companies"],
] as const;

export function TransferFieldsEditor({
  fields,
  cardsComingSoon,
  inFlight,
}: {
  fields: Field[];
  cardsComingSoon: boolean;
  /** How many payments are mid-transfer. Above zero, the form is read-only. */
  inFlight: number;
}) {
  const [state, action] = useActionState(saveTransferFields, {} as { error?: string; ok?: string });
  const [rows, setRows] = useState<Field[]>(
    fields.length > 0
      ? fields
      : [{ key: "", label: "", value: "", hint: "", audiences: ["patient", "therapist", "clinic", "company"] }],
  );

  const locked = inFlight > 0;

  const edit = (i: number, patch: Partial<Field>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const move = (i: number, by: number) => {
    const next = [...rows];
    const target = i + by;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target]!, next[i]!];
    setRows(next);
  };

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">How Egypt pays us</p>
      <p className="mt-1 text-xs text-slate-500">
        Shown in this order.
      </p>

      {locked ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {inFlight} payment{inFlight === 1 ? "" : "s"} in flight against these details. Clear the
          transfers queue before editing.
        </p>
      ) : null}

      <form action={action} className="mt-3 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl bg-slate-50 p-3">
            <input type="hidden" name="fieldKey" value={row.key} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                What to call it
                <input
                  name="fieldLabel"
                  value={row.label}
                  disabled={locked}
                  onChange={(e) => edit(i, { label: e.target.value })}
                  placeholder="InstaPay handle"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm disabled:bg-slate-100"
                />
              </label>
              <label className="text-xs text-slate-600">
                What it is
                <input
                  name="fieldValue"
                  value={row.value}
                  disabled={locked}
                  onChange={(e) => edit(i, { value: e.target.value })}
                  placeholder="24therapy@instapay"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-sm disabled:bg-slate-100"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-slate-600">
              Note underneath it
              <input
                name="fieldHint"
                value={row.hint}
                disabled={locked}
                onChange={(e) => edit(i, { hint: e.target.value })}
                placeholder="Find this under Send in your bank app"
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm disabled:bg-slate-100"
              />
            </label>
            {/*
              🔴 Board 364: what an Arabic reader sees. Optional: left empty, the
              name above is shown as typed and the note is left out, so an
              Arabic payment screen never carries an English sentence.
            */}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                Arabic name
                <input
                  name="fieldLabelAr"
                  dir="rtl"
                  value={row.labelAr ?? ""}
                  disabled={locked}
                  onChange={(e) => edit(i, { labelAr: e.target.value })}
                  placeholder="إنستاباي"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm disabled:bg-slate-100"
                />
              </label>
              <label className="text-xs text-slate-600">
                Arabic note
                <input
                  name="fieldHintAr"
                  dir="rtl"
                  value={row.hintAr ?? ""}
                  disabled={locked}
                  onChange={(e) => edit(i, { hintAr: e.target.value })}
                  placeholder="الأسرع"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm disabled:bg-slate-100"
                />
              </label>
            </div>

            {/*
              🔴 WHO SEES IT. A patient does not need the corporate account and a
              finance team does not need the wallet number. Showing everybody
              everything is how somebody pays into the wrong one.
            */}
            <input type="hidden" name="fieldAudiences" value={row.audiences.join(",")} />
            <div className="mt-2 flex flex-wrap gap-2">
              {WHO.map(([key, label]) => {
                const on = row.audiences.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      edit(i, {
                        audiences: on
                          ? row.audiences.filter((a) => a !== key)
                          : [...row.audiences, key],
                      })
                    }
                    className={
                      on
                        ? "rounded-full bg-brand-500 px-2.5 py-1 text-xs font-medium text-navy-600 disabled:opacity-50"
                        : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-50"
                    }
                  >
                    {label}
                  </button>
                );
              })}
              <span className="flex-1" />
              <button
                type="button"
                disabled={locked || i === 0}
                onClick={() => move(i, -1)}
                className="rounded-lg px-2 text-xs text-slate-500 disabled:opacity-30"
              >
                Up
              </button>
              <button
                type="button"
                disabled={locked || i === rows.length - 1}
                onClick={() => move(i, 1)}
                className="rounded-lg px-2 text-xs text-slate-500 disabled:opacity-30"
              >
                Down
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="rounded-lg px-2 text-xs text-slate-500 underline disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={locked}
          onClick={() =>
            setRows([
              ...rows,
              { key: "", label: "", value: "", hint: "", audiences: ["patient", "therapist", "clinic", "company"] },
            ])
          }
          className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
        >
          Add a field
        </button>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="cardsComingSoon"
            defaultChecked={cardsComingSoon}
            disabled={locked}
            className="h-4 w-4"
          />
          Tell them card payments are coming
        </label>

        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-brand-700">{state.ok}</p> : null}

        <Save locked={locked} />
      </form>
    </Card>
  );
}

function Save({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || locked}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}
