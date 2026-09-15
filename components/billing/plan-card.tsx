"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { buyCredits, cancelPlan, resumePlan, subscribeTo } from "@/app/(app)/billing/actions";
import { Badge, Button, Card } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { useT } from "@/lib/i18n/client";

export type TierRow = {
  key: string;
  name: string;
  unlockCents: number;
  aiRateCents: number;
  /** 🔴 Sprint 57 — above zero means unlimited, and changes what every other figure means. */
  monthlyCents: number;
};

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
 * 🔴 57.4 — what a session costs you, and how to stop counting.
 *
 * ## What this replaced, three times
 *
 * An unlimited monthly subscription, then a session-bundle slider, then a
 * credit-threshold rate lock. Sprint 57 brings the subscription back, and the
 * reason is worth writing down rather than rediscovering: a therapist cannot
 * compare "a dollar plus two dollars a session" to anything. Every product they
 * will weigh us against quotes a month, and our own numbers said we were priced
 * as a premium product and positioned as a cheap one.
 *
 * The credit ladder is not gone, it is demoted. Pay as you go is the free door
 * and still meters; a plan is bought outright and meters nothing.
 *
 * ## The order of the two fees is the ethics, not the layout
 *
 * On pay as you go the platform fee is stated first and stated as
 * unconditional. The AI fee is second and conditional. That is C209's whole
 * protection: a fee that vanished when a patient declined would give a
 * therapist a financial reason to lean on the most vulnerable person in the
 * room. Making the AI fee conditional is only safe because the fee above it is
 * not.
 *
 * 🔴 An unlimited plan arrives at the same protection from the other side:
 * there is no per-session amount at all for a patient's decision to move. That
 * is stated on the card, because it is the most important thing about it.
 *
 * ## Cancelling says the date
 *
 * "Cancel" on a subscription usually means one of two very different things and
 * the screen rarely says which. Here it always does: the plan runs to a date
 * that is printed next to the button, the button is reversible until then, and
 * the card says in words what changes afterwards.
 *
 * Every figure here is passed in from `platform_settings`. Nothing on this card
 * is written in the file.
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
  renewsOn,
  endsOn,
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
  /**
   * 🔴 57.4 — the plan's period end, formatted on the SERVER in the
   * therapist's own zone. 12.3 / C84: a date formatted in this component would
   * render one string during the server pass and another in the browser.
   *
   * Exactly one of these is ever set. `renewsOn` is a plan that will charge
   * again on that date; `endsOn` is a plan that will stop on it.
   */
  renewsOn: string | null;
  endsOn: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const t = useT();

  const payg = tiers.find((tier) => tier.monthlyCents === 0) ?? tiers[0]!;
  const plans = tiers.filter((tier) => tier.monthlyCents > 0);
  const current = tiers.find((tier) => tier.key === currentTierKey) ?? payg;
  const unlimited = current.monthlyCents > 0;

  /*
   * The top-up slider is in DOLLARS and moves in whole ones, because a credit
   * top-up is not a place anybody needs cents. It starts at a round twenty
   * rather than at a tier threshold: thresholds are all zero now, so the old
   * "start at the amount that unlocks the best rate" no longer means anything.
   */
  const [dollars, setDollars] = useState(20);
  const amountCents = dollars * 100;

  const run = (fn: () => Promise<{ error?: string } | void>) =>
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

          {unlimited ? (
            <>
              <p className="mt-0.5 text-sm text-slate-500">
                {t("tplan.monthlyEvery", { amount: formatUsd(current.monthlyCents) })}
              </p>
              {/*
                🔴 The sentence that makes the plan worth buying, and the one
                that makes it safe. No per-session fee means no amount riding on
                a patient's answer about recording.
              */}
              <p className="mt-0.5 text-sm text-slate-500">{t("tplan.unlimitedNoMeter")}</p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
        {creditRemainingCents > 0 ? (
          <Badge tone="teal">{formatUsd(creditRemainingCents)}</Badge>
        ) : null}
      </div>

      {/*
        46.7 — this month, split by line item. Two figures rather than one,
        because "what did the AI cost me" is the question a therapist has and
        a single total cannot answer it.

        🔴 57.4 — and it is still two figures on an unlimited plan, where both
        read zero. A subscribed session raises both invoice lines at zero rather
        than raising none, so these boxes keep counting real sessions instead of
        quietly emptying (C221).
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

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {/*
        🔴 57.4 — the plan block.

        A therapist on a plan sees the date and the two buttons. A therapist on
        pay as you go sees what the plans cost and what they remove. Nobody sees
        both, because "upgrade" and "manage" are different questions.
      */}
      {unlimited ? (
        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          {endsOn ? (
            <>
              <p className="text-sm font-semibold text-slate-900">
                {t("tplan.endsOn", { date: endsOn })}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {t("tplan.endsBody", { amount: formatUsd(platformFeeCents) })}
              </p>
              <Button
                full
                className="mt-4"
                disabled={pending}
                onClick={() => run(() => resumePlan())}
              >
                {t("tplan.resume")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-900">
                {renewsOn
                  ? t("tplan.renewsOn", { date: renewsOn, amount: formatUsd(current.monthlyCents) })
                  : t("tplan.renewsMonthly", { amount: formatUsd(current.monthlyCents) })}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {t("tplan.cancelKeepsMonth")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {plans
                  .filter((tier) => tier.key !== current.key)
                  .map((tier) => (
                    <Button
                      key={tier.key}
                      variant="secondary"
                      disabled={pending || !billingEnabled}
                      onClick={() => run(() => subscribeTo(tier.key))}
                    >
                      {t("tplan.switchTo", {
                        name: tier.name,
                        amount: formatUsd(tier.monthlyCents),
                      })}
                    </Button>
                  ))}
                <Button variant="secondary" disabled={pending} onClick={() => run(() => cancelPlan())}>
                  {t("tplan.cancel")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : plans.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">{t("tplan.plansTitle")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t("tplan.plansBody")}</p>

          <div className="mt-3 space-y-2">
            {plans.map((tier) => (
              <div
                key={tier.key}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{tier.name}</span>
                  <span className="block text-xs text-slate-500">
                    {t("tplan.monthlyEvery", { amount: formatUsd(tier.monthlyCents) })}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  disabled={pending || !billingEnabled}
                  onClick={() => run(() => subscribeTo(tier.key))}
                >
                  {t("tplan.subscribe")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/*
        Credit is still real and still useful on pay as you go: it is money held
        against the session and AI fees, spent before anything new is billed.

        🔴 It is hidden on an unlimited plan rather than disabled, because there
        is nothing for credit to be spent on — every line is zero — and a
        working control that buys something unusable is worse than no control.
      */}
      {!unlimited ? (
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <label htmlFor="credit-amount" className="text-sm font-semibold text-slate-900">
            {t("tplan.topUp")}
          </label>
          <p className="mt-0.5 text-xs text-slate-500">{t("tplan.topUpBody")}</p>

          <div className="mt-3 flex items-center gap-3">
            <input
              id="credit-amount"
              type="range"
              min={1}
              max={200}
              step={1}
              value={dollars}
              onChange={(event) => setDollars(Number(event.target.value))}
              className="h-2 flex-1 cursor-pointer accent-brand-500"
            />
            <span className="w-20 shrink-0 text-end text-sm font-semibold tabular-nums text-slate-900">
              {formatUsd(amountCents)}
            </span>
          </div>

          <Button
            full
            className="mt-4"
            disabled={pending || !billingEnabled || dollars < 1}
            onClick={() => run(() => buyCredits(amountCents))}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {pending
              ? t("tled.openingCheckout")
              : t("tplan.addAmount", { amount: formatUsd(amountCents) })}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
