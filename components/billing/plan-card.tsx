"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { buyCredits } from "@/app/(app)/billing/actions";
import { Badge, Button, Card } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";

export type TierRow = { key: string; name: string; rateCents: number; minimumSessions: number };

/*
 * 12.3 / C84 — `InvoiceList` was deleted from this file, which is why it is now
 * called `plan-card.tsx`.
 *
 * It was exported, took a `zone` prop, and was rendered nowhere: the billing
 * page imports only `PlanCard` and formats its own dates server-side with
 * `actor.timezone`. The first pass of 12.3 threaded a fix through it and
 * documented the reasoning in a comment on code no screen runs — which is a
 * fix that cannot be wrong because it cannot execute.
 */

/**
 * What a session costs you, and how to make it cost less.
 *
 * ## What this replaced
 *
 * A card that sold a $99/month Unlimited subscription and, on PAYG, existed
 * mainly to advertise it — "worth it from 17 sessions a month". There is no
 * subscription any more. A therapist buys sessions outright and the rate falls
 * with the quantity, so the card's job changed from *upgrade* to *stock up*.
 *
 * The quantity is a slider above the tier minimum rather than three fixed
 * packs, because that is what §3 asks for and because a fixed pack makes a
 * therapist who needs eleven sessions buy thirty.
 *
 * Every figure here — the rates, the minimums, the expiry — is passed in from
 * `platform_settings`. Nothing on this card is written in the file.
 */
export function PlanCard({
  tiers,
  currentTierKey,
  creditsRemaining,
  creditsExpireOn,
  billingEnabled,
  sessionsThisMonth,
  spentThisMonthCents,
}: {
  tiers: TierRow[];
  currentTierKey: string;
  creditsRemaining: number;
  creditsExpireOn: string | null;
  billingEnabled: boolean;
  sessionsThisMonth: number;
  spentThisMonthCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payg = tiers.find((t) => t.minimumSessions === 0) ?? tiers[0];
  const best = tiers.reduce((a, b) => (b.minimumSessions > a.minimumSessions ? b : a), tiers[0]!);

  // Start the slider at the cheapest tier's minimum: the number a therapist is
  // most likely to want is the one that unlocks the best rate.
  const [quantity, setQuantity] = useState(best.minimumSessions || 10);

  const tierFor = (qty: number) =>
    tiers.reduce((chosen, t) => (t.minimumSessions <= qty ? t : chosen), tiers[0]!);

  const chosen = tierFor(quantity);
  const total = chosen.rateCents * quantity;
  const current = tiers.find((t) => t.key === currentTierKey) ?? payg;

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{current.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatUsd(current.rateCents)} per completed session.
          </p>
        </div>
        {creditsRemaining > 0 ? (
          <Badge tone="teal">
            {creditsRemaining} credit{creditsRemaining === 1 ? "" : "s"} left
          </Badge>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Sessions this month</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">{sessionsThisMonth}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Paid this month</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">
            {formatUsd(spentThisMonthCents)}
          </dd>
        </div>
      </dl>

      {creditsRemaining > 0 && creditsExpireOn ? (
        <p className="mt-3 text-xs text-slate-500">
          Your credits are used before anything is billed. The next batch expires{" "}
          {creditsExpireOn}.
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <label htmlFor="credit-quantity" className="text-sm font-semibold text-slate-900">
          Buy sessions in advance
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          The more you buy at once, the less each one costs. They never expire before you have had
          a year to use them.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <input
            id="credit-quantity"
            type="range"
            min={1}
            max={Math.max(best.minimumSessions * 2, 60)}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-2 flex-1 cursor-pointer accent-brand-500"
          />
          <span className="w-20 shrink-0 text-end text-sm font-semibold tabular-nums text-slate-900">
            {quantity} session{quantity === 1 ? "" : "s"}
          </span>
        </div>

        {/*
          Three lines with reasons, never one number.
          The rate is the thing that changes with the slider, so it is named
          rather than folded into the total.
        */}
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">{chosen.name} rate</dt>
            <dd className="tabular-nums text-slate-900">{formatUsd(chosen.rateCents)} each</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt className="text-slate-900">Total today</dt>
            <dd className="tabular-nums text-slate-900">{formatUsd(total)}</dd>
          </div>
        </dl>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <Button
          full
          className="mt-4"
          disabled={pending || !billingEnabled || quantity < 1}
          onClick={() => run(() => buyCredits(quantity))}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {pending ? "Opening checkout…" : `Buy ${quantity} for ${formatUsd(total)}`}
        </Button>
      </div>
    </Card>
  );
}
