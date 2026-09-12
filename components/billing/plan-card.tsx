"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { buyCredits } from "@/app/(app)/billing/actions";
import { Badge, Button, Card } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { useT } from "@/lib/i18n/client";

export type TierRow = { key: string; name: string; unlockCents: number; aiRateCents: number };

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
 * 🔴 46.7 — what a session costs you, now that it is two things.
 *
 * ## What this replaced, twice
 *
 * First a $99/month Unlimited subscription, then a session-bundle slider. Both
 * are gone, and the second went for a reason worth keeping written down: a
 * tier is **a price threshold and an AI rate**, never a session count (C223).
 * $30 does not buy ten of anything. It buys $30 of credit, spendable against
 * any line, and it unlocks the $2 AI rate.
 *
 * ## The order of the two fees is the ethics, not the layout
 *
 * The platform fee is stated first and stated as unconditional. The AI fee is
 * second and conditional. That is C209's whole protection: a fee that vanished
 * when a patient declined would give a therapist a financial reason to lean on
 * the most vulnerable person in the room. Making the AI fee conditional is
 * only safe because the fee above it is not.
 *
 * 🔴 And the slider carries a sentence nobody would guess: **the rate does not
 * expire when the credit does.** The money bought credit; the threshold bought
 * the rate. Without that line a rate lock reads as a bundle discount that
 * quietly lapsed, and the first therapist whose credit ran out would think we
 * had taken something back.
 *
 * Every figure here is passed in from `platform_settings`. Nothing on this
 * card is written in the file.
 */
export function PlanCard({
  tiers,
  currentTierKey,
  creditRemainingCents,
  creditsExpireOn,
  billingEnabled,
  platformFeeCents,
  spentPlatformCents,
  spentAiCents,
  heldEarningsCents,
}: {
  tiers: TierRow[];
  currentTierKey: string;
  /** 46.4 — credit is money, so this is cents rather than a session count. */
  creditRemainingCents: number;
  creditsExpireOn: string | null;
  billingEnabled: boolean;
  platformFeeCents: number;
  /** 46.7 — this month's spend, split by line item rather than totalled. */
  spentPlatformCents: number;
  spentAiCents: number;
  heldEarningsCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payg = tiers.find((tier) => tier.unlockCents === 0) ?? tiers[0];
  const best = tiers.reduce((a, b) => (b.unlockCents > a.unlockCents ? b : a), tiers[0]!);

  /*
   * The slider is in DOLLARS and starts at the cheapest tier's threshold: the
   * amount a therapist is most likely to want is the one that unlocks the best
   * rate. It moves in whole dollars, because a credit top-up is not a place
   * anybody needs cents.
   */
  const [dollars, setDollars] = useState(Math.max(1, Math.round((best.unlockCents || 3000) / 100)));

  const t = useT();
  const amountCents = dollars * 100;
  const chosen = tiers.reduce(
    (winner, tier) => (tier.unlockCents <= amountCents ? tier : winner),
    tiers[0]!,
  );
  const current = tiers.find((tier) => tier.key === currentTierKey) ?? payg;

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{current.name}</p>
          {/*
            🔴 Two sentences, in this order, and the order is C209.
            Unconditional first, conditional second, and the second says out
            loud what happens when a patient says no.
          */}
          <p className="mt-0.5 text-sm text-slate-500">
            {t("tplan.platformEvery", { amount: formatUsd(platformFeeCents) })}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {t("tplan.aiRate", { amount: formatUsd(current.aiRateCents) })}{" "}
            {t("tplan.aiNever")}
          </p>
        </div>
        {creditRemainingCents > 0 ? (
          <Badge tone="teal">{formatUsd(creditRemainingCents)}</Badge>
        ) : null}
      </div>

      {/*
        46.7 — this month, split by line item. Two figures rather than one,
        because "what did the AI cost me" is the question a therapist has and
        a single total cannot answer it.
      */}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{t("tplan.spentPlatform")}</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">
            {formatUsd(spentPlatformCents)}
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{t("tplan.spentAi")}</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">{formatUsd(spentAiCents)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{t("tplan.creditBalance")}</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">
            {formatUsd(creditRemainingCents)}
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{t("tplan.heldEarnings")}</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">
            {formatUsd(heldEarningsCents)}
          </dd>
        </div>
      </dl>

      {creditRemainingCents > 0 && creditsExpireOn ? (
        <p className="mt-3 text-xs text-slate-500">
          {t("tplan.creditExpiresOn", { date: creditsExpireOn })}
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <label htmlFor="credit-amount" className="text-sm font-semibold text-slate-900">
          {t("tplan.topUp")}
        </label>
        <p className="mt-0.5 text-xs text-slate-500">{t("tplan.topUpBody")}</p>

        <div className="mt-3 flex items-center gap-3">
          <input
            id="credit-amount"
            type="range"
            min={1}
            max={Math.max(Math.round((best.unlockCents / 100) * 2), 120)}
            step={1}
            value={dollars}
            onChange={(event) => setDollars(Number(event.target.value))}
            className="h-2 flex-1 cursor-pointer accent-brand-500"
          />
          <span className="w-20 shrink-0 text-end text-sm font-semibold tabular-nums text-slate-900">
            {formatUsd(amountCents)}
          </span>
        </div>

        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">{chosen.name}</dt>
            <dd className="tabular-nums text-slate-900">
              {t("tplan.unlocks", { amount: formatUsd(chosen.aiRateCents) })}
            </dd>
          </div>
        </dl>

        {/*
          🔴 The sentence that stops a rate lock reading as a lapsed discount.
          The money buys credit; the threshold buys the rate; the rate outlives
          the credit. Nobody would guess that, so it is on the screen with the
          button rather than in a help page.
        */}
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{t("tplan.rateKept")}</p>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <Button
          full
          className="mt-4"
          disabled={pending || !billingEnabled || dollars < 1}
          onClick={() => run(() => buyCredits(amountCents))}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {pending ? t("tled.openingCheckout") : t("tplan.addAmount", { amount: formatUsd(amountCents) })}
        </Button>
      </div>
    </Card>
  );
}
