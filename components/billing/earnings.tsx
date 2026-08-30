"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Banknote, Clock, Wallet } from "lucide-react";

import { openPayoutDashboard, payOutNow, type SettingsState } from "@/app/(app)/settings/actions";
import { Card } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";

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
                <p className="text-sm font-semibold text-slate-900">
                  {formatUsd(props.heldCents)} is waiting for you
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                  Your patients have paid. We are holding your share because Stripe has not
                  verified you yet — it goes to your account automatically the moment they do,
                  and there is nothing to claim.
                </p>
              </div>
            </div>
            <Link
              href="/settings"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Banknote className="h-4 w-4" aria-hidden />
              Finish setting up payouts
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <Wallet className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Charge for your sessions</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                  Set a price and the patient pays before they join. You can start today — if
                  Stripe has not verified you yet we hold your share and send it on when they do.
                </p>
              </div>
            </div>
            <Link
              href="/settings"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Banknote className="h-4 w-4" aria-hidden />
              Set up payouts
            </Link>
          </>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-teal-600 text-white">
        <div className="px-5 pt-5 pb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <Wallet className="h-3 w-3" aria-hidden />
            Your earnings
          </span>

          <p className="mt-3 text-3xl font-bold tracking-tight">
            {props.availableCents === null ? "—" : formatUsd(props.availableCents)}
          </p>
          <p className="mt-0.5 text-sm text-white/70">
            {props.availableCents === null
              ? "Balance unavailable — check your Stripe dashboard."
              : `available now${
                  props.pendingCents ? ` · ${formatUsd(props.pendingCents)} clearing` : ""
                }`}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <dt className="text-xs text-white/60">Earned this month</dt>
              <dd className="mt-0.5 text-2xl font-bold">{formatUsd(props.thisMonthNetCents)}</dd>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <dt className="text-xs text-white/60">Paid sessions</dt>
              <dd className="mt-0.5 text-2xl font-bold">{props.paidSessionCount}</dd>
            </div>
          </dl>

          {/*
            Held money gets its own row rather than being folded into the
            headline. It is not "available now" and showing it as though it were
            would be the single most misleading thing on this page.
          */}
          {props.heldCents > 0 ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-amber-400/20 px-4 py-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {formatUsd(props.heldCents)} held by 24Therapy
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/70">
                  Taken on your behalf before Stripe finished verifying you. It moves to your
                  account by itself — you do not have to ask.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-black/20 px-3.5 py-2.5 text-sm">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {props.payoutsEnabled && (props.availableCents ?? 0) > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(payOutNow)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-teal-700 disabled:opacity-50"
              >
                <Banknote className="h-4 w-4" aria-hidden />
                {pending ? "Requesting…" : "Pay out now"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(openPayoutDashboard)}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-white/15 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Stripe dashboard
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-3 text-xs text-white/60">
          Lifetime {formatUsd(props.lifetimeNetCents)} after {formatUsd(props.platformFeesCents)} in
          24Therapy fees
          {props.settledFromEarningsCents > 0
            ? ` · ${formatUsd(props.settledFromEarningsCents)} of your bills settled from earnings`
            : ""}
          .
        </div>
      </div>
    </div>
  );
}
