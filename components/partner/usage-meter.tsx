"use client";

import { useState, useTransition } from "react";

import { saveLimit } from "@/app/(partner)/partner/actions";
import { Button, Card, Field, Input } from "@/components/ui";

/**
 * The limit they set, and what the month is heading for. PLAN.md 68.15 to 68.18.
 *
 * ## 🔴 THREE NUMBERS, AND THE THIRD IS THE ONE THAT CHANGES ANYTHING
 *
 * The limit, the spend, and the projection. An integrator looking at "412 of 500" on
 * the 3rd of the month reads it as comfortable; "on course for 780" is the same two
 * numbers saying something they have to act on.
 *
 * ## 🔴 AND WHAT HAPPENS AT THE LIMIT IS STATED BEFORE IT HAPPENS
 *
 * Every metered API an integrator has ever used bills overage at the ceiling, so they
 * will assume this one does too unless the screen where they set the number says
 * otherwise. It does, in the words the ruling uses: their product keeps working, ours
 * stops, and we do not bill for a session we did not do.
 */
export function UsageMeter({
  limit,
  used,
  projected,
  stopped,
  canChange,
  periodLabel,
  lastMonth,
}: {
  limit: number;
  used: number;
  projected: number;
  stopped: boolean;
  canChange: boolean;
  periodLabel: string;
  /** 🔴 68.19 — the closed month, read from the same function the cron posts from. */
  lastMonth: {
    label: string;
    sessions: number;
    perSessionCents: number;
    totalCents: number;
  } | null;
}) {
  const [wanted, setWanted] = useState(String(limit));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = Math.round(share * 100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Usage</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Sessions we did intelligence for this month, {periodLabel}. Priced per session,
          never per call: you do the work, we transcribe, write and assist.
        </p>
      </div>

      {/*
        🔴 68.18 — THE STOP IS EXPLICIT AND IT IS THE FIRST THING ON THE PAGE.

        A copilot that vanishes without a word is read as our outage, and their
        therapist is mid-session. This is the screen the person who can fix it is
        looking at, so the fix is the button beside the sentence.
      */}
      {stopped ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">
            We have stopped at the limit you set.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">
            Your own platform is unaffected: sessions are happening and are held on your
            side. What has stopped is our part, so no transcription, no notes, no
            summaries and no copilot, until you raise the number below. We are not
            billing you for those sessions, because we did not do them.
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-3xl font-bold tabular-nums text-slate-900">{used}</p>
          <p className="text-sm text-slate-500">
            of {limit > 0 ? limit : "no limit set"} this month
          </p>
        </div>

        {limit > 0 ? (
          <>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Sessions used against the limit"
            >
              <div
                className={
                  share >= 0.9
                    ? "h-full rounded-full bg-red-500"
                    : share >= 0.8
                      ? "h-full rounded-full bg-amber-500"
                      : "h-full rounded-full bg-brand-500"
                }
                style={{ width: `${percent}%` }}
              />
            </div>

            {/*
              🔴 THE PROJECTION, and it says what it means rather than a number
              beside a word nobody parses.
            */}
            <p className="mt-3 text-sm text-slate-600">
              At this rate the month ends at about{" "}
              <strong className="font-semibold text-slate-900 tabular-nums">{projected}</strong>
              {projected > limit ? (
                <>
                  , which is past your limit. We will stop when you reach {limit} and your
                  own platform will carry on.
                </>
              ) : (
                <>, which is inside your limit.</>
              )}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            You have not set a limit, so nothing is capped. Set one and we will never
            exceed it.
          </p>
        )}
      </Card>

      {/*
        🔴 68.19 — THE BILL, FROM REAL USAGE, ON THE SAME LEDGER EVERYTHING ELSE IS.

        Arithmetic somebody can check: sessions, times the price, equals the total.
        A bill an integrator cannot reproduce from two numbers on a screen is a bill
        that produces a support conversation every month.
      */}
      {lastMonth ? (
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {lastMonth.label}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <strong className="font-semibold tabular-nums text-slate-900">
              {lastMonth.sessions}
            </strong>{" "}
            sessions at ${(lastMonth.perSessionCents / 100).toFixed(2)} each
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            ${(lastMonth.totalCents / 100).toFixed(2)}
          </p>
        </Card>
      ) : null}

      {canChange ? (
        <Card className="p-5">
          <Field label="Sessions a month" htmlFor="partner-limit">
            <Input
              id="partner-limit"
              type="number"
              min={0}
              value={wanted}
              onChange={(event) => {
                setWanted(event.target.value);
                setSaved(false);
              }}
            />
          </Field>

          {/*
            🔴 68.16 / 68.17 — the rule, on the screen where the number is typed.

            An integrator sets this expecting the industry default, which is an
            overage charge at the ceiling. Three sentences here are cheaper than a
            support conversation after a month where their therapists lost the
            copilot and nobody could say why.
          */}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            We alert this account&rsquo;s contact at 80% and again at 90%, with a link
            back here. At the limit our part stops and yours does not, and we never bill
            past it: a session we did not do is not one we charge for.
          </p>

          {error ? (
            <p role="alert" className="mt-3 text-xs text-red-600">
              {error}
            </p>
          ) : null}
          {saved ? <p className="mt-3 text-xs font-semibold text-teal-700">Saved.</p> : null}

          <Button
            type="button"
            className="mt-4"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await saveLimit(Number(wanted));
                setError(result.error ?? null);
                setSaved(!result.error);
              })
            }
          >
            {pending ? "Saving…" : "Save the limit"}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
