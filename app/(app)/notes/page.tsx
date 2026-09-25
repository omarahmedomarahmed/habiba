import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/clinician/kit";
import { requireUser } from "@/lib/auth/guard";
import { listRecentNotes } from "@/lib/data/sessions";
import { fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { NoteBadge } from "@/components/sessions/status-badge";
import { builtInFormat } from "@/lib/notes/formats";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.notes"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const rows = await listRecentNotes(actor);
  /*
   * 🔴 W2-F01: a session has a note per format and one patient copy, on its
   * primary note. Another format's copy fields are nobody's to approve, so they
   * never count as waiting.
   */
  const notes = rows.map((n) => ({
    ...n,
    patientStatus: n.isPrimary ? n.patientStatus : ("approved" as const),
  }));
  const { templateLabels } = await import("@/lib/data/note-formats");
  const ownLabels = await templateLabels(actor.organizationId, notes.map((n) => n.format));
  const formatName = (key: string) => {
    const known = builtInFormat(key);
    return ownLabels.get(key) ?? (known?.labelKey ? t(known.labelKey) : (known?.label ?? ""));
  };
  const several = new Set(notes.filter((n) => !n.isPrimary).map((n) => n.sessionId));
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
    <div className="mx-auto max-w-3xl">
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

      <div className="px-4 sm:px-6">
        {notes.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText className="h-6 w-6" aria-hidden />}
              title={t("portal.notes.none")}
              body={t("portal.notes.noneBody")}
            />
          </Card>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => {
              const name =
                fullName(note.patientFirstName, note.patientLastName, "") ||
                note.guestName ||
                t("portal.unnamedPatient");
              return (
              <li key={note.id}>
                <Link
                  href={`/sessions/${note.sessionId}?note=${note.id}`}
                  className="block rounded-3xl border border-navy-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,35,66,0.04)] transition-shadow hover:shadow-[0_12px_32px_-12px_rgba(10,35,66,0.2)]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-navy-700">{name}</p>
                      <p className="mt-0.5 text-xs text-navy-400">
                        {relativeDay(note.sessionEndedAt ?? note.createdAt, actor.timezone, locale, t)}
                        {several.has(note.sessionId) ? ` · ${formatName(note.format)}` : ""}
                      </p>
                    </div>
                    <NoteBadge status={note.status} patientStatus={note.patientStatus} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 rtl:rotate-180" aria-hidden />
                  </div>

                  {note.content?.summary ? (
                    <p className="mt-3 line-clamp-2 rounded-2xl bg-navy-50 px-3.5 py-2.5 text-sm leading-relaxed text-navy-500">
                      {note.content.summary}
                    </p>
                  ) : null}
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
