import type { Metadata } from "next";

import { ExpiryNotice, expiryState } from "@/components/sponsor/expiry-notice";
import { SpendHeatmap } from "@/components/sponsor/spend-heatmap";
import { Card } from "@/components/ui";
import { potTerms } from "@/lib/data/sponsor-admin";
import { potBalance, roster, weeklySpend } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The sponsor's overview. PLAN.md 53.25, 53.26, 53.27, C228, C229, C244.
 *
 * ## 🔴 53.27 — EVERY FIGURE IS A LEDGER QUERY, AND EVERY ONE PASSES THE FLOORS
 *
 * The balance, the total spent and the session count all come from
 * `ledger_entries` rather than from a counter somebody increments. The weekly
 * series comes from `weeklySpend`, which groups by week IN SQL so no daily figure
 * exists anywhere in the pipeline to leak, and then through `applyActivityFloor`
 * before it reaches this file.
 *
 * ## 🔴 SPEND, NEVER SESSION COUNTS, NEVER PEOPLE (C228) — with one exception
 *
 * The total session count is here because 53.25 asks for it and because it is an
 * all-time total across the whole organisation, which identifies nobody. The
 * WEEKLY series is spend only: a week with one session and a number beside it is
 * one person's therapy, and C229's differencing attack is built out of exactly
 * that.
 *
 * ## 🔴 The headcount floor is read here and the roster is counted for it
 *
 * *Below a headcount setting the sponsor sees the balance and nothing else,
 * cohorts included.* So this page counts the roster and, under the floor, renders
 * the balance and the explanation and no series at all. Not a filtered series: a
 * filtered series with one row left in it is the leak wearing a suppression
 * label.
 */
export default async function SponsorOverviewPage() {
  const actor = await requireSponsor();
  const { t, locale } = await getI18n();
  const settings = await getSettings();

  const floor = settings.sponsor.activityFloor;

  /*
   * 🔴 C377 — the PUBLISHED balance, never the live one.
   *
   * This read `ledgerPotBalance` directly, which is the exact figure that moves
   * by one session's price the moment one session happens. A sponsor reading it
   * on two days differences them and learns what one named person's session
   * cost, which is the attack the heatmap below is already suppressed to stop.
   *
   * `potBalance` applies the same floor the heatmap uses and can return NULL,
   * which means "not enough has happened to report a balance" and is a
   * different fact from zero.
   */
  const [pot, people, terms] = await Promise.all([
    potBalance(actor.sponsorId),
    roster(actor.sponsorId),
    potTerms(actor.sponsorId),
  ]);
  /*
   * 🔴 E1 — "Spent so far" and "Sessions paid for" come from the SAME
   * publication as the balance, never from `potTotals`. Live, they moved by one
   * session the moment one employee had one, beside a balance floored to stop
   * exactly that (seen on production, the stop condition of 2026-09-22).
   */
  const totals = pot.published;

  /*
   * 🔴 C229 — the headcount gate, decided before the series is even fetched.
   *
   * Fetching it and then not rendering it would put suppressed weekly figures in
   * a server component's props and in any log that touched them. The cheapest
   * way to not leak a number is to not read it.
   */
  const underFloor = people.length < floor;
  const weeks = underFloor ? [] : await weeklySpend(actor.sponsorId, floor);

  const fmt = (cents: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  /*
   * 53.26 — the two faces, from the same two numbers.
   *
   * A university asks whether the pot lasts the term and a company asks how much
   * of the budget is gone. Both are arithmetic over the balance and the spend,
   * which is the whole of "one type with two faces": different words, identical
   * plumbing, and no second query.
   */
  const balanceCents = pot.balanceCents;
  const recent = weeks.slice(-12).reduce((total, week) => total + (week.spendCents ?? 0), 0);
  const perWeek = recent > 0 ? recent / Math.min(12, Math.max(1, weeks.length)) : 0;
  /*
   * 🔴 Every figure DERIVED from the balance is suppressed with it. "Weeks left"
   * and "percent used" are both invertible: a reader who knows the spend and the
   * percentage can recover the balance, which is the suppression undone by
   * arithmetic one card to the right.
   */
  const weeksLeft = balanceCents !== null && perWeek > 0 ? Math.floor(balanceCents / perWeek) : null;
  const putIn = balanceCents === null || totals === null ? null : balanceCents + totals.spentCents;
  const usedPercent =
    putIn !== null && putIn > 0 && totals !== null ? Math.round((totals.spentCents / putIn) * 100) : null;

  /*
   * 🔴 THE POT IS A VESSEL WITH A DATE ON IT, NOT THREE TILES AND A PARAGRAPH.
   * Option A, /design/company/sample.
   *
   * This was a balance, a total and a session count in three equal cards, and
   * then, one card lower, a sentence saying how many weeks the pot had left or
   * what percentage of it was gone. A balance is a noun. How long it lasts is
   * the only thing on this screen that ever makes anybody act, and it was set
   * in the same weight as the other two, below them, in prose.
   *
   * So the runway comes up onto the pot, with a bar, and the two figures that
   * are context rather than decisions sit beside it at the size of context.
   *
   * 🔴 EVERY SUPPRESSION RULE IS UNCHANGED, and that is the part to be careful
   * about. `weeksLeft` and `usedPercent` are both invertible from the spend, so
   * a suppressed balance suppresses them too: when `balanceCents` is null there
   * is no bar, no percentage and no projection, only the sentence that says the
   * floor has not been reached. Moving a figure up a card must not move it past
   * a gate, so the same `balanceCents === null` test guards all of it.
   */
  const potLine =
    actor.kind === "university"
      ? weeksLeft === null
        ? t("sponsor.planUnknown")
        : t("sponsor.planBody", { weeks: weeksLeft })
      : usedPercent === null
        ? t("sponsor.planUnknown")
        : t("sponsor.budgetBody", { percent: usedPercent });

  /* W2-S08 — the pot stops paying on its date; say so before, and after. */
  const expiry = expiryState(terms?.expiresAt ?? null);

  return (
    <div className="space-y-4">
      {expiry && terms?.expiresAt ? (
        <ExpiryNotice
          text={
            expiry === "expired"
              ? t("sponsor.expiredOn", { date: formatDate(terms.expiresAt, "UTC", locale) })
              : t("sponsor.expiresOn", { date: formatDate(terms.expiresAt, "UTC", locale) })
          }
        />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("sponsor.balance")}
            </p>
            {/*
              🔴 37L.9 — THROUGH `formatDate`, BECAUSE AN ISO SLICE IS NOT A DATE
              ANYBODY READS.

              This printed `expiresAt.toISOString().slice(0, 10)`, which is the
              exact thing the clinic page's own comment records being caught
              doing, and the fault is worse in Arabic than it looks in English.
              "2027-09-21" dropped into an RTL paragraph is reordered by the
              bidi algorithm and renders "21-09-2027": the same three numbers in
              the opposite order, with nothing on screen to say which. A reader
              gets the right day here only because this one happens to be
              palindromic in meaning; 2027-03-05 would read as the fifth of
              March to one reader and the third of May to the next.

              The helper takes the zone as an argument, so UTC stays explicit
              (a pot expires on a date, not at an hour in somebody's city) and
              the LANGUAGE still comes from the reader, which is the split the
              rule exists to keep.
            */}
            {terms?.expiresAt ? (
              <p className="text-xs font-semibold text-brand-700">
                {t("sponsor.expires", { date: formatDate(terms.expiresAt, "UTC", locale) })}
              </p>
            ) : null}
          </div>

          <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-navy-500">
            {balanceCents === null ? t("sponsor.balanceSuppressed") : fmt(balanceCents)}
          </p>

          {/*
            The bar only exists when the balance does. A bar drawn from a
            suppressed figure is the suppression undone by a rectangle.
          */}
          {usedPercent !== null ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-brand-500"
                style={{ width: `${String(Math.min(100, Math.max(0, 100 - usedPercent)))}%` }}
              />
            </div>
          ) : null}

          <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
            {actor.kind === "university" ? t("sponsor.planTitle") : t("sponsor.budgetTitle")}
            {". "}
            {potLine}
          </p>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">{t("sponsor.spentTotal")}</p>
            <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-navy-500">
              {totals === null ? t("sponsor.figureSuppressed") : fmt(totals.spentCents)}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">{t("sponsor.sessionsTotal")}</p>
            <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-navy-500">
              {totals === null ? t("sponsor.figureSuppressed") : totals.sessions}
            </p>
          </Card>
        </div>
      </div>

      {!terms ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("sponsor.noPot")}</p>
        </Card>
      ) : null}

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("sponsor.spendTitle")}</p>

        {underFloor ? (
          <>
            <p className="mt-2 text-sm font-medium text-slate-700">{t("sponsor.suppressed")}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {t("sponsor.suppressedBody")}
            </p>
          </>
        ) : (
          <SpendHeatmap
            weeks={weeks.map((week) => ({
              /* The key. Machine-shaped, stable, never rendered. */
              weekStart: week.weekStart.toISOString().slice(0, 10),
              /* 🔴 37L.9 — and the same Monday in the reader's language. */
              label: formatDate(week.weekStart, "UTC", locale),
              /*
               * 🔴 `null` crosses the wire as null, and it is NOT zero.
               *
               * `applyActivityFloor` returns null for a suppressed week and rolls
               * its spend into the next reported one. Coercing it to 0 here would
               * render a suppressed week as a real week with no activity, which
               * is a different and false statement, and it is the statement a
               * differencing attack needs.
               */
              spendCents: week.spendCents,
            }))}
          />
        )}

        {/* 🔴 C228 — why weekly, on the screen, for the client who will ask. */}
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          {t("sponsor.whyWeekly")}
        </p>
      </Card>
    </div>
  );
}
