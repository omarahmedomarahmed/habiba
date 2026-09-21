"use client";

import { useActionState, useState } from "react";
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
  balanceUsd,
  sessionPriceUsd,
}: {
  coverageBps: number;
  pendingCoverageBps: number | null;
  pendingFromLabel: string | null;
  noticeDays: number;
  /** What is in the pot right now, so the slider can say what it buys. */
  balanceUsd: number;
  /** The average a session costs, from settings. Not guessed here. */
  sessionPriceUsd: number;
}) {
  const [state, action] = useActionState(setCoveragePercent, INITIAL);
  const current = Math.round(coverageBps / 100);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);

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

      {/*
        🔴 LOCKED UNTIL THEY PRESS EDIT, and that is not a flourish.
        
        A slider that moves on the first touch is a slider somebody drags by
        accident on a phone, and this one decides what a company pays for every
        session its staff book. Edit is a deliberate act; the slider only moves
        after it; Save is the second deliberate act. Between them they see
        exactly what the change buys.
      */}
      {editing ? (
        <form action={action} className="mt-4 rounded-2xl bg-slate-50 p-4">
          <label htmlFor="coverage-slider" className="text-xs font-medium text-slate-600">
            Move it, then save
          </label>
          <input type="hidden" name="percent" value={String(draft)} />
          <div className="mt-2 flex items-center gap-3">
            <input
              id="coverage-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-700"
            />
            <span className="w-14 shrink-0 text-end text-lg font-bold tabular-nums text-slate-900">
              {draft}%
            </span>
          </div>

          {/*
            🔴 THE NUMBER THAT MAKES THE PERCENTAGE MEAN SOMETHING.
            
            "10%" is abstract. "Your 200 dollars covers 100 sessions" is a
            decision a finance team can take, and it is the same arithmetic
            they would do on paper before agreeing to anything.
          */}
          <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-relaxed text-slate-700">
            {draft === 0 ? (
              <>Your people pay for their own. Nothing is drawn from your balance.</>
            ) : (
              <>
                At {draft}% you pay{" "}
                <strong className="text-slate-900">{fmtUsd((sessionPriceUsd * draft) / 100)}</strong>{" "}
                of a {fmtUsd(sessionPriceUsd)} session, so your balance of{" "}
                <strong className="text-slate-900">{fmtUsd(balanceUsd)}</strong> covers about{" "}
                <strong className="text-slate-900">
                  {Math.floor(balanceUsd / ((sessionPriceUsd * draft) / 100))} sessions
                </strong>
                .
              </>
            )}
          </p>

          <div className="mt-3 flex gap-2">
            <Save />
            <button
              type="button"
              onClick={() => {
                setDraft(current);
                setEditing(false);
              }}
              className="h-12 rounded-xl px-4 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 h-12 rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          Edit what you cover
        </button>
      )}

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
          You cover the session price your people are quoted. Nothing else is charged, and we
          never say who used it.
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

/**
 * Whole dollars, grouped by hand.
 *
 * 🔴 C84: `toLocaleString` is banned in a client file, and an explicit `"en-US"`
 * is banned with it, because it is indistinguishable in a diff from the
 * `undefined` that means "ask whatever machine is running this". A finance team
 * reads round numbers, so no cents either.
 */
function fmtUsd(n: number): string {
  const whole = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}`;
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-12">
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}
