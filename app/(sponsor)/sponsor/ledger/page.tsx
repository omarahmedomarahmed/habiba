import type { Metadata } from "next";
import Link from "next/link";

import { Download } from "lucide-react";

import { Card, Stat } from "@/components/clinician/kit";
import { SponsorHeading } from "@/components/sponsor/heading";
import { topUpHistory } from "@/lib/billing/invoice";
import { publishedLedger } from "@/lib/data/sponsor-ledger";
import { reportablePot } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";
import {
  filterToFloor,
  ledgerAnalytics,
  LEDGER_SORTS,
  parseLedgerQuery,
  sortLedger,
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

/** Rows on the screen. The CSV has every published entry. */
const SHOWN = 500;

/**
 * 🔴 W2-S10 / FIX-PLAN D1: EVERY POT-FUNDED SESSION'S MONEY, AND NOBODY IN IT.
 *
 * The founder's decision: a company sees each session's price, its coverage,
 * the covered amount and the employee's share, with analytics, filters,
 * sorting and a CSV, and never an employee, a therapist or a specialty. The
 * rows come from `publishedLedger`, which reads one table with none of those in
 * it and no date finer than the week, published in batches by the operator's
 * setting. Every aggregate below goes through the reporting floor (C229):
 * `ledgerAnalytics` returns null for anything computed over fewer entries than
 * `activityFloor`, and null is rendered as "too early to report", never as 0.
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
  const settings = await getSettings();

  const [{ entries, publishing }, pot, topUps] = await Promise.all([
    publishedLedger(actor.sponsorId),
    reportablePot(actor.sponsorId),
    topUpHistory(actor.sponsorId),
  ]);

  /*
   * 🔴 K6: under the headcount floor nothing is listed, as the overview's
   * heatmap shows nothing: at a company of three any entry at all says one of
   * three named people is in therapy. And a filter that would leave fewer
   * entries than the floor withholds the whole view (`filterToFloor`).
   */
  const { entries: shown, heldBack } = pot.underHeadcount
    ? { entries: [], heldBack: false }
    : filterToFloor(entries, query, settings.sponsor.activityFloor);
  const rows = sortLedger(shown, query);
  const stats = ledgerAnalytics({
    entries: shown,
    floor: settings.sponsor.activityFloor,
    balanceCents: pot.balanceCents,
    topUps,
  });

  const money = (cents: number | null) =>
    cents === null
      ? t("sponsor.figureSuppressed")
      : <Money cents={cents} />;
  const week = (iso: string) => formatDate(new Date(`${iso}T00:00:00Z`), "UTC", locale);

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

  const figure = (label: string, value: React.ReactNode, dark = false) => (
    <Stat label={label} tone={dark ? "dark" : "light"} className="p-4 sm:p-5">
      <span className="text-[22px]">{value}</span>
    </Stat>
  );

  return (
    <div className="space-y-5">
      <SponsorHeading
        title={t("sponsor.nav.ledger")}
        subtitle={
          <>
            {t("sponsor.ledgerBody")}{" "}
            {publishing === "weekly" ? t("sponsor.ledgerWeekly") : t("sponsor.ledgerLive")}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figure(t("sponsor.spentTotal"), money(stats.spendCents), true)}
        {figure(t("sponsor.ledgerAverage"), money(stats.averagePriceCents))}
        {figure(t("sponsor.ledgerEmployees"), money(stats.employeeShareCents))}
        {figure(
          t("sponsor.ledgerRunway"),
          stats.runwayMonths === null
            ? t("sponsor.figureSuppressed")
            : t("sponsor.ledgerMonths", { months: stats.runwayMonths }),
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold text-navy-700">{t("sponsor.ledgerByMonth")}</h2>
          <ul className="mt-3 divide-y divide-navy-100 text-sm tabular-nums">
            {stats.months.map((m) => (
              <li key={m.month} className="flex justify-between gap-3 py-2">
                <span className="text-navy-400">{m.month}</span>
                <span className="text-navy-700">
                  {m.spendCents === null
                    ? t("sponsor.figureSuppressed")
                    : <>{money(m.spendCents)} · {m.sessions ?? 0}</>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-navy-400">
            {t("sponsor.ledgerBurn")}: {money(stats.burnCents)}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[16px] font-bold text-navy-700">{t("sponsor.ledgerMix")}</h2>
          <ul className="mt-3 divide-y divide-navy-100 text-sm tabular-nums">
            {stats.coverageMix.map((bucket) => (
              <li key={bucket.coverageBps} className="flex justify-between gap-3 py-2">
                <span className="text-navy-400">{bucket.coverageBps / 100}%</span>
                <span className="text-navy-700">
                  {bucket.sessions ?? t("sponsor.figureSuppressed")}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          {/* The company's own top-ups name nobody, so they are shown as they are. */}
          <h2 className="text-[16px] font-bold text-navy-700">{t("sponsor.ledgerTopUps")}</h2>
          <p className="mt-3 text-[26px] font-bold tabular-nums text-navy-700">
            {money(stats.topUps.totalCents)}
          </p>
          <p className="text-xs tabular-nums text-navy-400">× {stats.topUps.count}</p>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <form method="get" className="flex flex-wrap items-end gap-3 text-xs">
          <Filter name="from" label={t("sponsor.ledgerFrom")} value={query.from} type="month" />
          <Filter name="to" label={t("sponsor.ledgerTo")} value={query.to} type="month" />
          <Filter
            name="coverage"
            label={t("sponsor.ledgerCoverage")}
            value={query.coverage === null ? null : String(query.coverage / 100)}
            type="number"
          />
          <Filter
            name="min"
            label={t("sponsor.ledgerMin")}
            value={query.minCents === null ? null : String(query.minCents / 100)}
            type="number"
          />
          <Filter
            name="max"
            label={t("sponsor.ledgerMax")}
            value={query.maxCents === null ? null : String(query.maxCents / 100)}
            type="number"
          />
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
          <p className="p-4 text-sm text-navy-400">
            {pot.underHeadcount
              ? t("sponsor.suppressedBody")
              : heldBack
                ? t("sponsor.ledgerNarrow", { floor: settings.sponsor.activityFloor })
                : t("sponsor.ledgerEmpty")}
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
              {rows.slice(0, SHOWN).map((row, i) => {
                const sign = row.kind === "refund" ? -1 : 1;
                return (
                  <tr key={i} className="border-b border-navy-100 last:border-0">
                    <td className="px-4 py-3 text-navy-400">
                      {week(row.weekStart)}
                      {row.weekEnd ? ` → ${week(row.weekEnd)}` : ""}
                      {row.kind === "refund" ? ` · ${t("sponsor.ledgerRefund")}` : ""}
                    </td>
                    <td className="px-4 py-3 text-navy-700">{money(row.priceCents)}</td>
                    <td className="px-4 py-3 text-navy-700">{row.coverageBps / 100}%</td>
                    <td className="px-4 py-3 font-semibold text-navy-700">{money(sign * row.coveredCents)}</td>
                    <td className="px-4 py-3 text-navy-700">{money(sign * row.employeeCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length > SHOWN ? (
          <p className="p-4 text-xs text-navy-400">{t("sponsor.ledgerMore")}</p>
        ) : null}
      </Card>
    </div>
  );
}

const COLUMN = {
  week: "sponsor.ledgerWeek",
  price: "sponsor.ledgerPrice",
  coverage: "sponsor.ledgerCoverage",
  covered: "sponsor.ledgerCovered",
  employee: "sponsor.ledgerEmployee",
} as const satisfies Record<LedgerSort, string>;

function Filter({
  name,
  label,
  value,
  type,
}: {
  name: keyof LedgerQuery | "min" | "max";
  label: string;
  value: string | null;
  type: "month" | "number";
}) {
  return (
    <label className="flex flex-col gap-1 font-semibold text-navy-400">
      {label}
      <input
        name={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        defaultValue={value ?? ""}
        className="h-10 w-32 rounded-xl border border-navy-100 bg-white px-3 text-sm text-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
    </label>
  );
}
