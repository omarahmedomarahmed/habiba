import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { NoteReview } from "@/components/session/note-review";
import { RiskAssessment } from "@/components/clinical/risk-assessment";
import { CancelSession } from "@/components/session/cancel-session";
import { SessionApproval } from "@/components/session/session-approval";
import { AttributeTranscript } from "@/components/clinical/attribute-transcript";
import { SourcePanel } from "@/components/session/source-panel";
import { VoicesPanel } from "@/components/session/voices-panel";
import { Badge, Button, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { markSessionNotificationsRead } from "@/lib/data/notifications";
import { personIdForPatient } from "@/lib/data/people";
import { getNote, getSession, getTranscript } from "@/lib/data/sessions";
import { sourceFor } from "@/lib/data/session-sources";
import { namesForUsers, voicesFor } from "@/lib/data/session-voices";
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
   * 51.6 / 37R.21 / 37R.22 / C179 — the two tables that had a migration, a
   * service, triggers and no screen. A table nobody can see is a table whose
   * constraints nobody can check, and "either a screen exists or a ticket owns
   * it, no third option" is the rule. These are the screens.
   */
  const [source, voices] = await Promise.all([
    sourceFor(id, actor.organizationId, row.session.patientId),
    voicesFor(id, actor.organizationId, row.session.patientId),
  ]);

  /*
   * The name beside an operator binding. Resolved here rather than in the
   * component because a client component must not be handed a query.
   */
  const binderNames = await namesForUsers(
    voices.map((voice) => voice.boundByUserId).filter((v): v is string => v !== null),
  );

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
          {/*
            🔴 76.40 — THE NAME IS THE DOOR TO THE PROFILE.

            A clinician reading a note about somebody and wanting the rest of
            the picture had no way out of this page except the back arrow and
            the patients list. The name is the obvious thing to tap and it did
            nothing. A walk-in with no chart still has no profile to open, so
            it stays plain text in that one case rather than becoming a link
            that 404s.
          */}
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
            {row.session.patientId ? (
              <Link
                href={`/patients/${row.session.patientId}`}
                className="underline decoration-slate-200 decoration-2 underline-offset-4 hover:decoration-slate-400"
              >
                {patientLabel}
              </Link>
            ) : (
              patientLabel
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(row.session.endedAt ?? row.session.scheduledAt ?? row.session.createdAt, actor.timezone, locale)}
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
              <Button variant="primary">
                {t("portal.session.openRoom")}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>

            {/*
              🔴 58.1 — the button the pricing page already promised.

              "What if a session was a mistake? Cancel it instead of completing
              it and nothing is charged." `abandonSession` did exactly that and
              nothing called it, so the only thing a clinician could do with a
              session opened by mistake was complete it and be billed.
            */}
            <CancelSession sessionId={id} />
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
            recordingConsent={row.session.recordingConsent}
            patientLabel={patientLabel}
            patientEmail={row.patient?.email ?? row.session.guestEmail ?? null}
            dateLabel={formatDateTime(row.session.endedAt ?? row.session.scheduledAt ?? row.session.createdAt, actor.timezone, locale)}
            reportSent={Boolean(row.session.reportSentAt)}
          />
          </>
        )}

        {/*
          51.6 — the source and the voices, beside the transcript they explain.

          Placed here rather than on a page of their own because "what recorded
          this" and "who is speaking in it" are questions somebody asks WHILE
          reading a transcript. A separate route would satisfy the letter of
          51.6 and nobody would ever open it.
        */}
        <SourcePanel
          sessionId={id}
          kind={source?.kind ?? null}
          provisionedAt={
            source?.provisionedAt
              ? formatDateTime(source.provisionedAt, actor.timezone, locale)
              : null
          }
          tokenExpiresAt={
            source?.ingestTokenExpiresAt
              ? formatDateTime(source.ingestTokenExpiresAt, actor.timezone, locale)
              : null
          }
          tokenRevoked={Boolean(source?.ingestTokenRevokedAt)}
          tokenUses={source?.ingestUses ?? 0}
          canIssue={live}
        />

        <VoicesPanel
          sessionId={id}
          voices={voices.map((voice) => ({
            id: voice.id,
            ordinal: voice.ordinal,
            role: voice.role,
            boundBy: voice.boundBy,
            boundByName: voice.boundByUserId
              ? (binderNames.get(voice.boundByUserId) ?? null)
              : null,
            speakingMs: voice.speakingMs,
          }))}
          canEdit={!live}
        />

        {transcript.length > 0 ? (
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="tap-target flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-800">
              {t("portal.session.transcript")}
              <span className="text-xs font-normal text-slate-500">
                {transcript.length} segments
              </span>
            </summary>
            {/*
              🔴 76.38 — WHO SAID IT, AND A WAY TO SAY OTHERWISE.

              This was a list of paragraphs: `segment.text` and nothing else. No
              speaker, no attribution, no control. A clinician who ran an
              offline session with two people on one microphone got "Speaker" on
              every line in the live panel and then a wall of unattributed text
              here, with nowhere to correct any of it.

              `diariseSession` now runs when the session finishes, which was
              wired to nothing at all, so most lines arrive attributed. This is
              the half a model cannot do: a clinician who was in the room saying
              which of them it got wrong.
            */}
            <div className="border-t border-slate-100 px-4 py-4">
              <AttributeTranscript
                sessionId={id}
                lines={transcript.map((segment) => ({
                  id: segment.id,
                  speaker: segment.speaker,
                  inferred: segment.speakerInferred,
                  /*
                   * A separated voice owns its lines and migration 0065's
                   * trigger enforces it. Those render their label and point at
                   * the panel above rather than offering a control that throws.
                   */
                  voiceBound: Boolean(segment.voiceId),
                  text: segment.text,
                }))}
              />
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

