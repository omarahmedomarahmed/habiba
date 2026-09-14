"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { setCoveragePercent, type CoverageState } from "@/app/(sponsor)/sponsor/pot/actions";
import { Button, Card } from "@/components/ui";

const INITIAL: CoverageState = {};

/** 0, 5, 10 … 100. The steps a finance team actually agrees in. */
const STEPS = Array.from({ length: 21 }, (_, i) => i * 5);

/**
 * What this employer covers. PLAN.md 60.1 to 60.6, C311, C344, C345.
 *
 * ## 🔴 THE TWO SENTENCES ON THIS SCREEN ARE THE WHOLE RULING
 *
 * A reduction takes time and an increase does not, and if the screen does not
 * say so the first person to lower it will assume it saved wrong. C344's
 * asymmetry is not a technical detail, it is the promise being made to the
 * person whose share is about to change.
 *
 * ## 🔴 0% IS ON THE LIST, AND IT IS NOT REMOVAL (C345)
 *
 * An employer who stops paying but keeps somebody enrolled keeps them on the
 * roster and keeps their badge. C234 already separates a badge from funding;
 * this is that separation with a number on it, and the copy says so rather than
 * leaving somebody to discover that 0% and removal are different things.
 *
 * ## What is NOT on this screen
 *
 * Anybody's name. A percentage is a fact about the account, and C227 says a
 * sponsor performs no act about any individual except removal.
 */
export function CoverageForm({
  coverageBps,
  pendingCoverageBps,
  pendingFromLabel,
  noticeDays,
}: {
  coverageBps: number;
  pendingCoverageBps: number | null;
  pendingFromLabel: string | null;
  noticeDays: number;
}) {
  const [state, action] = useActionState(setCoveragePercent, INITIAL);
  const current = Math.round(coverageBps / 100);

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">What you cover</h2>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-900">{current}%</span>
        <span className="text-sm text-slate-500">
          of a session. Your people pay the other {100 - current}%.
        </span>
      </div>

      {/*
        🔴 The pending change, stated with its date. A reduction that appears to
        have saved and changed nothing reads as a bug; this is the notice window
        doing exactly what it exists for.
      */}
      {pendingCoverageBps !== null && pendingFromLabel ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          Changing to {Math.round(pendingCoverageBps / 100)}% on {pendingFromLabel}. Anybody
          who has already booked keeps the percentage they agreed to.
        </p>
      ) : null}

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Set a new percentage</span>
          <select
            name="percent"
            defaultValue={String(current)}
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            {STEPS.map((step) => (
              <option key={step} value={step}>
                {step}%
              </option>
            ))}
          </select>
        </label>
        <Save />
      </form>

      <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-500">
        <p>
          <strong className="font-semibold text-slate-700">Raising it happens now.</strong>{" "}
          Lowering it takes {noticeDays} days, so nobody is asked for more than they agreed
          to on a session they have already booked.
        </p>
        <p>
          <strong className="font-semibold text-slate-700">0% is allowed.</strong> Your people
          stay on your list and keep their access; you simply stop paying for it. Removing
          somebody is a different thing and is done from your people page.
        </p>
        <p>
          You cover the session price your people are quoted. Nothing else is charged to you,
          and we never tell you who used it.
        </p>
      </div>

      {state.error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p>
      ) : null}
      {state.ok && state.message ? (
        <p className="mt-3 text-sm font-semibold text-teal-700">{state.message}</p>
      ) : null}
    </Card>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-12">
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}
