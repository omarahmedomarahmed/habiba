"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Banknote, Clock, Wallet } from "lucide-react";

import { openPayoutDashboard, payOutNow, type SettingsState } from "@/app/(app)/settings/actions";
import { Card } from "@/components/clinician/kit";
import { Money } from "@/components/ui/money";
import { useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";

export type EarningsProps = {
  connected: boolean;
  payoutsEnabled: boolean;
  availableCents: number | null;
  pendingCents: number | null;
  lifetimeNetCents: number;
  thisMonthNetCents: number;
  platformFeesCents: number;
  settledFromEarningsCents: number;
  paidSessionCount: number;
  /** Money we took on their behalf and are holding until Stripe verifies them. */
  heldCents: number;
  /**
   * Paid out by hand from the Egyptian entity (§3c). There is no Stripe here,
   * so no Stripe balance, no dashboard and no "until Stripe verifies you": the
   * live walkthrough found that sentence on an Egyptian clinician's earnings.
   * The withdrawal card below this one is where their money is.
   */
  manualRail?: boolean;
};

/**
 * What the therapist has earned, and where it is.
 *
 * Three places money can be, and conflating any two of them is how somebody
 * plans their rent around the wrong number:
 *
 *   available / clearing  in their own Stripe account, read live. Theirs.
 *   held                  in ours, because Stripe had not verified them when
 *                         the patient paid. Theirs, and not yet reachable.
 *   lifetime              our record of what happened. History, not a balance.
 *
 * If Stripe is unreachable we show no balance rather than a stale one.
 */
export function EarningsCard(props: EarningsProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<SettingsState>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  /*
   * Not connected, but possibly not empty either.
   *
   * A clinician can now set a price and be paid before Stripe has ever heard of
   * them. If that has already happened there is real money with their name on
   * it, and the old copy — an invitation to start charging — would be telling
   * somebody who is already owed forty dollars that they might like to try
   * charging sometime.
   */
  if (props.manualRail) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.6)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-20 h-60 w-60 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
        />
        <div className="relative px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
            <Wallet className="h-3.5 w-3.5 text-brand-300" aria-hidden />
            {t("tearn.title")}
          </span>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
              <dt className="text-xs font-semibold text-white/70">{t("tearn.thisMonth")}</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums"><Money cents={props.thisMonthNetCents} /></dd>
            </div>
            <div className="rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
              <dt className="text-xs font-semibold text-white/70">{t("tearn.paidSessions")}</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{props.paidSessionCount}</dd>
            </div>
          </dl>
        </div>
        <div className="relative border-t border-white/10 px-5 py-3 text-xs text-white/70 sm:px-6">
          {rich(t("tearn.lifetime", { net: slot(0), fees: slot(1) }), [
            <Money cents={props.lifetimeNetCents} />,
            <Money cents={props.platformFeesCents} />,
          ])}
        </div>
      </div>
    );
  }

  if (!props.connected) {
    return (
      <Card className="p-5">
        {props.heldCents > 0 ? (
          <>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-700">
                  {rich(t("tearn.waiting", { amount: slot(0) }), [<Money cents={props.heldCents} />])}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-navy-400">
                  {t("tearn.waitingBody")}
                </p>
              </div>
            </div>
            <Link
              href="/settings"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-sm font-semibold text-navy-600 hover:bg-brand-400"
            >
              <Banknote className="h-4 w-4" aria-hidden />
              {t("tearn.finishSetup")}
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Wallet className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-700">{t("tearn.chargeTitle")}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-navy-400">
                  {t("tearn.chargeBody")}
                </p>
              </div>
            </div>
            <Link
              href="/settings"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-sm font-semibold text-navy-600 hover:bg-brand-400"
            >
              <Banknote className="h-4 w-4" aria-hidden />
              {t("tpay.setUp")}
            </Link>
          </>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.6)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-20 h-60 w-60 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
        />
        <div className="relative px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
            <Wallet className="h-3.5 w-3.5 text-brand-300" aria-hidden />
            {t("tearn.title")}
          </span>

          <p className="mt-3 text-[40px] leading-tight font-bold tracking-tight tabular-nums">
            {props.availableCents === null ? "-" : <Money cents={props.availableCents} />}
          </p>
          <p className="mt-0.5 text-sm text-white/75">
            {props.availableCents === null
              ? t("tearn.unavailable")
              : (
                  <>
                    {t("tearn.availableNow")}
                    {props.pendingCents ? (
                      <> · {rich(t("tearn.clearing", { amount: slot(0) }), [<Money cents={props.pendingCents} />])}</>
                    ) : null}
                  </>
                )}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
              <dt className="text-xs font-semibold text-white/70">{t("tearn.thisMonth")}</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums"><Money cents={props.thisMonthNetCents} /></dd>
            </div>
            <div className="rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
              <dt className="text-xs font-semibold text-white/70">{t("tearn.paidSessions")}</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{props.paidSessionCount}</dd>
            </div>
          </dl>

          {/*
            Held money gets its own row rather than being folded into the
            headline. It is not "available now" and showing it as though it were
            would be the single most misleading thing on this page.
          */}
          {props.heldCents > 0 ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-amber-400/15 px-4 py-3 ring-1 ring-amber-400/30">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-100">
                  {rich(t("tearn.heldBy", { amount: slot(0) }), [<Money cents={props.heldCents} />])}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/75">
                  {t("tearn.heldBody")}
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-500/15 px-3.5 py-2.5 text-sm text-red-100 ring-1 ring-red-400/30">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {props.payoutsEnabled && (props.availableCents ?? 0) > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(payOutNow)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand-500 px-4 text-sm font-semibold text-navy-700 hover:bg-brand-400 disabled:opacity-50"
              >
                <Banknote className="h-4 w-4" aria-hidden />
                {pending ? t("tpay.requesting") : t("tearn.payOutNow")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(openPayoutDashboard)}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-50"
            >
              {t("tpay.dashboard")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="relative border-t border-white/10 px-5 py-3 text-xs text-white/70 sm:px-6">
          {props.settledFromEarningsCents > 0
            ? rich(t("tearn.lifetimeSettled", {
                net: slot(0),
                fees: slot(1),
                settled: slot(2),
              }), [<Money cents={props.lifetimeNetCents} />, <Money cents={props.platformFeesCents} />, <Money cents={props.settledFromEarningsCents} />])
            : rich(t("tearn.lifetime", {
                net: slot(0),
                fees: slot(1),
              }), [<Money cents={props.lifetimeNetCents} />, <Money cents={props.platformFeesCents} />])}
        </div>
      </div>
    </div>
  );
}
