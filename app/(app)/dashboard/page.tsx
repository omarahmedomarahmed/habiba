import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, FileText, Plus, Radio } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="px-4 pt-6 pb-4 sm:px-6">
        <p className="text-sm text-slate-500">
          {/*
            🔴 37L.9 — this was `toLocaleDateString(undefined, …)`, which is C84
            twice over: `undefined` asks the *runtime* for the language, and no
            `timeZone` asks it for the zone. On Vercel the runtime is UTC, so a
            clinician in Dubai opening this at 01:00 was greeted with yesterday.
          */}
          {formatDay(new Date(), resolveZone(actor.timezone).name, locale)}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
          {t("portal.dash.hello", { name: actor.firstName })}
        </h1>
      </div>

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <Link href="/sessions/new" className="block">
          <div className="flex items-center gap-3 rounded-2xl bg-brand-500 px-5 py-4 text-navy-600 active:bg-brand-600">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-600/10">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{t("portal.dash.start")}</span>
              <span className="block text-xs text-navy-600/80">
                {t("portal.dash.startBlurb")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-navy-600/70" aria-hidden />
          </div>
        </Link>

        {/*
          🔴 Above the radar card rather than inside it, because it is the
          reason the card below does not work and a person reads downward.
        */}
        {railProblem ? (
          <Card className="border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {t("portal.dash.radarNotOpen")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/90">{railProblem}</p>
          </Card>
        ) : null}

        {/*
          The radar lives on the home screen rather than in the tab bar. It is
          something a clinician turns on when they happen to have a free half
          hour, which is a decision made from here, not a place they navigate to.
        */}
        <Link href="/on-call" className="block">
          <Card
            className={
              radar?.status && radar.status !== "offline"
                ? "flex items-center gap-3 border-brand-300 bg-brand-50/50 p-4 active:bg-brand-50"
                : "flex items-center gap-3 p-4 active:bg-slate-50"
            }
          >
            <span
              className={
                radar?.status && radar.status !== "offline"
                  ? "flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-navy-600"
                  : "flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
              }
            >
              <Radio
                className={radar?.status && radar.status !== "offline" ? "live-dot h-4 w-4" : "h-4 w-4"}
                aria-hidden
              />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                {radar?.status === "online"
                  ? t("portal.dash.radarOnline")
                  : radar?.status === "pending"
                    ? t("portal.dash.radarPending")
                    : radar?.status === "in_session"
                      ? t("portal.dash.radarInSession")
                      : t("portal.nav.crisisRadar")}
              </span>
              <span className="block text-xs text-slate-600">
                {radar?.status && radar.status !== "offline"
                  ? t("portal.dash.radarOnBody")
                  : t("portal.dash.radarOffBody")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
          </Card>
        </Link>

        {crisisAlerts.length > 0 ? (
          <Card className="border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-900">
                  {crisisAlerts.length === 1
                    ? t("portal.dash.alertOne")
                    : t("portal.dash.alertMany", { count: crisisAlerts.length })}
                </p>
                {crisisAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.actionUrl ?? "/sessions"}
                    className="mt-1 block text-sm text-red-700 underline"
                  >
                    {t("portal.dash.review")}
                  </Link>
                ))}
                {/* 🔴 W2-T06: and the rest of them, which had nowhere to be read. */}
                <Link href="/notifications" className="mt-1 block text-sm text-red-700 underline">
                  {t("tw2.notifications")}
                </Link>
              </div>
            </div>
          </Card>
        ) : null}

        {drafts > 0 ? (
          <Link href="/notes" className="block">
            <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <FileText className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-900">
                  {drafts === 1
                    ? t("portal.dash.draftsOne")
                    : t("portal.dash.draftsMany", { count: drafts })}
                </span>
                <span className="block text-xs text-slate-500">{t("portal.dash.reviewApprove")}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
            </Card>
          </Link>
        ) : null}

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{t("portal.dash.recent")}</p>
            <Link href="/sessions" className="text-xs font-medium text-brand-700">
              {t("portal.all")}
            </Link>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              title={t("portal.dash.empty")}
              body={t("portal.dash.emptyBody")}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <li key={session.id}>
                  {/* 🔴 T18: a cancelled session opens its page, not a video room. */}
                  <Link
                    href={sessionHref(session)}
                    className="flex items-center gap-3 px-4 py-3 active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {fullName(session.patientFirstName, session.patientLastName, "") ||
                          session.guestName ||
                          t("portal.unnamedPatient")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {relativeDay(session.endedAt ?? session.scheduledAt ?? session.createdAt, actor.timezone, locale, t)}
                      </p>
                    </div>
                    {session.status === "in_progress" ? (
                      <Badge tone="red">{t("portal.status.live")}</Badge>
                    ) : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 🔴 A seat clinician's organisation is the clinic, whose bill is not theirs to see. */}
        {runsAccount ? (
        <Link href="/billing" className="block">
          <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                {tierName(billing.tier, t)}
              </span>
              <span className="block text-xs text-slate-500">
                {billing.sessionsThisMonth === 1
                  ? t("portal.dash.monthOne")
                  : t("portal.dash.monthMany", { count: billing.sessionsThisMonth })}
                {billing.outstandingCents > 0 ? (
                  <> · {rich(t("portal.dash.outstanding", { amount: slot(0) }), [<Money cents={billing.outstandingCents} />])}</>
                ) : null}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
          </Card>
        </Link>
        ) : null}
      </div>
    </div>
  );
}
