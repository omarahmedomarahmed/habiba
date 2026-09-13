import type { Metadata } from "next";

import { SpendHeatmap } from "@/components/sponsor/spend-heatmap";
import { Card } from "@/components/ui";
import { ledgerPotBalance, potTotals } from "@/lib/billing/pot";
import { potTerms } from "@/lib/data/sponsor-admin";
import { roster, weeklySpend } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

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

  const [balanceCents, totals, people, terms] = await Promise.all([
    ledgerPotBalance(actor.sponsorId),
    potTotals(actor.sponsorId),
    roster(actor.sponsorId),
    potTerms(actor.sponsorId),
  ]);

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
  const recent = weeks.slice(-12).reduce((total, week) => total + (week.spendCents ?? 0), 0);
  const perWeek = recent > 0 ? recent / Math.min(12, Math.max(1, weeks.length)) : 0;
  const weeksLeft = perWeek > 0 ? Math.floor(balanceCents / perWeek) : null;
  const putIn = balanceCents + totals.spentCents;
  const usedPercent = putIn > 0 ? Math.round((totals.spentCents / putIn) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t("sponsor.balance")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {fmt(balanceCents)}
          </p>
          {terms?.expiresAt ? (
            <p className="mt-1 text-xs text-slate-500">
              {t("sponsor.expires", {
                date: terms.expiresAt.toISOString().slice(0, 10),
              })}
            </p>
          ) : null}
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t("sponsor.spentTotal")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {fmt(totals.spentCents)}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t("sponsor.sessionsTotal")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {totals.sessions}
          </p>
        </Card>
      </div>

      {!terms ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("sponsor.noPot")}</p>
        </Card>
      ) : null}

      {/* 53.26 — the face, chosen by `kind`, which is one column on one table. */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">
          {actor.kind === "university" ? t("sponsor.planTitle") : t("sponsor.budgetTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {actor.kind === "university"
            ? weeksLeft === null
              ? t("sponsor.planUnknown")
              : t("sponsor.planBody", { weeks: weeksLeft })
            : t("sponsor.budgetBody", { percent: usedPercent })}
        </p>
      </Card>

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
              weekStart: week.weekStart.toISOString().slice(0, 10),
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
