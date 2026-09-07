import Link from "next/link";
import { Check } from "lucide-react";

import { BundleSlider } from "@/components/public/bundle-slider";
import { PriceTag } from "@/components/money/price-tag";
import { Button } from "@/components/ui";
import { quoteFor } from "@/lib/billing/fx";
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

  const tiers = settings.pricing.tiers;
  const bundles = tiers.filter((tier) => tier.minimumSessions > 0);
  const best = bundles[bundles.length - 1];

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

      {/* 17.2 — the cards are the first thing on the page. No hero above them. */}
      <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.key}
            className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6"
          >
            {/*
              🔴 21R.8 — a tier's name is a *setting*, stored once in English,
              and an Arabic reader should not meet the word "Growth" on the
              money page. The dictionary answers for the three tiers this
              product ships; anything an admin adds later falls back to the
              name they typed, which is the honest behaviour — better their
              English than our guess at their Arabic.
            */}
            <p className="text-sm font-semibold text-brand-600">
              {tierName(tier)}
            </p>

            <p className="mt-3 flex items-baseline gap-1.5">
              <PriceTag
                usdCents={tier.rateCents}
                rateMicro={egpRate}
                locale={tag}
                size="lg"
                unit={t("pricing.perSession")}
              />
            </p>

            <p className="mt-2 text-sm text-slate-600">
              {tier.minimumSessions === 0
                ? t("pricing.payg")
                : t("pricing.bundle", { count: tier.minimumSessions })}
            </p>

            {/*
              What the per-session price includes, stated at the price rather
              than eleven bullets below it. A therapist comparing $4 with a
              competitor's $4 is comparing the wrong thing if the copilot
              allowance is invisible here.
            */}
            <p className="mt-3 rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-900">
              {t("pricing.includes", {
                count: settings.copilot.messagesPerPatientPerSession,
              })}
            </p>

            {!compact ? (
              <ul className="mt-6 flex-1 space-y-2.5">
                {[
                  t("pricing.feature.transcription"),
                  t("pricing.feature.note"),
                  t("pricing.feature.report"),
                  t("pricing.feature.video"),
                  t("pricing.feature.alerts"),
                  t("pricing.feature.getPaid"),
                  t("pricing.feature.baa"),
                ].map((feature) => (
                  <li
                    key={feature}
                    className="flex gap-2.5 text-sm text-slate-700"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-teal-500"
                      aria-hidden
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1" />
            )}

            {/*
              17.6 — "Sign up free" is the primary action on every card, on both
              pages. Never "choose a plan": there are no plans, and a button
              that says there are is a button that starts the relationship with
              a false statement.
            */}
            <Link href="/signup" className="mt-6">
              <Button
                full
                variant={tier.minimumSessions === 0 ? "primary" : "secondary"}
              >
                {t("pricing.signUp")}
              </Button>
            </Link>

            {tier.minimumSessions > 0 ? (
              <Link
                href="/billing"
                className="mt-2 text-center text-xs font-medium text-slate-500 underline underline-offset-2"
              >
                {t("pricing.orBundle", { count: tier.minimumSessions })}
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      {/* 17.4 — the slider, on the cheapest bundle. */}
      {best ? (
        <BundleSlider
          name={tierName(best)}
          rateCents={best.rateCents}
          minimum={best.minimumSessions}
          paygRateCents={tiers[0]?.rateCents ?? best.rateCents}
          egpRateMicro={egpRate}
          locale={tag}
          strings={{
            label: t("pricing.sliderLabel", { name: tierName(best) }),
            showEgp: t("pricing.showEgp"),
            showUsd: t("pricing.showUsd"),
            at: t("pricing.sliderAt", { count: "{count}", price: "{price}" }),
            once: t("pricing.sliderOnce", {
              months: settings.pricing.creditExpiryMonths,
            }),
            saved: t("pricing.sliderSaved", {
              count: "{count}",
              payg: "{payg}",
              saved: "{saved}",
            }),
          }}
        />
      ) : null}

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
