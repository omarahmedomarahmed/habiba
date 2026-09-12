import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { NoteReview } from "@/components/session/note-review";
import { RiskAssessment } from "@/components/clinical/risk-assessment";
import { SessionApproval } from "@/components/session/session-approval";
import { Badge, Button, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { markSessionNotificationsRead } from "@/lib/data/notifications";
import { personIdForPatient } from "@/lib/data/people";
import { getNote, getSession, getTranscript } from "@/lib/data/sessions";
import { latestSummary } from "@/lib/data/summaries";
import { latestAssessment, priorRiskFor } from "@/lib/data/session-risk";
import { NOTE_LANGUAGES } from "@/lib/db/schema";
import { formatDateTime, fullName } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { SessionBadge } from "@/components/sessions/status-badge";
import { NoteOriginNote } from "@/components/notes/provenance";

export const metadata: Metadata = { title: "Session", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { locale, t } = await getI18n();
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

  /*
   * 26.1 — the summary is filed against the PERSON, so a session whose patient
   * row has no person yet cannot carry one. The panel says so rather than
   * failing on submit.
   */
  const summaryPersonId = row.session.patientId
    ? await personIdForPatient(row.session.patientId)
    : null;
  const previousSummary = summaryPersonId ? await latestSummary(summaryPersonId) : null;

  const live = row.session.status === "scheduled" || row.session.status === "in_progress";

  /*
   * 35.1 — the assessment, and the history beside it.
   *
   * 🔴 Two separate reads on purpose. The assessment is what a model found in
   * THIS session; the history is what came before, and it reaches the clinician
   * here and the classifier nowhere. See `lib/data/session-risk.ts` and C170.
   */
  const assessment = live ? null : await latestAssessment(id, actor, row.session.patientId);
  const priorRisk = assessment
    ? await priorRiskFor(id, row.session.therapistId, actor.organizationId)
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-6">
        <Link
          href="/sessions"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("portal.nav.sessions")}
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
            {patientLabel}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(row.session.endedAt ?? row.session.createdAt, actor.timezone, locale)}
            {row.session.durationMinutes ? ` · ${row.session.durationMinutes} min` : ""}
            {row.session.modality === "video" ? " · Video" : " · In person"}
          </p>
          {/*
            A session that ended by itself says so.
            --------------------------------------
            Otherwise a clinician reads a duration that does not match their
            memory of the room with no explanation anywhere — and the two
            reasons are different enough to matter: one means they ran long,
            the other means the room emptied and nobody noticed.
          */}
          {row.session.autoEndedReason ? (
            <p className="mt-1 text-xs text-amber-700">
              {row.session.autoEndedReason === "cap"
                ? "Ended automatically at the 50 minute limit."
                : "Ended automatically, the room went quiet after the paid time."}
            </p>
          ) : null}
        </div>
        <SessionBadge status={row.session.status} />
      </div>

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {live ? (
          <Card className="flex flex-col items-start gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t("portal.session.unfinished")}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {t("portal.session.unfinishedBody")}
              </p>
            </div>
            <Link href={`/sessions/${id}/room`}>
              <Button variant="teal">
                {t("portal.session.openRoom")}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </Card>
        ) : (
          <>
          {assessment ? (
            <RiskAssessment
              level={assessment.level as "moderate" | "elevated" | "high" | "critical"}
              source={assessment.source}
              findings={assessment.findings}
              recommendedAction={assessment.recommendedAction}
              keywordIndicators={assessment.indicators}
              prior={priorRisk}
              unquoted={assessment.unquotedFindings}
              zone={actor.timezone}
            />
          ) : null}
          {/*
            🔴 26.3 / C112 — the one approval surface. NoteReview keeps its
            editors and loses its two approve buttons, because two ways to
            approve the same document is the fatigue the ruling is about.
          */}
          <SessionApproval
            sessionId={id}
            clinicalSigned={note?.status === "approved"}
            patientReleased={note?.patientStatus === "approved"}
            hasNote={Boolean(note?.content)}
            canSummarise={summaryPersonId !== null}
            previousSummary={
              previousSummary
                ? {
                    version: previousSummary.version,
                    body: previousSummary.body,
                    approvedByName: previousSummary.approvedByName,
                    on: formatDateTime(previousSummary.approvedAt, actor.timezone, locale),
                  }
                : null
            }
            patientLabel={patientLabel}
          />

          {/*
            🔴 47.3 — above the note, not beside it.
            A reader who has already read the note and then discovers it was
            written from memory has read it wrongly once. The provenance is a
            fact you need BEFORE the text, not a footnote after it.
          */}
          {note ? (
            <NoteOriginNote
              provenance={note.provenance}
              offRecordSeconds={note.offRecordSeconds}
            />
          ) : null}

          <NoteReview
            approvals={false}
            sessionId={id}
            initialNote={note?.content ?? null}
            language={note?.language ?? "en"}
            languageLabel={NOTE_LANGUAGES[note?.language ?? "en"] ?? "Original"}
            contentEn={note?.contentEn ?? null}
            initialStatus={note?.status ?? "draft"}
            initialPatientStatus={note?.patientStatus ?? "draft"}
            noteStatus={row.session.noteStatus}
            patientLabel={patientLabel}
            patientEmail={row.patient?.email ?? row.session.guestEmail ?? null}
            dateLabel={formatDateTime(row.session.endedAt ?? row.session.createdAt, actor.timezone, locale)}
            reportSent={Boolean(row.session.reportSentAt)}
          />
          </>
        )}

        {transcript.length > 0 ? (
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-800">
              {t("portal.session.transcript")}
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
            {t("portal.session.noTranscript")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

