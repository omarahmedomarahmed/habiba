import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Wallet } from "lucide-react";

import { ExpiryNotice, expiryState } from "@/components/sponsor/expiry-notice";
import { SponsorHeading } from "@/components/sponsor/heading";
import { PotRing } from "@/components/sponsor/ring";
import { SpendHeatmap } from "@/components/sponsor/spend-heatmap";
import { Badge, buttonClass, Card, Glow, Stat } from "@/components/clinician/kit";
import { potTerms } from "@/lib/data/sponsor-admin";
import { reportablePot, weeklySpend } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";
import { cn, formatDate } from "@/lib/utils";
import { Money } from "@/components/ui/money";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourAccount"), robots: { index: false } };
}
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
 * Under the floor this page renders the explanation and no series at all. Not a
 * filtered series: a filtered series with one row left in it is the leak wearing
 * a suppression label.
 *
 * 🔴 K6: and no balance, no spend and no session count either. This used to
 * keep the balance and the all-time count under the floor, and at a company of
 * three "Sessions paid for: 4" says that somebody on a roster of three names is
 * in therapy. `reportablePot` applies the headcount gate, so the overview, the
 * pot page and the ledger cannot disagree about it.
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
   * `potBalance` (inside `reportablePot`) applies the same floor the heatmap
   * uses and can return NULL,
   * which means "not enough has happened to report a balance" and is a
   * different fact from zero.
   */
  const [pot, terms] = await Promise.all([reportablePot(actor.sponsorId), potTerms(actor.sponsorId)]);
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
  const underFloor = pot.underHeadcount;
  const weeks = underFloor ? [] : await weeklySpend(actor.sponsorId, floor);

  const fmt = (cents: number) => <Money cents={cents} />;

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

  /* W2-S08: the pot stops paying on its date; say so before, and after. */
  const expiry = expiryState(terms?.expiresAt ?? null);

  return (
    <div className="space-y-6">
      <SponsorHeading title={actor.sponsorName} />

      {expiry && terms?.expiresAt ? (
        <ExpiryNotice
          text={
            expiry === "expired"
              ? t("sponsor.expiredOn", { date: formatDate(terms.expiresAt, "UTC", locale) })
              : t("sponsor.expiresOn", { date: formatDate(terms.expiresAt, "UTC", locale) })
          }
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden p-5 sm:p-6">
          <Glow className="-end-20 -top-20 h-52 w-52 opacity-40" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            {/*
              The ring only exists when the balance does. A ring drawn from a
              suppressed figure is the suppression undone by a shape.
            */}
            {usedPercent !== null ? (
              <PotRing value={(100 - usedPercent) / 100}>
                <span className="text-[22px] font-bold tabular-nums text-navy-700">
                  {Math.min(100, Math.max(0, 100 - usedPercent))}%
                </span>
              </PotRing>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-[13px] font-semibold text-navy-400">
                  {balanceCents === null ? t("sponsor.funded") : t("sponsor.balance")}
                </p>
                {/*
                  🔴 37L.9 — THROUGH `formatDate`, BECAUSE AN ISO SLICE IS NOT A
                  DATE ANYBODY READS. In an RTL paragraph "2027-09-21" renders
                  "21-09-2027". UTC stays explicit (a pot expires on a date, not
                  at an hour in somebody's city); the language is the reader's.
                */}
                {terms?.expiresAt ? (
                  <Badge tone="teal">
                    {t("sponsor.expires", { date: formatDate(terms.expiresAt, "UTC", locale) })}
                  </Badge>
                ) : null}
              </div>

              {/*
                🔴 B3 — with the balance held back, what the company paid in,
                under its own label. That figure is its own acts and moves on no
                session, so it passes both floors; nothing derived below (ring,
                percentage, runway) is drawn from it.
              */}
              <p className="mt-1 text-[34px] leading-tight font-bold tracking-tight tabular-nums text-navy-700">
                {balanceCents === null ? fmt(pot.fundedCents) : fmt(balanceCents)}
              </p>
              {balanceCents === null && underFloor ? (
                <p className="mt-1 text-[13px] leading-relaxed text-navy-400">
                  {t("sponsor.fundedHeld", { floor })}
                </p>
              ) : null}

              <p className="mt-2 text-sm leading-relaxed text-navy-400">
                <span className="font-semibold text-navy-600">
                  {actor.kind === "university" ? t("sponsor.planTitle") : t("sponsor.budgetTitle")}
                </span>
                {". "}
                {potLine}
              </p>

              {/* Only an admin can add money, so only an admin is offered the way to. */}
              {actor.role === "admin" && terms ? (
                <Link href="/sponsor/pot" className={cn(buttonClass("primary", "sm"), "mt-4")}>
                  <Wallet className="h-4 w-4" aria-hidden />
                  {t("sponsor.topUp")}
                </Link>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Stat tone="dark" label={t("sponsor.spentTotal")}>
            {totals === null ? (
              <span className="text-[18px]">{t("sponsor.figureSuppressed")}</span>
            ) : (
              fmt(totals.spentCents)
            )}
          </Stat>
          <Stat label={t("sponsor.sessionsTotal")}>
            {totals === null ? (
              <span className="text-[18px]">{t("sponsor.figureSuppressed")}</span>
            ) : (
              totals.sessions
            )}
          </Stat>
        </div>
      </div>

      {!terms ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-navy-400">{t("sponsor.noPot")}</p>
        </Card>
      ) : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.spendTitle")}</h2>
          {/* 🔴 C228 — why weekly, on the screen, for the client who will ask. */}
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-navy-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
            {t("sponsor.whyWeekly")}
          </p>
        </div>

        {underFloor ? (
          <div className="mt-4 rounded-2xl bg-navy-50 p-4">
            <p className="text-sm font-semibold text-navy-600">{t("sponsor.suppressed")}</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-400">
              {t("sponsor.suppressedBody")}
            </p>
          </div>
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
      </Card>
    </div>
  );
}
