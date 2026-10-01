import type { Metadata } from "next";
import Link from "next/link";

import { Download } from "lucide-react";

import { Card, Stat } from "@/components/clinician/kit";
import { SponsorHeading } from "@/components/sponsor/heading";
import { topUpHistory } from "@/lib/billing/invoice";
import { publishedLedger } from "@/lib/data/sponsor-ledger";
import { reportablePot } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { requireSponsor } from "@/lib/sponsor-auth/guard";
import {
  filterPeriods,
  LEDGER_SORTS,
  parseLedgerQuery,
  reconcile,
  sortPeriods,
  SPONSOR_FLOOR_MIN,
  type LedgerPeriod,
  type LedgerQuery,
  type LedgerSort,
} from "@/lib/sponsor/ledger";
import { formatDate } from "@/lib/utils";
import { Money } from "@/components/ui/money";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.money"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-S10 / F7: WHAT THE POT SPENT, BY PERIOD, AND NOBODY IN IT.
 *
 * A company sees, per week (or month), the total its pot spent and the number
 * of sessions, and only for a period in which at least the floor's worth of
 * DIFFERENT people were funded (`publishedLedger`). There is no row per
 * session, no price and no employee share anywhere on this page or in its CSV.
 * Filters pick whole periods, each already over the floor, so no filter can
 * narrow the view to a small group.
 *
 * The overview's totals and this page's are reconciled on screen: what the
 * overview counts and no period here shows is one "held back for privacy"
 * line (`reconcile`), so the two add up in front of the reader.
 */
export default async function SponsorLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requireSponsor();
  const { t, locale } = await getI18n();
  const params = await searchParams;
  const query = parseLedgerQuery(params);

  const [pot, topUps] = await Promise.all([
    reportablePot(actor.sponsorId),
    topUpHistory(actor.sponsorId),
  ]);
  /*
   * 🔴 K6: under the headcount floor nothing is even read, as the overview's
   * heatmap shows nothing: at a company of three any figure at all says one of
   * three named people is in therapy.
   */
  const ledger = pot.underHeadcount
    ? null
    : await publishedLedger(actor.sponsorId, new Date(), { balanceCents: pot.balanceCents, topUps });
  const floor = ledger?.floor ?? SPONSOR_FLOOR_MIN;
  const periods = ledger ? (query.by === "month" ? ledger.months : ledger.weeks) : [];
  const rows = sortPeriods(filterPeriods(periods, query), query);
  const stats = ledger?.stats ?? null;
  const heldBack = stats ? reconcile(pot.published, stats) : null;

  const money = (cents: number | null) =>
    cents === null ? t("sponsor.figureSuppressed") : <Money cents={cents} />;
  const label = (iso: string) =>
    iso.length === 7 ? iso : formatDate(new Date(`${iso}T00:00:00Z`), "UTC", locale);
  const span = (p: LedgerPeriod) => (p.from === p.to ? label(p.from) : `${label(p.from)} → ${label(p.to)}`);

  /* The same filters, one key changed: for sort links and the CSV. */
  const href = (base: string, change: Partial<Record<string, string>>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...change })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const sortLink = (sort: LedgerSort) =>
    href("/sponsor/ledger", {
      sort,
      dir: query.sort === sort && query.dir === "desc" ? "asc" : "desc",
    });

  const figure = (title: string, value: React.ReactNode, dark = false) => (
    <Stat label={title} tone={dark ? "dark" : "light"} className="p-4 sm:p-5">
      {/* A held-back figure is a sentence, and a sentence is set smaller than a number. */}
      <span className={typeof value === "string" ? "block text-[16px] leading-snug" : "text-[22px]"}>{value}</span>
    </Stat>
  );

  return (
    <div className="space-y-5">
      <SponsorHeading
        title={t("sponsor.nav.ledger")}
        subtitle={
          <>
            {t("sponsor.ledgerBody", { floor })}{" "}
            {ledger?.publishing === "live" ? t("sponsor.ledgerLive") : t("sponsor.ledgerWeekly")}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {figure(t("sponsor.spentTotal"), money(stats?.spendCents ?? null), true)}
        {figure(t("sponsor.sessionsTotal"), stats?.sessions ?? t("sponsor.figureSuppressed"))}
        {figure(
          t("sponsor.ledgerRunway"),
          stats?.runwayMonths == null
            ? t("sponsor.figureSuppressed")
            : t("sponsor.ledgerMonths", { months: stats.runwayMonths }),
        )}
      </div>

      {stats && pot.published ? (
        <Card className="p-5">
          {/* 🔴 F7: the overview's totals and this page's, added up where the reader can see it. */}
          <h2 className="text-[16px] font-bold text-navy-700">{t("sponsor.ledgerReconcile")}</h2>
          <ul className="mt-3 divide-y divide-navy-100 text-sm tabular-nums">
            <li className="flex justify-between gap-3 py-2">
              <span className="text-navy-400">{t("sponsor.ledgerShown")}</span>
              <span className="text-navy-700">
                {money(stats.spendCents ?? 0)} · {stats.sessions ?? 0}
              </span>
            </li>
            {heldBack ? (
              <li className="flex justify-between gap-3 py-2">
                <span className="text-navy-400">{t("sponsor.ledgerHeldBack")}</span>
                <span className="text-navy-700">
                  {money(heldBack.spendCents)} · {heldBack.sessions}
                </span>
              </li>
            ) : null}
            <li className="flex justify-between gap-3 py-2 font-semibold">
              <span className="text-navy-600">{t("sponsor.ledgerOverviewTotal")}</span>
              <span className="text-navy-700">
                {money(pot.published.spentCents)} · {pot.published.sessions}
              </span>
            </li>
          </ul>
          {heldBack ? (
            <p className="mt-2 text-xs leading-relaxed text-navy-400">
              {t("sponsor.ledgerHeldBackWhy", { floor })}
            </p>
          ) : pot.published.sessions < (stats.sessions ?? 0) ? (
            <p className="mt-2 text-xs leading-relaxed text-navy-400">{t("sponsor.ledgerOverviewBehind")}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold text-navy-700">{t("sponsor.ledgerMix")}</h2>
          <ul className="mt-3 divide-y divide-navy-100 text-sm tabular-nums">
            {(stats?.coverageMix ?? []).map((bucket) => (
              <li key={bucket.coverageBps} className="flex justify-between gap-3 py-2">
                <span className="text-navy-400">{bucket.coverageBps / 100}%</span>
                <span className="text-navy-700">
                  {bucket.sessions ?? t("sponsor.figureSuppressed")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-navy-400">
            {t("sponsor.ledgerBurn")}: {money(stats?.burnCents ?? null)}
          </p>
        </Card>

        <Card className="p-5">
          {/* The company's own top-ups name nobody, so they are shown as they are. */}
          <h2 className="text-[16px] font-bold text-navy-700">{t("sponsor.ledgerTopUps")}</h2>
          <p className="mt-3 text-[26px] font-bold tabular-nums text-navy-700">
            {money(topUps.reduce((n, row) => n + row.amountCents, 0))}
          </p>
          <p className="text-xs tabular-nums text-navy-400">× {topUps.length}</p>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <form method="get" className="flex flex-wrap items-end gap-3 text-xs">
          <Filter name="from" label={t("sponsor.ledgerFrom")} value={query.from} />
          <Filter name="to" label={t("sponsor.ledgerTo")} value={query.to} />
          <label className="flex flex-col gap-1 font-semibold text-navy-400">
            {t("sponsor.ledgerBy")}
            <select
              name="by"
              defaultValue={query.by}
              className="h-10 w-32 rounded-xl border border-navy-100 bg-white px-3 text-sm text-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            >
              <option value="week">{t("sponsor.ledgerByWeek")}</option>
              <option value="month">{t("sponsor.ledgerByMonth")}</option>
            </select>
          </label>
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="dir" value={query.dir} />
          <button
            type="submit"
            className="tap-target h-10 rounded-xl bg-navy-700 px-4 font-semibold text-white hover:bg-navy-600"
          >
            {t("sponsor.ledgerFilter")}
          </button>
          <Link
            href="/sponsor/ledger"
            className="tap-target inline-flex h-10 items-center px-2 font-semibold text-navy-400 hover:text-navy-700"
          >
            {t("sponsor.ledgerClear")}
          </Link>
          <a
            href={href("/sponsor/ledger/export", {})}
            className="tap-target ms-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy-600 hover:bg-navy-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("sponsor.ledgerCsv")}
          </a>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-navy-400">
            {pot.underHeadcount ? t("sponsor.suppressedBody") : t("sponsor.ledgerEmpty")}
          </p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50 text-xs text-navy-400">
                {LEDGER_SORTS.map((sort) => (
                  <th key={sort} scope="col" className="px-4 py-3 text-start font-semibold whitespace-nowrap">
                    <Link href={sortLink(sort)} className="hover:text-navy-700">
                      {t(COLUMN[sort])}
                      {query.sort === sort ? (query.dir === "asc" ? " ↑" : " ↓") : ""}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.from}-${row.to}`} className="border-b border-navy-100 last:border-0">
                  <td className="px-4 py-3 text-navy-400">{span(row)}</td>
                  <td className="px-4 py-3 text-navy-700">{row.sessions}</td>
                  <td className="px-4 py-3 font-semibold text-navy-700">{money(row.spendCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const COLUMN = {
  week: "sponsor.ledgerPeriod",
  sessions: "sponsor.sessionsTotal",
  spend: "sponsor.spentTotal",
} as const satisfies Record<LedgerSort, string>;

function Filter({ name, label, value }: { name: keyof LedgerQuery; label: string; value: string | null }) {
  return (
    <label className="flex flex-col gap-1 font-semibold text-navy-400">
      {label}
      <input
        name={name}
        type="month"
        defaultValue={value ?? ""}
        className="h-10 w-32 rounded-xl border border-navy-100 bg-white px-3 text-sm text-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
    </label>
  );
}
