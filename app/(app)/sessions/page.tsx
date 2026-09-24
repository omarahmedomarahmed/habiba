import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";

import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { formerSessions, listSessions } from "@/lib/data/sessions";
import { fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { SessionBadge } from "@/components/sessions/status-badge";

export const metadata: Metadata = { title: "Sessions", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const [sessions, former] = await Promise.all([listSessions(actor), formerSessions(actor)]);

  /*
   * 🔴 W2-T05: the sessions they ran at a practice that has removed them,
   * grouped by practice. Read only and not links: the notes are the
   * practice's (C266), and the list is what they keep sight of.
   */
  const byPractice = new Map<string, typeof former>();
  for (const row of former) {
    byPractice.set(row.practice, [...(byPractice.get(row.practice) ?? []), row]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("portal.sessions.title")}
        action={
          <Link href="/sessions/new" className="hidden lg:block">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden /> {t("portal.new")}
            </Button>
          </Link>
        }
      />

      <div className="px-4 pb-10 sm:px-6">
        {sessions.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" aria-hidden />}
              title={t("portal.sessions.none")}
              body={t("portal.sessions.noneBody")}
              action={
                <Link href="/sessions/new">
                  <Button variant="primary">{t("portal.sessions.start")}</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const label =
                fullName(session.patientFirstName, session.patientLastName, "") ||
                session.guestName ||
                t("portal.unnamedPatient");
              const live = session.status === "in_progress" || session.status === "scheduled";

              return (
                <li key={session.id}>
                  <Link
                    href={live ? `/sessions/${session.id}/room` : `/sessions/${session.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-slate-900">{label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {relativeDay(session.endedAt ?? session.scheduledAt ?? session.createdAt, actor.timezone, locale, t)}
                        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
                        {session.modality === "video" ? " · Video" : ""}
                      </p>
                    </div>

                    <SessionBadge status={session.status} noteStatus={session.noteStatus} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {[...byPractice].map(([practice, rows]) => (
          <section key={practice} className="mt-8">
            <h2 className="text-sm font-semibold text-slate-900">
              {t("tw2.formerTitle", { name: practice })}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("tw2.formerBody")}</p>
            <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {fullName(row.patientFirstName, row.patientLastName, "") ||
                      row.guestName ||
                      t("portal.unnamedPatient")}
                  </span>
                  <span className="text-xs text-slate-500">
                    {relativeDay(row.scheduledAt ?? row.createdAt, actor.timezone, locale, t)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

