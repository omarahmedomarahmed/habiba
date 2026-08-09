import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { NoteReview } from "@/components/session/note-review";
import { Badge, Button, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { markSessionNotificationsRead } from "@/lib/data/notifications";
import { getNote, getSession, getTranscript } from "@/lib/data/sessions";
import { NOTE_LANGUAGES } from "@/lib/db/schema";
import { formatDateTime, fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Session", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;

  const row = await getSession(actor, id);
  if (!row) notFound();

  const [note, transcript] = await Promise.all([
    getNote(actor, id),
    getTranscript(actor, id),
    // Opening the session is the action the alert was asking for, so the alert
    // has done its job and stops shouting.
    markSessionNotificationsRead(actor, id),
  ]);

  const patientLabel =
    fullName(row.patient?.firstName, row.patient?.lastName, "") ||
    row.session.guestName ||
    "Unnamed patient";

  const live = row.session.status === "scheduled" || row.session.status === "in_progress";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-6">
        <Link
          href="/sessions"
          className="tap-target -ml-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Sessions
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
            {patientLabel}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(row.session.endedAt ?? row.session.createdAt)}
            {row.session.durationMinutes ? ` · ${row.session.durationMinutes} min` : ""}
            {row.session.modality === "video" ? " · Video" : " · In person"}
          </p>
        </div>
        <StatusBadge status={row.session.status} />
      </div>

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {live ? (
          <Card className="flex flex-col items-start gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">This session has not finished</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Head back into the room to record and end it.
              </p>
            </div>
            <Link href={`/sessions/${id}/room`}>
              <Button variant="teal">
                Open room
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </Card>
        ) : (
          <NoteReview
            sessionId={id}
            initialNote={note?.content ?? null}
            language={note?.language ?? "en"}
            languageLabel={NOTE_LANGUAGES[note?.language ?? "en"] ?? "Original"}
            contentEn={note?.contentEn ?? null}
            initialStatus={note?.status ?? "draft"}
            noteStatus={row.session.noteStatus}
            patientLabel={patientLabel}
            patientEmail={row.patient?.email ?? row.session.guestEmail ?? null}
            dateLabel={formatDateTime(row.session.endedAt ?? row.session.createdAt)}
            reportSent={Boolean(row.session.reportSentAt)}
          />
        )}

        {transcript.length > 0 ? (
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-800">
              Transcript
              <span className="text-xs font-normal text-slate-400">
                {transcript.length} segments
              </span>
            </summary>
            <div className="space-y-2.5 border-t border-slate-100 px-4 py-4">
              {transcript.map((segment) => (
                <p key={segment.id} className="text-sm leading-relaxed text-slate-600">
                  {segment.text}
                </p>
              ))}
            </div>
          </details>
        ) : row.session.status === "completed" ? (
          <p className="px-1 text-sm text-slate-500">
            No transcript was captured for this session.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge tone="green">Completed</Badge>;
  if (status === "in_progress") return <Badge tone="red">Live</Badge>;
  if (status === "cancelled") return <Badge tone="slate">Cancelled</Badge>;
  return <Badge tone="amber">Not started</Badge>;
}
