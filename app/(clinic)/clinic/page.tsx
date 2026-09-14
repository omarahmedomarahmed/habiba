import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui";
import { requireClinic } from "@/lib/clinic-auth/guard";
import { clinicSchedule, clinicUsage } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "This week", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The clinic's week. PLAN.md 54.9, 54.10, 54.12, C260, C262, C263.
 *
 * ## 🔴 A NAME, A CLINICIAN AND A TIME. THE ROWS ARE NOT LINKS.
 *
 * There is nowhere for a name on this page to lead, because no clinic surface takes a
 * patient id. `clinicSchedule` returns a session id only so React has a key; nothing
 * renders it and no route accepts it.
 *
 * ## 🔴 WHY A NAME IS ALLOWED HERE AT ALL (C260)
 *
 * *The line is money.* The clinic sees the patients of sessions the clinic is paying
 * for, which under C261 is every session on a clinic-attached therapist's account. That
 * is the only line that stays defensible when a patient asks why a practice manager
 * knows their name, and `clinic.scheduleBody` says it in those words on the screen.
 *
 * ## 🔴 AND NOTHING ON A ROW SAYS WHETHER IT WAS RECORDED
 *
 * The subtle half of C263. The invoice is aggregated so a clinic cannot tie an AI fee to
 * a session; a consent badge on a schedule row would hand that back in one glance. The
 * select list has no consent column, so there is nothing here to render.
 */
export default async function ClinicOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const actor = await requireClinic();
  const { t, locale } = await getI18n();
  const { week } = await searchParams;

  /*
   * The week to show, from the URL, defaulting to this one. Monday-anchored in UTC
   * rather than in the reader's zone: a practice manager and a clinician in different
   * cities must be looking at the same seven rows when they discuss them, and a
   * per-viewer week boundary means they are not.
   */
  const anchor = week ? new Date(`${week}T00:00:00Z`) : new Date();
  const valid = Number.isFinite(anchor.getTime()) ? anchor : new Date();
  const monday = new Date(valid);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const next = new Date(monday);
  next.setUTCDate(next.getUTCDate() + 7);
  const prev = new Date(monday);
  prev.setUTCDate(prev.getUTCDate() - 7);

  const [rows, usage] = await Promise.all([
    clinicSchedule({ actor, from: monday, to: next }),
    clinicUsage(actor),
  ]);

  /*
   * 🔴 THROUGH `formatDateTime`, NOT `Intl` HERE, and `verify:sprint37l2` caught the
   * first draft doing the latter.
   *
   * 37L.9's rule is that a page formatting a date itself is a date nothing can translate,
   * and it is a rule this page had two reasons to think it was exempt from: the week is
   * anchored in UTC deliberately (above), and a practice manager's screen is not a
   * patient's. Both are wrong. The helper takes the zone as an argument, so UTC is passed
   * explicitly and the LANGUAGE still comes from the reader, which is exactly the split the
   * rule exists to keep.
   */
  const when = (at: Date | null) => formatDateTime(at, "UTC", locale);

  const money = (cents: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("clinic.scheduleTitle")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("clinic.scheduleBody")}
        </p>

        {/* 🔴 63.17 / C334 — and the sentence about the watermark is beside it. */}
        {actor.capabilities.includes("export") ? (
          <div className="mt-3">
            <a
              href="/clinic/export?what=schedule"
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t("clinic.exportCsv")}
            </a>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {t("clinic.exportWatermark")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/clinic?week=${prev.toISOString().slice(0, 10)}`}
          className="tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold leading-9 text-slate-700 hover:bg-slate-200"
        >
          {t("clinic.prevWeek")}
        </Link>
        <span className="text-xs font-medium text-slate-500">
          {t("clinic.week", { date: monday.toISOString().slice(0, 10) })}
        </span>
        <Link
          href={`/clinic?week=${next.toISOString().slice(0, 10)}`}
          className="tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold leading-9 text-slate-700 hover:bg-slate-200"
        >
          {t("clinic.nextWeek")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("clinic.scheduleEmpty")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.sessionId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                {/* 🔴 Not a link. There is nowhere for it to go. */}
                <span className="text-sm font-semibold text-slate-900">{row.patientName}</span>
                <span className="text-xs text-slate-500">{row.therapistName}</span>
                <span className="ms-auto text-xs tabular-nums text-slate-600">
                  {when(row.scheduledAt)}
                </span>
                {row.status === "cancelled" ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {row.status}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 🔴 54.10 / C262 — the same floor as C229, through the same function. */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("clinic.usageTitle")}</p>

        {usage.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t("clinic.suppressed")}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {usage.slice(-12).map((row) => (
              <li
                key={row.weekStart.toISOString()}
                className="flex flex-wrap items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-slate-600">
                  {t("clinic.week", { date: row.weekStart.toISOString().slice(0, 10) })}
                </span>
                {/*
                  🔴 null is SUPPRESSED and it is NOT zero.
                  `applyActivityFloor` rolls a suppressed period's figures into the next
                  reported one, so rendering it as 0 would be a different and false
                  statement, and it is the statement a differencing attack needs.
                */}
                {row.sessions === null || row.spendCents === null ? (
                  <span className="text-xs text-slate-400">{t("clinic.suppressed")}</span>
                ) : (
                  <span className="tabular-nums text-slate-800">
                    {t("clinic.sessionCount", { count: row.sessions })} · {money(row.spendCents)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          {t("clinic.suppressedBody")}
        </p>
      </Card>
    </div>
  );
}
