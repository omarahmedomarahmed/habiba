import Link from "next/link";
import { Check } from "lucide-react";

import { PriceTag } from "@/components/money/price-tag";
import { SeatLadder, type SeatBandRow } from "@/components/public/seat-ladder";
import { SeatSlider } from "@/components/public/seat-slider";
import { Button } from "@/components/ui";
import { egpRateMicro } from "@/lib/billing/manual";
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
import { seatMonthlyCents } from "@/lib/settings/defs";

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
 * The rate is read once here, on the server, and handed to every `PriceTag` as
 * a number. A price the marketing page converts differently from the checkout
 * is worse than a price shown only in dollars.
 *
 * ## 🔴 76.46 — AND IT IS THE OPERATOR'S RATE, NOT `quoteFor`
 *
 * This called `quoteFor("usd", "egp")` for nine days. C37 refuses a static rate
 * in production, there is no rate provider configured, so in production it
 * returned null on every render: `egpRate` was null, `PriceTag` renders no
 * toggle when it has no rate, and **nobody in Cairo could see a single price in
 * pounds on the pricing page.** It also logged an `error` every time, 198 of
 * them across 17 people, on the busiest route in the product.
 *
 * `lib/billing/manual.ts` had already written down why, one file over, for the
 * payment rail:
 *
 * > it is deliberately NOT `quoteFor`: `quoteFor` refuses a `static` rate in
 * > production (C37), so in production it returns nothing and this rail would
 * > have no number to show at all.
 *
 * The rail learned it and this page did not. `egpRateMicro()` is the rate an
 * operator sets on `/admin/settings` and the one every payment screen already
 * shows, so the marketing page and the checkout now quote the same number by
 * construction, which is what the paragraph above was asking for in the first
 * place.
 *
 * 🔴 `quoteFor` remains right where it is used: settling money. A rate nobody
 * checked must not price a charge, and refusing IS the correct answer there.
 * Showing somebody what a price is worth in their own currency is not settling.
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
  const egpRate = await egpRateMicro();

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
  const SHIPPED = ["payg", "practice", "clinic"] as const;
  const tierName = (tier: { key: string; name: string }) =>
    (SHIPPED as readonly string[]).includes(tier.key)
      ? t(`pricing.tier.${tier.key}` as "pricing.tier.payg")
      : tier.name;
  const tag = localeTag(locale);
  const money = (cents: number) => formatMoney(cents, "USD", tag);

  const tiers = settings.pricing.tiers;
  const platformFeeCents = settings.session.platformFeeCents;
  /*
   * 🔴 Sprint 57 — the axis is the MONTHLY price, not the threshold.
   *
   * This read `unlockCents > 0`, which was the right question when a tier was
   * bought with credit. Every threshold is zero now, so the same line returned
   * an empty list and the page silently stopped showing anything to buy —
   * without failing, without a blank space, and without a test noticing.
   *
   * `payg` is likewise the tier with no monthly price rather than the one with
   * no threshold, which after this sprint is all three of them.
   */
  const plans = tiers.filter((tier) => tier.monthlyCents > 0);
  const payg = tiers.find((tier) => tier.monthlyCents === 0) ?? tiers[0]!;
  const cheapestPlan = plans[0];

  /*
   * 🔴 62.10 / C323 — THE SEAT LADDER, DERIVED FROM THE BANDS RATHER THAN TYPED.
   *
   * Every figure below is `seatMonthlyCents` over `settings.pricing.seatBands`,
   * which is the same call `currentSeatBill` makes when a clinic is charged. The
   * ranges are read off the band list too, so an admin who adds a fourth band
   * gets a fourth row and a longer slider with no edit here.
   *
   * `verify:claims` asserts the other direction: no published string may name a
   * seat price these bands do not produce.
   */
  const bands = settings.pricing.seatBands;
  const SEAT_MAX = 12;
  const monthlyByCount = Array.from({ length: SEAT_MAX }, (_, i) =>
    seatMonthlyCents(i + 1, bands),
  );

  const seatRows: SeatBandRow[] = bands.map((band, i) => {
    const next = bands[i + 1];
    const upper = next ? next.from - 1 : null;
    return {
      /*
       * 🔴 A band one seat wide is a NUMBER, not a range.
       *
       * The shipped ladder starts at one seat and the second band opens at two,
       * so this printed "1 to 1" at the top of the table. It is not wrong, it
       * just is not how anybody writes it, and a pricing table that reads as
       * generated is a pricing table a reader trusts slightly less.
       */
      range:
        upper === null
          ? t("pricing.seatsRangeOpen", { from: band.from })
          : upper === band.from
            ? band.from === 1
              ? t("pricing.seatsCountOne")
              : t("pricing.seatsCount", { count: band.from })
            : t("pricing.seatsRange", { from: band.from, to: upper }),
      rate:
        band.perSeatCents > 0
          ? t("pricing.seatsEach", { amount: money(band.perSeatCents) })
          : t("pricing.seatsIncluded"),
      monthlyCents: seatMonthlyCents(band.from, bands),
    };
  });

  /*
   * 🔴 THE STEP, at the first band boundary, with both figures on it.
   *
   * On the shipped ladder that is seat two: $80 becomes $144 rather than $80
   * plus $72, because the rate is retroactive and the FIRST seat reprices to the
   * clinic rate the moment there are two. Computed rather than written, so
   * the sentence cannot survive a reprice as a wrong number. Null when there is
   * only one band, in which case there is no step to warn about.
   */
  const boundary = bands[1]?.from ?? null;
  const seatStep =
    boundary !== null
      ? {
          count: boundary,
          from: money(seatMonthlyCents(boundary - 1, bands)),
          to: money(seatMonthlyCents(boundary, bands)),
        }
      : null;

  const cut = (settings.session.platformFeeBps / 100).toFixed(0);

  /*
   * 🔴 76.72 — THE THREE TIERS, SIDE BY SIDE, ABOVE EVERYTHING ELSE.
   *
   * What was here was a headline, three centred paragraphs, two "line" cards,
   * two plan cards, a ladder and eight more sentences. Every fact was correct
   * and a visitor could not answer "what does this cost me" without reading the
   * whole page. The founder's instruction was blunt and right: the page opens
   * and you see three tiers.
   *
   * The prose that was here is not deleted, it has moved into the grid below,
   * where the same facts answer the question a reader is actually holding: what
   * is in each, what is not, and what it costs if I subscribe.
   */
  const paygSession = money(platformFeeCents);
  const paygAi = money(payg.aiRateCents);
  const practice = plans.find((tier) => tier.key === "practice") ?? cheapestPlan;
  const seatFrom = bands[bands.length - 1]?.perSeatCents ?? bands[0]?.perSeatCents ?? 0;

  const cards: {
    key: string;
    name: string;
    who: string;
    price: React.ReactNode;
    under: string;
    bullets: string[];
    cta: { label: string; href: string };
    note?: string;
    featured?: boolean;
  }[] = [
    {
      key: "payg",
      name: t("pricing.tier.payg"),
      who: t("pr2.anySession"),
      price: (
        <PriceTag usdCents={platformFeeCents} rateMicro={egpRate} locale={tag} size="lg" />
      ),
      under: t("pr2.paygAi", { amount: paygAi }),
      bullets: [
        t("pr2.nothingMonthly"),
        t("pricing.feature.note"),
        t("pricing.feature.video"),
        t("pricing.feature.alerts"),
        t("pricing.feature.getPaid"),
      ],
      cta: { label: t("pricing.signUp"), href: "/signup" },
      note: t("pr2.noCard"),
    },
  ];

  if (practice) {
    cards.push({
      key: "practice",
      name: t("pricing.tier.practice"),
      who: t("pr2.forOne"),
      price: (
        <PriceTag usdCents={practice.monthlyCents} rateMicro={egpRate} locale={tag} size="lg" />
      ),
      under: t("pr2.unlimited"),
      bullets: [
        t("pricing.feature.transcription"),
        t("pricing.feature.report"),
        t("pricing.feature.baa"),
        t("pr2.rowCopilot"),
        t("pr2.rowRadar"),
      ],
      cta: { label: t("pricing.signUp"), href: "/signup" },
      note: t("pr2.badgeNoMeter"),
      featured: true,
    });
  }

  cards.push({
    key: "clinic",
    name: t("pricing.tier.clinic"),
    who: t("pr2.forTeam"),
    price: (
      <SeatSlider
        monthlyByCount={monthlyByCount}
        rateMicro={egpRate}
        locale={tag}
        label={t("pricing.seatsSlider")}
        countLabels={Array.from({ length: SEAT_MAX }, (_, i) =>
          i === 0 ? t("pricing.seatsCountOne") : t("pricing.seatsCount", { count: i + 1 }),
        )}
      />
    ),
    under: t("pr2.seatBody"),
    bullets: [
      t("pr2.seatFrom", { amount: money(seatFrom) }),
      t("pr2.rowClinicBooks"),
      t("pricing.feature.baa"),
      t("pr2.rowCopilot"),
      t("pr2.rowRadar"),
    ],
    cta: { label: t("pr2.talkToUs"), href: "/clinic/apply" },
  });

  /*
   * 🔴 THE GRID, AND WHY EVERY CELL IS A FACT RATHER THAN A TICK.
   *
   * "What is included, what is not included, and the price if subscribed" was
   * the instruction, and a table of ticks answers only the first third of it.
   * So the money rows carry figures, the absence rows say "not included" in
   * words, and the one row where all three are identical — our cut — is left in
   * rather than dropped, because a reader looking for the catch looks there.
   *
   * Every figure is `settings`, like everything else on this page. Nothing here
   * is typed.
   */
  const YES = "yes" as const;
  const NO = "no" as const;
  const grid: { label: string; cells: (string | typeof YES | typeof NO)[] }[] = [
    {
      label: t("pr2.rowMonthly"),
      cells: [
        t("pr2.none"),
        practice ? money(practice.monthlyCents) : t("pr2.none"),
        t("pr2.seatFrom", { amount: money(seatFrom) }),
      ],
    },
    {
      label: t("pr2.rowPerSession"),
      cells: [paygSession, t("pr2.none"), t("pr2.none")],
    },
    {
      label: t("pr2.rowAi"),
      cells: [paygAi, t("pr2.includedWord"), t("pr2.includedWord")],
    },
    { label: t("pricing.feature.note"), cells: [YES, YES, YES] },
    { label: t("pricing.feature.transcription"), cells: [YES, YES, YES] },
    { label: t("pricing.feature.report"), cells: [YES, YES, YES] },
    { label: t("pricing.feature.video"), cells: [YES, YES, YES] },
    { label: t("pricing.feature.alerts"), cells: [YES, YES, YES] },
    { label: t("pr2.rowCopilot"), cells: [YES, YES, YES] },
    { label: t("pr2.rowRadar"), cells: [YES, YES, YES] },
    { label: t("pricing.feature.getPaid"), cells: [YES, YES, YES] },
    { label: t("pricing.feature.baa"), cells: [YES, YES, YES] },
    { label: t("pr2.rowSeats"), cells: [NO, NO, YES] },
    { label: t("pr2.rowClinicBooks"), cells: [NO, NO, YES] },
    {
      label: t("pr2.rowCut"),
      cells: [
        t("pr2.cutValue", { percent: cut }),
        t("pr2.cutValue", { percent: cut }),
        t("pr2.cutValue", { percent: cut }),
      ],
    },
  ];

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {compact ? t("pricing.free") : t("pr2.title")}
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">
            {compact ? t("pricing.freeBody") : t("pr2.body")}
          </p>
        </div>

        <div className="mt-9 grid items-stretch gap-5 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.key}
              className={
                card.featured
                  ? "relative flex flex-col rounded-3xl border-2 border-brand-500 bg-white p-6 shadow-xl shadow-brand-500/10"
                  : "relative flex flex-col rounded-3xl border border-slate-200 bg-white p-6"
              }
            >
              <p className="text-sm font-bold text-slate-900">{card.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{card.who}</p>

              <div className="mt-4">{card.price}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{card.under}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2.5 text-[13px] leading-snug text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />
                    {bullet}
                  </li>
                ))}
              </ul>

              <Link href={card.cta.href} className="mt-6 block">
                <Button full variant={card.featured ? "primary" : "secondary"}>
                  {card.cta.label}
                </Button>
              </Link>
              {card.note ? (
                <p className="mt-2 text-center text-[11px] text-slate-500">{card.note}</p>
              ) : null}
            </div>
          ))}
        </div>

        <p className="mt-5 text-center text-sm text-slate-600">{t("pricing.patientPaysNothing")}</p>

        {!compact ? (
          <>
            {/* ─────────────────────────────────── what is in each ── */}
            <div className="mt-16">
              <div className="mx-auto max-w-2xl text-center">
                <h3 className="text-xl font-bold tracking-tight text-slate-900">
                  {t("pr2.compareTitle")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t("pr2.compareBody")}
                </p>
              </div>

              {/* The table scrolls, never the page. Three money columns at 360px
                  cannot be narrowed without lying about a number. */}
              <div className="mt-7 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-start">
                      <th
                        scope="col"
                        className="px-4 py-3 text-start text-[11px] font-bold tracking-wider text-slate-600 uppercase"
                      >
                        {t("pr2.colFeature")}
                      </th>
                      {cards.map((card) => (
                        <th
                          key={card.key}
                          scope="col"
                          className="px-4 py-3 text-start text-[11px] font-bold tracking-wider text-slate-900 uppercase"
                        >
                          {card.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row) => (
                      <tr key={row.label} className="border-b border-slate-100 last:border-0">
                        <th
                          scope="row"
                          className="px-4 py-2.5 text-start text-[13px] font-medium text-slate-900"
                        >
                          {row.label}
                        </th>
                        {row.cells.map((cell, i) => (
                          <td key={i} className="px-4 py-2.5 text-[13px] text-slate-700">
                            {cell === YES ? (
                              <Check className="h-4 w-4 text-teal-500" aria-label={t("pr2.includedWord")} />
                            ) : cell === NO ? (
                              <span className="text-slate-400">{t("pr2.notIncluded")}</span>
                            ) : (
                              cell
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ────────────────────────────── the seat bands in full ── */}
            {seatRows.length > 0 ? (
              <div className="mt-16">
                <div className="mx-auto max-w-2xl text-center">
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">
                    {t("pricing.seatsTitle")}
                  </h3>
                </div>
                <SeatLadder
                  rows={seatRows}
                  monthlyByCount={monthlyByCount}
                  rateMicro={egpRate}
                  locale={tag}
                  strings={{
                    headSeats: t("pricing.seatsHeadSeats"),
                    headRate: t("pricing.seatsHeadRate"),
                    headMonthly: t("pricing.seatsHeadMonthly"),
                    sliderLabel: t("pricing.seatsSlider"),
                    seatsByCount: Array.from({ length: SEAT_MAX }, (_, i) =>
                      i === 0
                        ? t("pricing.seatsCountOne")
                        : t("pricing.seatsCount", { count: i + 1 }),
                    ),
                  }}
                />
                {seatStep ? (
                  <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
                    {t("pricing.seatsStep", seatStep)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ─────────────────────────────── the standing promises ── */}
            <div className="mx-auto mt-16 max-w-2xl space-y-3 text-center">
              <p className="text-base font-semibold text-slate-900">{t("pricing.noFees")}</p>
              <p className="text-sm leading-relaxed text-slate-600">
                {t("pricing.credits", { months: settings.pricing.creditExpiryMonths })}
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                {t("pricing.creditIsMoney")}
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-900">{t("pricing.radarLead")}</span>{" "}
                {t("pricing.radarBody", { percent: cut })}
              </p>

              {/*
                🔴 C69 — published only when netting is switched on, and written
                conditionally: it is true of clinicians whose earnings we hold and
                not of one paid straight into their own Stripe account.
              */}
              {settings.payouts.netFeeFromHeldEarnings ? (
                <p className="text-sm leading-relaxed text-slate-600">{t("pricing.netting")}</p>
              ) : null}
            </div>
          </>
        ) : (
          <Link href="/signup" className="mx-auto mt-8 block max-w-xs">
            <Button full>{t("pricing.signUp")}</Button>
          </Link>
        )}
      </div>
    </section>
  );
}
