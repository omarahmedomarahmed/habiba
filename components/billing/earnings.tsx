"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Banknote, Wallet } from "lucide-react";

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
};

/**
 * What the therapist has earned, and where it is.
 *
 * The distinction that matters and is easy to blur: "available" and "clearing"
 * are read live from Stripe and are their money; everything below the fold is
 * our record of what happened. If Stripe is unreachable we show no balance
 * rather than a stale one — a wrong number here is the number someone plans
 * their rent around.
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

  if (!props.connected) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <Wallet className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Charge for your sessions</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Set a price on a session link and the patient pays before they join. The money lands
              in your own Stripe account, not ours.
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

