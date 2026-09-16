"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { cancelPlan, resumePlan, upgradeAndPay } from "@/app/(app)/billing/actions";
import { Badge, Button, Card } from "@/components/ui";
import { Money } from "@/components/ui/money";
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
  needsTransfer,
  paymentStorageKey,
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
  /**
   * 🔴 76.34 — WHICH RAIL, because the confirmation has to say what happens next.
   *
   * On the transfer rail "Confirm and pay" raises the bill and opens the sheet
   * in place. On Stripe it leaves for a checkout. Telling somebody the wrong
   * one is how a person ends up watching for a page that is not coming.
   */
  needsTransfer: boolean;
  /**
   * The key `PaymentPopup` remembers its open state under, so confirming here
   * can open the sheet down the page. The organisation, never a person.
   */
  paymentStorageKey: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const t = useT();

  const payg = tiers.find((tier) => tier.monthlyCents === 0) ?? tiers[0]!;
  const plans = tiers.filter((tier) => tier.monthlyCents > 0);
  const current = tiers.find((tier) => tier.key === currentTierKey) ?? payg;
  const unlimited = current.monthlyCents > 0;

  /*
   * 🔴 76.34 — WHICH TIER THEY ARE LOOKING AT, which is not which tier they
   * have bought.
   *
   * Tapping a card used to subscribe on the spot. A plan is a recurring charge
   * and the one thing every clinician asked about it was what happens to the
   * per-session fee, which the button could not answer because it had already
   * fired. So a tap SELECTS, the panel under the cards answers the question,
   * and a second, differently worded control is what spends money.
   */
  const [considering, setConsidering] = useState<string | null>(null);

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

          {/*
            🔴 76.34 — THE PRICES MOVED TO THE CARDS AND ARE NOT SAID TWICE.

            This block used to repeat, in two sentences, exactly what the tier
            cards further down now say on the card that is marked as yours. The
            new cards made the header a duplicate, and a duplicate on a money
            screen is not neutral: two statements of one price is two things to
            keep in step, and the prose ratchet counted every word of it.

            🔴 WHAT STAYS IS C209, which the cards cannot carry.

            "The AI fee is never charged when a patient declines" is a
            protection rather than a price. It exists so that no amount rides on
            the most vulnerable person in the room agreeing to be recorded, and
            it belongs where somebody reads their OWN arrangement rather than in
            a grid they are comparing. An unlimited plan reaches the same
            protection from the other side and says so.
          */}
          {unlimited ? (
            <>
              <p className="mt-0.5 text-sm text-slate-500">{t("tplan.unlimitedNoMeter")}</p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-slate-500">{t("tplan.aiNever")}</p>
            </>
          )}
        </div>
        {creditRemainingCents > 0 ? (
          <Badge tone="teal"><Money cents={creditRemainingCents} /></Badge>
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
            <Money cents={spentPlatformCents} />
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{t("tplan.spentAi")}</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900"><Money cents={spentAiCents} /></dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{t("tplan.creditBalance")}</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">
            <Money cents={creditRemainingCents} />
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{t("tplan.heldEarnings")}</dt>
          <dd className="mt-0.5 text-2xl font-bold text-slate-900">
            <Money cents={heldEarningsCents} />
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
              <div className="mt-4">
                <Button variant="secondary" disabled={pending} onClick={() => run(() => cancelPlan())}>
                  {t("tplan.cancel")}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/*
        🔴 76.34 — THE PLANS AS CARDS, WITH THE ONE THEY ARE ON MARKED.
        ---------------------------------------------------------------
        Two problems with the list this replaces, and both are about what a
        clinician can actually decide from it.

        It showed only the plans they were NOT on, so the thing they are paying
        for today was absent from the comparison and there was nothing to weigh
        an upgrade against. And every row ended in a button that subscribed on
        the tap, on a recurring charge, with no statement of what changes.

        So: every tier is a card, pay as you go included, the current one is
        outlined and carries a tick, and a tap SELECTS rather than buys. The
        panel underneath is where the money is spent, and it is worded
        differently on purpose.
      */}
      {plans.length > 0 ? (
        <div className="mt-5">
          {/*
            🔴 76.34 — THE BLURB UNDER THIS HEADING IS GONE, and the cards are
            why. It read "one price a month: unlimited sessions and AI, nothing
            per session", which is exactly what each card now says about itself,
            on the card, beside its own price.
          */}
          <p className="text-sm font-semibold text-slate-900">{t("tplan.plansTitle")}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[payg, ...plans].map((tier) => {
              const isCurrent = tier.key === current.key;
              const chosen = considering === tier.key;
              return (
                <button
                  key={tier.key}
                  type="button"
                  aria-pressed={chosen}
                  disabled={pending || isCurrent || !billingEnabled}
                  onClick={() => setConsidering(chosen ? null : tier.key)}
                  className={
                    isCurrent
                      ? "rounded-2xl border-2 border-brand-500 bg-brand-50 p-3.5 text-start"
                      : chosen
                        ? "rounded-2xl border-2 border-slate-900 bg-white p-3.5 text-start"
                        : "rounded-2xl border border-slate-200 bg-white p-3.5 text-start"
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900">{tier.name}</span>
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <Check className="h-2.5 w-2.5" aria-hidden />
                        {t("tplan.yours")}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-lg font-bold tracking-tight text-slate-900">
                    {tier.monthlyCents > 0
                      ? t("tplan.monthlyEvery", { amount: formatUsd(tier.monthlyCents) })
                      : t("tplan.paygPrice", { amount: formatUsd(platformFeeCents) })}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    {tier.monthlyCents > 0
                      ? t("tplan.unlimitedNoMeter")
                      : t("tplan.aiRate", { amount: formatUsd(tier.aiRateCents) })}
                  </span>
                </button>
              );
            })}
          </div>

          {/*
            🔴 THE DETAILS BEFORE THE MONEY, WHICH IS THE WHOLE CHANGE.

            A recurring charge deserves a sentence about what it does to the
            per-session fee, when it starts, and what paying for it looks like
            on this account's rail. None of that fitted on a button, so none of
            it was said.

            🔴 AND IT SAYS WHICH RAIL. On the transfer rail the sheet opens on
            this page and an operator confirms the money; on Stripe the browser
            leaves for a checkout. Somebody told the wrong one waits for a page
            that is not coming.
          */}
          {considering && considering !== current.key ? (
            <div className="mt-3 rounded-2xl border-2 border-slate-900 bg-white p-4">
              {(() => {
                const tier = tiers.find((row) => row.key === considering);
                if (!tier) return null;
                const up = tier.monthlyCents > 0;
                return (
                  <>
                    <p className="text-sm font-bold text-slate-900">
                      {up
                        ? t("tplan.confirmTitle", { name: tier.name })
                        : t("tplan.confirmDownTitle")}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
                      <li>
                        {up
                          ? t("tplan.confirmCost", { amount: formatUsd(tier.monthlyCents) })
                          : t("tplan.confirmDownCost", { amount: formatUsd(platformFeeCents) })}
                      </li>
                      <li>{up ? t("tplan.confirmMeter") : t("tplan.confirmDownMeter")}</li>
                      <li>{t("tplan.confirmCancel")}</li>
                      <li>
                        {needsTransfer ? t("tplan.confirmTransfer") : t("tplan.confirmCard")}
                      </li>
                    </ul>
                    <div className="mt-4 flex gap-2">
                      <Button
                        full
                        disabled={pending || !billingEnabled}
                        onClick={() =>
                          run(async () => {
                            const result = await upgradeAndPay(tier.key);
                            if (result?.error) return result;
                            /*
                             * 🔴 OPEN THE SHEET THEY JUST AGREED TO PAY.
                             *
                             * The same key `PaymentPopup` reads on mount, so
                             * "confirm and pay" ends on the account number
                             * rather than on a line item appearing somewhere
                             * further down a page. Wrapped, because blocked
                             * site data must cost the convenience and never
                             * the payment: the bill is raised either way and
                             * the sheet is one tap from the bar at the top.
                             */
                            try {
                              window.localStorage.setItem(`pay:${paymentStorageKey}`, "open");
                            } catch {
                              /* The bar in the portal is still the way back. */
                            }
                            window.location.reload();
                            return {};
                          })
                        }
                      >
                        {pending ? t("tled.openingCheckout") : t("tplan.confirmAndPay")}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => setConsidering(null)}
                        /* Two words on one line. It wrapped at 430 pixels. */
                        className="whitespace-nowrap"
                      >
                        {t("tplan.confirmNotNow")}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>
      ) : null}


    </Card>
  );
}
