import Link from "next/link";
import { Check } from "lucide-react";

import { PriceTag } from "@/components/money/price-tag";
import { Button } from "@/components/ui";
import { quoteFor } from "@/lib/billing/fx";
/*
 * 🔴 19.4 — `formatMoney` with the reader's tag, never `formatUsd`.
 *
 * `formatUsd` says `en-US` out loud and is the shorthand for the English-only
 * portal and admin screens. This page is read by a patient and by a visitor in
 * Cairo, so the money is formatted in their language with Western digits, the
 * same rule every other figure on the public site follows.
 */
import { formatMoney } from "@/lib/billing/plans";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

/**
 * The three rates. PLAN.md 17.2–17.8, 17.10.
 *
 * ## One component, two pages (17.7)
 *
 * The pricing page and the homepage render **this**, not a copy of it. C60 was
 * exactly the failure that copying produces: the pricing page went on selling
 * $6 and an "Unlimited" plan for a fortnight after sprint 1 repriced
 * everything, because a second copy of the numbers had nobody watching it.
 *
 * ## Every figure comes from `platform_settings` (17.10)
 *
 * Read at render time, on the server, from the same rows the invoice reads.
 * There is no number typed into this file — not the rate, not the minimum, not
 * the copilot allowance, not the cut. An admin changing a rate changes this
 * page on the next request, with no deploy and no second edit.
 *
 * ## The EGP toggle (17.8, 16.4)
 *
 * The rate is quoted once here, on the server, and handed to every `PriceTag`
 * as a number. A price the marketing page converts differently from the
 * checkout is worse than a price shown only in dollars — and C37 refuses a
 * pair it cannot price, in which case the toggle simply does not appear.
 */
export async function PricingTiers({
  compact = false,
  locale: given,
}: {
  compact?: boolean;
  /**
   * 21R.8 — the language, when the caller already resolved it. Unset in the
   * app, where the reader's cookie decides; set by the render check, which has
   * no cookie and picks its row by locale.
   */
  locale?: string;
}) {
  const settings = await getSettings();
  const quote = await quoteFor("usd", "egp");
  const egpRate = quote?.rateMicro ?? null;

  /*
   * 19.4 — the reader's language, resolved once on the server and handed to
   * every price below. Nothing under here asks the runtime what locale it is.
   */
  const resolved = given
    ? await (async () => {
        const { stringsFor } = await import("@/lib/i18n/strings");
        const { t } = await stringsFor(given);
        const { isLocale } = await import("@/lib/i18n/config");
        // A locale the product does not ship still formats money as English
        // rather than asking the runtime — C84's rule, one level down.
        return { locale: isLocale(given) ? given : "en", t };
      })()
    : await getI18n();
  const { locale, t } = resolved;

  /*
   * The three tiers this product ships are named in the dictionary; anything
   * an admin adds later keeps the name they typed. Falling back to their
   * English beats inventing an Arabic name for a tier nobody translated.
   */
  const SHIPPED = ["payg", "starter", "growth"] as const;
  const tierName = (tier: { key: string; name: string }) =>
    (SHIPPED as readonly string[]).includes(tier.key)
      ? t(`pricing.tier.${tier.key}` as "pricing.tier.payg")
      : tier.name;
  const tag = localeTag(locale);
  const money = (cents: number) => formatMoney(cents, "USD", tag);

  const tiers = settings.pricing.tiers;
  const platformFeeCents = settings.session.platformFeeCents;
  /*
   * 46.3 — the tiers that cost something to reach. `payg` has a zero
   * threshold and is the headline rate rather than a card you can buy.
   */
  const plans = tiers.filter((tier) => tier.unlockCents > 0);
  const payg = tiers.find((tier) => tier.unlockCents === 0) ?? tiers[0]!;
  const best = plans[plans.length - 1];

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      {compact ? (
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t("pricing.free")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t("pricing.freeBody")}
          </p>
        </div>
      ) : null}

      {/*
        🔴 46.9 — two lines, in this order, and the order is the ethics.
        The fee that is always charged comes first and says so. The fee that
        depends on the patient comes second and says what happens when they
        decline. A page that led with the conditional one would be selling the
        AI and burying the thing that makes it safe to decline (C209).
      */}
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t("pricing.headline", {
            amount: money(platformFeeCents),
            ai: money(payg.aiRateCents),
          })}
        </h2>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-brand-600">
              {t("pricing.platformLine", { amount: money(platformFeeCents) })}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {t("pricing.platformWhat")}
            </p>
            {!compact ? (
              <ul className="mt-6 flex-1 space-y-2.5">
                {[
                  t("pricing.feature.note"),
                  t("pricing.feature.video"),
                  t("pricing.feature.alerts"),
                  t("pricing.feature.getPaid"),
                  t("pricing.feature.baa"),
                ].map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1" />
            )}
          </div>

          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-brand-600">
              {t("pricing.aiLine", { amount: money(payg.aiRateCents) })}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{t("pricing.aiWhat")}</p>
            {!compact ? (
              <ul className="mt-6 flex-1 space-y-2.5">
                {[t("pricing.feature.transcription"), t("pricing.feature.report")].map(
                  (feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />
                      {feature}
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </div>

        {/*
          🔴 46.10 — this sentence is here and its opposite number is not.
          "Your patient never pays us anything" is true and is ours to say.
          "Raise your price because you use AI" is also true and is NOT ours:
          we do not tell a clinician what to charge somebody.
        */}
        <p className="mt-4 text-center text-sm text-slate-600">
          {t("pricing.patientPaysNothing")}
        </p>

        {/*
          46.3 — the plans, as dollar figures with what each unlocks. The word
          "sessions" does not appear, because $30 does not buy ten of anything.
        */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {plans.map((tier) => (
            <div
              key={tier.key}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center"
            >
              <p className="text-sm font-semibold text-brand-600">{tierName(tier)}</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {t("pricing.unlockBy", { amount: money(tier.unlockCents) })}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {t("pricing.unlockGets", { amount: money(tier.aiRateCents) })}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-sm leading-relaxed text-slate-600">
          {t("pricing.creditIsMoney")}
        </p>

        <Link href="/signup" className="mx-auto mt-8 block max-w-xs">
          <Button full>{t("pricing.signUp")}</Button>
        </Link>
      </div>

      {/*
        🔴 17.4's bundle slider is GONE, struck by 46.3 / C223.
        
        It let a visitor drag a number of sessions and watch a total. Every
        part of that is the bundle this sprint removed: there is no quantity to
        choose, the money buys credit rather than sessions, and what a
        threshold buys is a rate that outlives the credit. A slider over
        session counts would have been a working control computing a number
        that means nothing, which is worse than no control at all.
        
        The two plan cards above say the same thing in the shape the offer
        actually has: spend this, get that rate, keep it.
      */}

      {/*
        17.3 — the free-to-use statement and the radar line, under the cards
        and above everything else.
      */}
      <div className="mx-auto mt-10 max-w-2xl space-y-3 text-center">
        <p className="text-base font-semibold text-slate-900">
          {t("pricing.noFees")}
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          {t("pricing.credits", {
            months: settings.pricing.creditExpiryMonths,
          })}
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">
            {t("pricing.radarLead")}
          </span>{" "}
          {t("pricing.radarBody", {
            percent: (settings.session.platformFeeBps / 100).toFixed(0),
          })}
        </p>

        {/*
          🔴 C69, ruled in sprint 16: netting is real now, and this sentence is
          only published when it is switched on. It is also written
          conditionally, because it is true of clinicians whose earnings we
          hold and not of a clinician paid straight into their own Stripe
          account — which is most international ones. "Describes a mechanic
          that does not exist" was the original complaint; describing it as
          universal when it is not would be the same mistake in a smaller font.
        */}
        {settings.payouts.netFeeFromHeldEarnings ? (
          <p className="text-sm leading-relaxed text-slate-600">
            {t("pricing.netting")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
