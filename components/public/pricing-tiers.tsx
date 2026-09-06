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
export async function PricingTiers({ compact = false }: { compact?: boolean }) {
  const settings = await getSettings();
  const quote = await quoteFor("usd", "egp");
  const egpRate = quote?.rateMicro ?? null;

  /*
   * 19.4 — the reader's language, resolved once on the server and handed to
   * every price below. Nothing under here asks the runtime what locale it is.
   */
  const { locale } = await getI18n();
  const tag = localeTag(locale);

  const tiers = settings.pricing.tiers;
  const bundles = tiers.filter((tier) => tier.minimumSessions > 0);
  const best = bundles[bundles.length - 1];

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      {compact ? (
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Joining is free. You pay per session.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            No subscription, no seat fee, no setup fee — and your first completed session is on us.
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
            <p className="text-sm font-semibold text-brand-600">{tier.name}</p>

            <p className="mt-3 flex items-baseline gap-1.5">
              <PriceTag usdCents={tier.rateCents} rateMicro={egpRate} locale={tag} size="lg" />
              <span className="text-sm text-slate-500">/ session</span>
            </p>

            <p className="mt-2 text-sm text-slate-600">
              {tier.minimumSessions === 0
                ? "Pay for the sessions you actually run. Nothing up front."
                : `Buy ${tier.minimumSessions} or more at once.`}
            </p>

            {/*
              What the per-session price includes, stated at the price rather
              than eleven bullets below it. A therapist comparing $4 with a
              competitor's $4 is comparing the wrong thing if the copilot
              allowance is invisible here.
            */}
            <p className="mt-3 rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-900">
              The session <span className="font-semibold">and</span>{" "}
              {settings.copilot.messagesPerPatientPerSession} copilot questions about that patient
              — each answer citing the session and timestamp it came from.
            </p>

            {!compact ? (
              <ul className="mt-6 flex-1 space-y-2.5">
                {[
                  "Live transcription, Arabic and English",
                  "SOAP note in under a minute",
                  "Patient report by email",
                  "Video or in-person sessions",
                  "Crisis-language alerts",
                  "Get paid by patients — Crisis Radar and paid session links",
                  "HIPAA BAA included",
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

            {/*
              17.6 — "Sign up free" is the primary action on every card, on both
              pages. Never "choose a plan": there are no plans, and a button
              that says there are is a button that starts the relationship with
              a false statement.
            */}
            <Link href="/signup" className="mt-6">
              <Button full variant={tier.minimumSessions === 0 ? "primary" : "secondary"}>
                Sign up free
              </Button>
            </Link>

            {tier.minimumSessions > 0 ? (
              <Link
                href="/billing"
                className="mt-2 text-center text-xs font-medium text-slate-500 underline underline-offset-2"
              >
                or buy a bundle of {tier.minimumSessions}
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      {/* 17.4 — the slider, on the cheapest bundle. */}
      {best ? (
        <BundleSlider
          name={best.name}
          rateCents={best.rateCents}
          minimum={best.minimumSessions}
          paygRateCents={tiers[0]?.rateCents ?? best.rateCents}
          egpRateMicro={egpRate}
          locale={tag}
        />
      ) : null}

      {/*
        17.3 — the free-to-use statement and the radar line, under the cards
        and above everything else.
      */}
      <div className="mx-auto mt-10 max-w-2xl space-y-3 text-center">
        <p className="text-base font-semibold text-slate-900">
          Joining is free. No subscription, no seat fee, no setup fee.
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          You pay per session, only when you run one, and your first completed session is free.
          Credits last {settings.pricing.creditExpiryMonths} months and are always spent before
          anything new is billed, so moving to a smaller bundle never strands what you paid for.
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Get booked on the Crisis Radar.</span>{" "}
          Patients find you and book you, and we take{" "}
          {(settings.session.platformFeeBps / 100).toFixed(0)}% of what that session paid you —
          nothing else.
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
            When we are holding your earnings, the session fee comes out of them automatically —
            nothing to pay by card. If your patients pay straight into your own Stripe account, we
            bill you for it instead.
          </p>
        ) : null}
      </div>
    </section>
  );
}
