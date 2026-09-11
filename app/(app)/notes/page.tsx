import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { listRecentNotes } from "@/lib/data/sessions";
import { fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { NoteBadge } from "@/components/sessions/status-badge";

export const metadata: Metadata = { title: "Notes", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const notes = await listRecentNotes(actor);
  /*
   * Two things can be outstanding on one note, and the one with a person
   * waiting on it is the patient's summary. A list that counted only unsigned
   * charts would show "Everything approved" while three people were sitting
   * with nothing.
   */
  const open = notes.filter((n) => n.status === "draft" || n.patientStatus === "draft");
  const waitingOnPatientCopy = notes.filter(
    (n) => n.status === "approved" && n.patientStatus === "draft",
  ).length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("portal.notes.title")}
        subtitle={
          open.length === 0
            ? t("portal.notes.allApproved")
            : waitingOnPatientCopy > 0
              ? t("portal.notes.waitingHeld", {
                  count: open.length,
                  held: waitingOnPatientCopy,
                })
              : t("portal.notes.waiting", { count: open.length })
        }
      />

      <div className="px-4 pb-10 sm:px-6">
        {notes.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText className="h-5 w-5" aria-hidden />}
              title={t("portal.notes.none")}
              body={t("portal.notes.noneBody")}
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/sessions/${note.sessionId}`}
                  className="block rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-slate-900">
                        {fullName(note.patientFirstName, note.patientLastName, "") ||
                          note.guestName ||
                          t("portal.unnamedPatient")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {relativeDay(note.sessionEndedAt ?? note.createdAt, actor.timezone, locale, t)}
                      </p>
                    </div>
                    <NoteBadge status={note.status} patientStatus={note.patientStatus} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </div>

                  {note.content?.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {note.content.summary}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
