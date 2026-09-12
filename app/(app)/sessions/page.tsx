import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";

import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { listSessions } from "@/lib/data/sessions";
import { fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { SessionBadge } from "@/components/sessions/status-badge";

export const metadata: Metadata = { title: "Sessions", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const sessions = await listSessions(actor);

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
                  <Button variant="teal">{t("portal.sessions.start")}</Button>
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
                        {relativeDay(session.endedAt ?? session.createdAt, actor.timezone, locale, t)}
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
      </div>
    </div>
  );
}

