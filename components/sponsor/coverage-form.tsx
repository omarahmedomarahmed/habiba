"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { setCoveragePercent, type CoverageState } from "@/app/(sponsor)/sponsor/pot/actions";
import { Button, buttonClass, Card } from "@/components/clinician/kit";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";
import { countKey } from "@/lib/i18n/count-form";

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
  noticeApplies = true,
  balanceUsd,
  fundedUsd,
  sessionPriceUsd,
}: {
  coverageBps: number;
  pendingCoverageBps: number | null;
  pendingFromLabel: string | null;
  noticeDays: number;
  /**
   * 🔴 Board 454: false while nobody is enrolled and nothing was ever paid
   * from the pot, when `setCoverage` applies a cut at once as well.
   */
  noticeApplies?: boolean;
  /**
   * The published balance, so the slider can say what it buys. Null when it is
   * held back by a floor, and null is not zero (B18).
   */
  balanceUsd: number | null;
  /** What the company has put in, counted instead when the balance is held back. */
  fundedUsd: number;
  /** The average a session costs, from settings. Not guessed here. */
  sessionPriceUsd: number;
}) {
  const t = useT();
  const [state, action] = useActionState(setCoveragePercent, INITIAL);
  const current = Math.round(coverageBps / 100);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  /* Board 420 class: the sentence takes the form of its count. */
  const buys = draft === 0 ? 0 : Math.floor((balanceUsd ?? fundedUsd) / ((sessionPriceUsd * draft) / 100));

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.cov.title")}</h2>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[40px] leading-none font-bold tracking-tight tabular-nums text-navy-700">{current}%</span>
        <span className="text-sm text-navy-400">
          {t("sponsor.cov.ofSession", { rest: 100 - current })}
        </span>
      </div>

      {/*
        🔴 The pending change, stated with its date. A reduction that appears to
        have saved and changed nothing reads as a bug; this is the notice window
        doing exactly what it exists for.
      */}
      {pendingCoverageBps !== null && pendingFromLabel ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          {t("sponsor.cov.pending", {
            percent: Math.round(pendingCoverageBps / 100),
            date: pendingFromLabel,
          })}
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
        <form action={action} className="mt-5 rounded-2xl bg-navy-50 p-4 ring-1 ring-navy-100 sm:p-5">
          <label htmlFor="coverage-slider" className="text-xs font-medium text-navy-400">
            {t("sponsor.cov.moveIt")}
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
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-navy-100 accent-brand-700"
            />
            <span className="w-16 shrink-0 text-end text-2xl font-bold tabular-nums text-navy-700">
              {draft}%
            </span>
          </div>

          {/*
            The split of one session, as in the approved mockup: what the company
            pays in navy, what the person pays in teal, sized by the draft. The
            same figures as the sentence under it, drawn rather than read.
          */}
          <div aria-hidden className="mt-4 flex h-12 overflow-hidden rounded-2xl ring-1 ring-navy-100">
            <div
              className="flex items-center justify-center bg-navy-700 text-[13px] font-bold tabular-nums text-white transition-[width] duration-300"
              style={{ width: `${draft}%` }}
            >
              {draft >= 22 ? <Money cents={Math.round(sessionPriceUsd * draft)} /> : null}
            </div>
            <div className="flex flex-1 items-center justify-center bg-brand-100 text-[13px] font-bold tabular-nums text-navy-700">
              {draft <= 78 ? <Money cents={Math.round(sessionPriceUsd * (100 - draft))} /> : null}
            </div>
          </div>

          {/*
            🔴 THE NUMBER THAT MAKES THE PERCENTAGE MEAN SOMETHING.
            
            "10%" is abstract. "Your 200 dollars covers 100 sessions" is a
            decision a finance team can take, and it is the same arithmetic
            they would do on paper before agreeing to anything.
          */}
          <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-relaxed text-navy-600">
            {draft === 0
              ? t("sponsor.cov.zero")
              : rich(
                  t(balanceUsd === null ? "sponsor.cov.buysFunded" : "sponsor.cov.buys", {
                    percent: draft,
                    share: slot(0),
                    price: slot(1),
                    balance: slot(2),
                    sessions: t(countKey("sponsor.cov.sessions", buys), { count: buys }),
                  }),
                  [
                    <strong key="share" className="text-navy-700"><Money cents={Math.round(((sessionPriceUsd * draft) / 100) * 100)} /></strong>,
                    <Money key="price" cents={Math.round(sessionPriceUsd * 100)} />,
                    <strong key="balance" className="text-navy-700"><Money cents={Math.round((balanceUsd ?? fundedUsd) * 100)} /></strong>,
                  ],
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
              className="h-12 rounded-xl px-4 text-sm font-semibold text-navy-400"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(buttonClass("secondary", "md"), "mt-5 h-12")}
        >
          {t("sponsor.cov.edit")}
        </button>
      )}

      <div className="mt-4 space-y-2 text-xs leading-relaxed text-navy-400">
        {noticeApplies ? (
          <p>
            <strong className="font-semibold text-navy-600">{t("sponsor.cov.raiseNow")}</strong>{" "}
            {t("sponsor.cov.lowerTakes", { days: noticeDays })}
          </p>
        ) : (
          <p>
            <strong className="font-semibold text-navy-600">{t("sponsor.cov.anyNow")}</strong>
          </p>
        )}
        <p>
          <strong className="font-semibold text-navy-600">{t("sponsor.cov.zeroAllowed")}</strong>{" "}
          {t("sponsor.cov.zeroBody")}
        </p>
        <p>{t("sponsor.cov.quoted")}</p>
      </div>

      {state.error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p>
      ) : null}
      {state.ok && state.message ? (
        <p className="mt-3 text-sm font-semibold text-brand-700">{state.message}</p>
      ) : null}
    </Card>
  );
}


function Save() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending} className="h-12">
      {pending ? t("common.saving") : t("common.save")}
    </Button>
  );
}
