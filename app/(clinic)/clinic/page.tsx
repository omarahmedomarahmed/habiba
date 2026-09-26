import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock, Download } from "lucide-react";

import { ClinicHead, Share } from "@/components/clinic/ui";
import { Avatar, Badge, buttonClass, Card, EmptyState, IconTile, Stat } from "@/components/clinician/kit";
import { can } from "@/lib/clinic-auth/capabilities";
import { requireClinic } from "@/lib/clinic-auth/guard";
import { clinicWeek } from "@/lib/clinic-week";
import { clinicSchedule, clinicUsage } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";
import { zoneLabel } from "@/lib/scheduling/tz";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Money } from "@/components/ui/money";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.thisWeek"), robots: { index: false } };
}
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
   * 🔴 T8: THE WEEK AND EVERY TIME ON IT ARE IN THE READER'S ZONE, NOT UTC.
   *
   * This was Monday-anchored in UTC, so a Cairo practice read a 13:00 appointment
   * as 10:00 or 11:00 and found every Monday session before 02:00 under the
   * previous week: the same rows for everybody, all of them wrong for the person
   * reading them, who is almost always in the same city as the room.
   *
   * `actor.zone` is resolved once with the session: the manager's own zone if their
   * linked clinician account has one, else their practice country's (Cairo for
   * `eg`), else UTC. The line beside the week names it, so a fallback is visible.
   *
   * 🔴 W2-C06: one function, which the export route calls with the same parameter
   * and the same zone.
   */
  const zone = actor.zone.name;
  const { monday, next, mondayKey, prevKey, nextKey } = clinicWeek(week, zone);

  /*
   * 🔴 W2-C01: EVERY REFUSED CAPABILITY REDIRECTS HERE, so this page reads
   * only what the principal holds and never refuses. It ran `clinicUsage`
   * (reports.read) for anybody, and a role with schedule.read alone got a
   * thrown query on the one page that was meant to be their way back.
   */
  const seesSchedule = can(actor.capabilities, "schedule.read");
  const seesReports = can(actor.capabilities, "reports.read");

  const [rows, usage] = await Promise.all([
    seesSchedule ? clinicSchedule({ actor, from: monday, to: next }) : Promise.resolve([]),
    seesReports ? clinicUsage(actor, zone) : Promise.resolve([]),
  ]);

  /*
   * 🔴 THROUGH `formatDateTime`, NOT `Intl` HERE, and `verify:sprint37l2` caught the
   * first draft doing the latter.
   *
   * 37L.9's rule is that a page formatting a date itself is a date nothing can translate.
   * The helper takes the zone as an argument and the LANGUAGE from the reader, which is
   * exactly the split the rule exists to keep.
   */
  const when = (at: Date | null) => formatDateTime(at, zone, locale);

  /*
   * 🔴 AND THE WEEK LABELS GO THROUGH IT TOO, which they did not.
   *
   * The comment above was written about the rota's times and stopped there, so
   * both "Week of ..." labels on this page still printed
   * `toISOString().slice(0, 10)` a few lines below it. In Arabic the bidi
   * algorithm reorders "2026-09-21" on screen to "21-09-2026", which is the
   * same three numbers with the year and day swapped and nothing to say so.
   *
   * A `YYYY-MM-DD` day key is still what the prev/next links carry, because a
   * URL parameter is machine-shaped by design. Only the rendered label changes.
   */
  const day = (at: Date) => formatDate(at, zone, locale);

  const money = (cents: number) => <Money cents={cents} />;

  /*
   * 🔴 THE WEEK IN TWO FIGURES, FROM ROWS ALREADY IN HAND. Option A,
   * /design/clinic/sample.
   *
   * The sample put a summary strip above the rota, and the obvious build is to
   * fetch seats and the next bill for it. That would be wrong here: this page
   * is reachable with `schedule.read` alone, and `clinicClinicians` and
   * `clinicBills` are gated behind `people.read` and `bills.read`. A receptionist
   * who can see the rota would get a thrown query rather than a screen, and the
   * fix somebody reached for under that error would be to widen the read.
   *
   * So both figures are derived from `rows`, which this page already has under
   * the capability it already requires. Neither is new information: every
   * session counted here is a visible row in the table below, and a count of
   * DISTINCT clinicians is not a caseload for any of them, which is the line
   * `components/clinic/people-list.tsx` draws.
   *
   * 🔴 T16: AND A CANCELLED SESSION IS NOT BOOKED. Both figures counted every row,
   * so a week of four sessions with two cancelled read "Booked this week 4" above
   * two rows marked cancelled. The rows stay in the table, marked; the figures
   * count only what is still going ahead, and a clinician whose only session was
   * cancelled is not on the rota.
   */
  const booked = rows.filter((row) => !row.cancelled);
  const onTheRota = new Set(booked.map((row) => row.therapistName)).size;

  /* The busiest reported week sets the length of every bar in the usage card. */
  const busiest = Math.max(1, ...usage.map((row) => row.sessions ?? 0));

  return (
    <div>
      <ClinicHead
        title={t("clinic.scheduleTitle")}
        subtitle={t("clinic.scheduleBody")}
        action={
          /* 🔴 63.17 / C334 — and the sentence about the watermark is beside it. */
          seesSchedule && actor.capabilities.includes("export") ? (
            <a href={`/clinic/export?what=schedule&week=${mondayKey}`} className={buttonClass("secondary", "sm")}>
              <Download className="h-4 w-4" aria-hidden />
              {t("clinic.exportCsv")}
            </a>
          ) : null
        }
      >
        {seesSchedule && actor.capabilities.includes("export") ? (
          <p className="mt-2 text-[13px] leading-relaxed text-navy-400">{t("clinic.exportWatermark")}</p>
        ) : null}
      </ClinicHead>

      {seesSchedule ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-2 p-2">
            <Link href={`/clinic?week=${prevKey}`} className={buttonClass("ghost", "sm")}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t("clinic.prevWeek")}
            </Link>
            <div className="order-first flex basis-full flex-col items-center pt-2 text-center sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto sm:pt-0">
              <span className="text-[15px] font-bold text-navy-700">{t("clinic.week", { date: day(monday) })}</span>
              {/*
                🔴 T8: the zone every time on this page is in, named whether or not
                it was a fallback. A manager with no zone of their own at a Cairo
                practice reads "Cairo" and knows; one at a practice with no default
                reads "UTC" and knows that too, rather than taking it for local time.
              */}
              <span className="inline-flex items-center gap-1 text-[12px] text-navy-400">
                <Clock className="h-3 w-3" aria-hidden />
                {t("clinic.timesIn", { zone: zoneLabel(zone, locale) })}
              </span>
            </div>
            <Link href={`/clinic?week=${nextKey}`} className={buttonClass("ghost", "sm")}>
              {t("clinic.nextWeek")}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
          </Card>

          {/*
            🔴 AND NOT ON A WEEK WITH NOTHING IN IT.

            Rendered unconditionally, an empty week drew "Booked this week 0" and
            "Clinicians on the rota 0" directly above "No appointments this week",
            which is the same fact three times. The second one was worse than
            redundant: a practice with six clinicians and a quiet week was told it
            had none, two inches from a rail with "Your clinicians" in it.

            Both figures summarise the rows. With no rows there is nothing to
            summarise, and the empty state below says the whole truth on its own.
          */}
          {rows.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Stat tone="dark" label={t("clinic.hoursBooked")}>
                {booked.length}
              </Stat>
              <Stat label={t("clinic.onTheRota")}>{onTheRota}</Stat>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <Card>
              <EmptyState icon={<CalendarDays className="h-6 w-6" aria-hidden />} title={t("clinic.scheduleEmpty")} />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-navy-100/70">
                {rows.map((row) => (
                  <li
                    key={row.sessionId}
                    className={cn("flex items-center gap-3 px-4 py-3.5 sm:px-5", row.cancelled && "opacity-70")}
                  >
                    <Avatar name={row.patientName} size={40} />
                    <div className="min-w-0 flex-1">
                      {/* 🔴 Not a link. There is nowhere for it to go. */}
                      <p className="truncate text-[15px] font-semibold text-navy-700">{row.patientName}</p>
                      <p className="truncate text-[13px] text-navy-400">{row.therapistName}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-end">
                      <span className="text-[13px] font-semibold tabular-nums text-navy-600">{when(row.scheduledAt)}</span>
                      {/* 🔴 T19: the word, in their language, not the stored code. */}
                      {row.cancelled ? <Badge>{t("clinic.cancelled")}</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : null}

      {/* 🔴 54.10 / C262 — the same floor as C229, through the same function. */}
      {seesReports ? (
        <Card className={cn("p-5", seesSchedule && "mt-6")}>
          <div className="flex items-start gap-3">
            <IconTile tone="navy">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </IconTile>
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-navy-700">{t("clinic.usageTitle")}</h2>
              {/*
                🔴 WHICH WEEK, because this card and the rota above it both say "week"
                and mean different ones.

                `clinicSchedule` filters on `sessions.scheduled_at`: the hour itself.
                `clinicUsage` groups `invoices` by `issued_at`: when it was billed. A
                session on the 14th invoiced on the 21st is in last week's rota and
                this week's total, both correctly. On one screen, with no label, that
                reads as the page contradicting itself, and the first thing a practice
                manager does with a portal that contradicts itself is stop trusting
                the figures in it.
              */}
              <p className="mt-0.5 text-[13px] leading-relaxed text-navy-400">{t("clinic.usageBasis")}</p>
            </div>
          </div>

          {usage.length === 0 ? (
            <p className="mt-4 text-sm text-navy-400">{t("clinic.suppressed")}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {usage.slice(-12).map((row) => (
                <li key={row.weekStart.toISOString()}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="text-navy-500">{t("clinic.week", { date: day(row.weekStart) })}</span>
                    {/*
                      🔴 null is SUPPRESSED and it is NOT zero.
                      `applyActivityFloor` rolls a suppressed period's figures into the next
                      reported one, so rendering it as 0 would be a different and false
                      statement, and it is the statement a differencing attack needs.
                    */}
                    {row.sessions === null || row.spendCents === null ? (
                      <span className="text-xs text-navy-400">{t("clinic.suppressed")}</span>
                    ) : (
                      <span className="font-semibold tabular-nums text-navy-700">
                        {t("clinic.sessionCount", { count: row.sessions })} ·{" "}
                        {/*
                          🔴 A BARE "$0.00" BESIDE FIVE SESSIONS READS AS A BROKEN PAGE.

                          It is not broken and it is not rounding. A session whose
                          invoice is `included` or `waived` costs the clinic
                          nothing: their welcome credit covered it, or a patient's
                          employer did, or somebody waived it. The row summed to
                          zero honestly, and the first thing a practice manager
                          does with a money figure they cannot account for is stop
                          believing the other ones.

                          The words say only what the zero already said, which is
                          why this is safe to show: no new fact about who was
                          covered or by what, because this page must not carry one.
                          The sessions count is still under the C262 floor above.
                        */}
                        {row.spendCents === 0 && row.sessions > 0 ? (
                          <span className="font-medium text-navy-500">{t("clinic.nothingToPay")}</span>
                        ) : (
                          money(row.spendCents)
                        )}
                      </span>
                    )}
                  </div>
                  {row.sessions !== null ? <Share value={row.sessions / busiest} className="mt-1.5" /> : null}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 border-t border-navy-100 pt-3 text-xs leading-relaxed text-navy-400">
            {t("clinic.suppressedBody")}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
