import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronRight, FileText, Plus, Radio, Wallet } from "lucide-react";

import { Avatar, Card, EmptyState, Glow, IconTile, PageHeader, SectionHead, buttonClass } from "@/components/clinician/kit";
import { requireUser } from "@/lib/auth/guard";
import { billingSummary } from "@/lib/billing/service";
import { tierName } from "@/lib/billing/tier-name";
import { unreadNotifications } from "@/lib/data/notifications";
import { getRadarProfile } from "@/lib/data/radar";
import { countOpenDrafts, listSessions, sessionHref } from "@/lib/data/sessions";
import { fullName, relativeDay } from "@/lib/utils";
import { formatDay, resolveZone } from "@/lib/scheduling/tz";
import { getI18n } from "@/lib/i18n/server";
import { getCountries } from "@/lib/settings";
import { radarProblem } from "@/lib/settings/defs";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.home"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { locale, t } = await getI18n();
  const actor = await requireUser();

  const { orgKindOf } = await import("@/lib/data/org-kind");
  const { mayRunOrgAccount } = await import("@/lib/auth/org-authority");
  const runsAccount = mayRunOrgAccount(await orgKindOf(actor.organizationId));

  const [sessions, drafts, billing, alerts, radar] = await Promise.all([
    listSessions(actor, { limit: 5 }),
    countOpenDrafts(actor),
    billingSummary(actor.organizationId),
    /* 🔴 W2-T06: crisis by kind, so newer rows of another kind cannot hide one. */
    unreadNotifications(actor, 3, "crisis"),
    getRadarProfile(actor.userId),
  ]);

  /*
   * 🔴 59.6 / C357 — TOLD AT SIGNUP, NOT AT PAYOUT.
   *
   * `setOnline` refuses a clinician whose country has no rail, and a refusal
   * that only arrives when somebody presses a button is a refusal they meet
   * after they have already built a week around being available. `hasNoRail`
   * spent four sprints being visible only to us, on an admin screen; the person
   * it is about should be the first to know.
   */
  const countries = await getCountries();
  const railProblem = radarProblem(
    radar?.country
      ? (countries.find((c) => c.code === radar.country!.trim().toUpperCase()) ?? null)
      : null,
  );

  const crisisAlerts = alerts;
  const live = Boolean(radar?.status && radar.status !== "offline");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={
          /*
            🔴 37L.9 — this was `toLocaleDateString(undefined, …)`, which is C84
            twice over: `undefined` asks the *runtime* for the language, and no
            `timeZone` asks it for the zone. On Vercel the runtime is UTC, so a
            clinician in Dubai opening this at 01:00 was greeted with yesterday.
          */
          formatDay(new Date(), resolveZone(actor.timezone).name, locale)
        }
        title={t("portal.dash.hello", { name: actor.firstName })}
        action={
          <Link href="/sessions/new" className={buttonClass("primary", "lg")}>
            <Plus className="h-5 w-5" aria-hidden />
            <span className="flex flex-col items-start leading-tight">
              <span>{t("portal.dash.start")}</span>
              <span className="text-xs font-medium text-navy-600">{t("portal.dash.startBlurb")}</span>
            </span>
          </Link>
        }
      />

      <div className="space-y-5 px-4 sm:px-6">
        {crisisAlerts.length > 0 ? (
          <Card className="border-red-200 bg-red-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <IconTile tone="red">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </IconTile>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-red-900">
                  {crisisAlerts.length === 1
                    ? t("portal.dash.alertOne")
                    : t("portal.dash.alertMany", { count: crisisAlerts.length })}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {crisisAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      href={alert.actionUrl ?? "/sessions"}
                      className="text-sm font-semibold text-red-700 underline underline-offset-2"
                    >
                      {t("portal.dash.review")}
                    </Link>
                  ))}
                  {/* 🔴 W2-T06: and the rest of them, which had nowhere to be read. */}
                  <Link href="/notifications" className="text-sm font-semibold text-red-700 underline underline-offset-2">
                    {t("tw2.notifications")}
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {/*
          🔴 Above the radar card rather than inside it, because it is the
          reason the card below does not work and a person reads downward.
        */}
        {railProblem ? (
          <Card className="border-amber-200 bg-amber-50 p-4 sm:p-5">
            <p className="text-sm font-bold text-amber-900">{t("portal.dash.radarNotOpen")}</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{railProblem}</p>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5 lg:order-last">
            {/*
              The radar lives on the home screen rather than in the tab bar. It is
              something a clinician turns on when they happen to have a free half
              hour, which is a decision made from here, not a place they navigate to.
            */}
            <Link href="/on-call" className="group block">
              <div
                className={
                  live
                    ? "relative overflow-hidden rounded-3xl bg-navy-900 p-5 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.7)]"
                    : "relative overflow-hidden rounded-3xl border border-navy-100/80 bg-white p-5 shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)] transition-shadow group-hover:shadow-[0_12px_32px_-12px_rgba(10,35,66,0.2)]"
                }
              >
                {live ? <Glow className="-end-20 -top-20 h-56 w-56 opacity-60" /> : null}
                <div className="relative flex items-center gap-3">
                  <IconTile tone={live ? "brand" : "navy"}>
                    <Radio className={live ? "live-dot h-5 w-5" : "h-5 w-5"} aria-hidden />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className={live ? "text-[16px] font-bold text-white" : "text-[16px] font-bold text-navy-700"}>
                      {radar?.status === "online"
                        ? t("portal.dash.radarOnline")
                        : radar?.status === "pending"
                          ? t("portal.dash.radarPending")
                          : radar?.status === "in_session"
                            ? t("portal.dash.radarInSession")
                            : t("portal.nav.crisisRadar")}
                    </p>
                    <p className={live ? "mt-0.5 text-sm text-white/75" : "mt-0.5 text-sm text-navy-400"}>
                      {live ? t("portal.dash.radarOnBody") : t("portal.dash.radarOffBody")}
                    </p>
                  </div>
                  <ChevronRight className={live ? "h-5 w-5 text-white/60 rtl:rotate-180" : "h-5 w-5 text-navy-300 rtl:rotate-180"} aria-hidden />
                </div>
              </div>
            </Link>

            {drafts > 0 ? (
              <Link href="/notes" className="group block">
                <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-[0_12px_32px_-12px_rgba(10,35,66,0.2)]">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-[26px] font-bold text-amber-800 tabular-nums ring-1 ring-amber-200 ring-inset">
                    {drafts}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[16px] font-bold text-navy-700">
                      <FileText className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                      <span className="truncate">
                        {drafts === 1 ? t("portal.dash.draftsOne") : t("portal.dash.draftsMany", { count: drafts })}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-navy-400">{t("portal.dash.reviewApprove")}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
                </Card>
              </Link>
            ) : null}

            {/* 🔴 A seat clinician's organisation is the clinic, whose bill is not theirs to see. */}
            {runsAccount ? (
              <Link href="/billing" className="group block">
                <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-[0_12px_32px_-12px_rgba(10,35,66,0.2)]">
                  <IconTile>
                    <Wallet className="h-5 w-5" aria-hidden />
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold text-navy-700">{tierName(billing.tier, t)}</span>
                    <span className="mt-0.5 block text-sm text-navy-400">
                      {billing.sessionsThisMonth === 1
                        ? t("portal.dash.monthOne")
                        : t("portal.dash.monthMany", { count: billing.sessionsThisMonth })}
                    </span>
                    {billing.outstandingCents > 0 ? (
                      <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 ring-inset">
                        {rich(t("portal.dash.outstanding", { amount: slot(0) }), [<Money cents={billing.outstandingCents} />])}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
                </Card>
              </Link>
            ) : null}
          </div>

          <Card className="p-5">
            <SectionHead
              title={t("portal.dash.recent")}
              action={<Link href="/sessions">{t("portal.all")}</Link>}
            />

            {sessions.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden />}
                title={t("portal.dash.empty")}
                body={t("portal.dash.emptyBody")}
              />
            ) : (
              <ol className="relative mt-4 space-y-2.5 ps-6">
                <span aria-hidden className="absolute start-2 top-3 bottom-3 w-0.5 rounded-full bg-navy-100" />
                {sessions.map((session) => {
                  const name =
                    fullName(session.patientFirstName, session.patientLastName, "") ||
                    session.guestName ||
                    t("portal.unnamedPatient");
                  const now = session.status === "in_progress";
                  return (
                    <li key={session.id} className="relative">
                      <span
                        aria-hidden
                        className={
                          now
                            ? "absolute -start-[22px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-brand-500 ring-4 ring-white"
                            : "absolute -start-[22px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-navy-200 ring-4 ring-white"
                        }
                      />
                      {/* 🔴 T18: a cancelled session opens its page, not a video room. */}
                      <Link
                        href={sessionHref(session)}
                        className={
                          now
                            ? "flex items-center gap-3 rounded-2xl bg-navy-900 p-3 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.7)]"
                            : "flex items-center gap-3 rounded-2xl bg-navy-50 p-3 transition-colors hover:bg-navy-100"
                        }
                      >
                        <Avatar name={name} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className={now ? "truncate text-[15px] font-bold text-white" : "truncate text-[15px] font-bold text-navy-700"}>
                            {name}
                          </p>
                          <p className={now ? "text-[13px] text-white/75" : "text-[13px] text-navy-400"}>
                            {relativeDay(session.endedAt ?? session.scheduledAt ?? session.createdAt, actor.timezone, locale, t)}
                          </p>
                        </div>
                        {now ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                            <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                            {t("portal.status.live")}
                          </span>
                        ) : null}
                        <ChevronRight className={now ? "h-4 w-4 shrink-0 text-white/60 rtl:rotate-180" : "h-4 w-4 shrink-0 text-navy-300 rtl:rotate-180"} aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
