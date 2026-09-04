import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, FileText, Plus, Radio } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { billingSummary } from "@/lib/billing/service";
import { unreadNotifications } from "@/lib/data/notifications";
import { getRadarProfile } from "@/lib/data/radar";
import { countOpenDrafts, listSessions } from "@/lib/data/sessions";
import { formatUsd } from "@/lib/billing/plans";
import { fullName, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Home", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const actor = await requireUser();

  const [sessions, drafts, billing, alerts, radar] = await Promise.all([
    listSessions(actor, { limit: 5 }),
    countOpenDrafts(actor),
    billingSummary(actor.organizationId),
    unreadNotifications(actor, 3),
    getRadarProfile(actor.userId),
  ]);

  const crisisAlerts = alerts.filter((a) => a.kind === "crisis");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="px-4 pt-6 pb-4 sm:px-6">
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
          Hello, {actor.firstName}
        </h1>
      </div>

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <Link href="/sessions/new" className="block">
          <div className="flex items-center gap-3 rounded-2xl bg-brand-500 px-5 py-4 text-white active:bg-brand-600">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Start a session</span>
              <span className="block text-xs text-white/70">
                In person or video — recording begins straight away
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/60" aria-hidden />
          </div>
        </Link>

        {/*
          The radar lives on the home screen rather than in the tab bar. It is
          something a clinician turns on when they happen to have a free half
          hour, which is a decision made from here, not a place they navigate to.
        */}
        <Link href="/on-call" className="block">
          <Card
            className={
              radar?.status && radar.status !== "offline"
                ? "flex items-center gap-3 border-teal-300 bg-teal-50/50 p-4 active:bg-teal-50"
                : "flex items-center gap-3 p-4 active:bg-slate-50"
            }
          >
            <span
              className={
                radar?.status && radar.status !== "offline"
                  ? "flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-white"
                  : "flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"
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
                  ? "You are on the Crisis Radar"
                  : radar?.status === "pending"
                    ? "Someone is booking you"
                    : radar?.status === "in_session"
                      ? "You are in a radar session"
                      : "Crisis Radar"}
              </span>
              <span className="block text-xs text-slate-500">
                {radar?.status && radar.status !== "offline"
                  ? "Patients can start a session with you right now"
                  : "Go online and get paid for a free half hour"}
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
                    ? "A session raised a risk alert"
                    : `${crisisAlerts.length} sessions raised risk alerts`}
                </p>
                {crisisAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.actionUrl ?? "/sessions"}
                    className="mt-1 block text-sm text-red-700 underline"
                  >
                    Review the session
                  </Link>
                ))}
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
                  {drafts} note{drafts === 1 ? "" : "s"} waiting for you
                </span>
                <span className="block text-xs text-slate-500">Review and approve</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
            </Card>
          </Link>
        ) : null}

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Recent sessions</p>
            <Link href="/sessions" className="text-xs font-medium text-brand-600">
              All
            </Link>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body="Your first session takes about thirty seconds to start."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={
                      session.status === "completed"
                        ? `/sessions/${session.id}`
                        : `/sessions/${session.id}/room`
                    }
                    className="flex items-center gap-3 px-4 py-3 active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {fullName(session.patientFirstName, session.patientLastName, "") ||
                          session.guestName ||
                          "Unnamed patient"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {relativeDay(session.endedAt ?? session.createdAt)}
                      </p>
                    </div>
                    {session.status === "in_progress" ? <Badge tone="red">Live</Badge> : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Link href="/billing" className="block">
          <Card className="flex items-center gap-3 p-4 active:bg-slate-50">
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900">
                {billing.tier.name}
              </span>
              <span className="block text-xs text-slate-500">
                {billing.sessionsThisMonth} session
                {billing.sessionsThisMonth === 1 ? "" : "s"} this month
                {billing.outstandingCents > 0
                  ? ` · ${formatUsd(billing.outstandingCents)} outstanding`
                  : ""}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
          </Card>
        </Link>
      </div>
    </div>
  );
}
