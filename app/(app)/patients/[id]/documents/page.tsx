import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { desc, eq, inArray } from "drizzle-orm";

import { AccessBanner } from "@/components/patient/access-banner";
import { DiagnosisList } from "@/components/documents/diagnosis-list";
import { ClinicianHomework } from "@/components/homework/clinician-homework";
import { StandingProfile } from "@/components/memory/standing-profile";
import { DocumentPanel } from "@/components/documents/document-panel";
import { Card } from "@/components/ui";
import { explain } from "@/lib/access/state";
import { requireUser } from "@/lib/auth/guard";
import { listDiagnoses } from "@/lib/data/diagnoses";
import { listDocuments } from "@/lib/data/documents";
import { draftedStepsFor, homeworkTrend, listHomework } from "@/lib/data/homework";
import { isStale, profileFor, timelineFor } from "@/lib/data/memory";
import { accessFor } from "@/lib/data/grants";
import { getPatient } from "@/lib/data/patients";
import { personIdForPatient } from "@/lib/data/people";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The personal profile, from the clinician's side. PLAN.md 8.x.
 *
 * ## What a revoked clinician sees here
 *
 * §3 leaves them "docs they uploaded themselves". So the list is filtered to
 * their own uploads in the degraded state rather than the page being hidden:
 * hiding it would suggest the material does not exist, and it does — they put
 * it there.
 *
 * The banner above says why the rest is missing, in the words `explain()`
 * chose, which never accuse the patient of anything.
 */
export default async function PatientDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;

  const patient = await getPatient(actor, id);
  if (!patient) notFound();

  const personId = await personIdForPatient(id);
  const access = await accessFor(actor, id);

  const all = personId ? await listDocuments(personId) : [];
  const diagnoses = personId ? await listDiagnoses(personId) : [];

  /*
   * 9.1–9.5. All of this is on the *person*, so a clinician with no person row
   * yet simply sees the empty states — a patient created before sprint 5's
   * backfill is not an error, it is a record nobody has needed a person for.
   */
  const profile = personId ? await profileFor(personId) : null;
  const timeline = personId ? await timelineFor(personId) : [];
  const homework = personId ? await listHomework(personId) : [];
  const trend = personId
    ? await homeworkTrend(personId)
    : { open: 0, done: 0, skipped: 0, skipStreak: 0, completionRate: null };

  /*
   * The most recent session's drafted steps, offered for promotion (9.5).
   * `NoteContent.patientSteps` already drafts these; nothing is ever promoted
   * automatically — see the note at the bottom of migration 0037.
   */
  const [lastSession] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.patientId, id))
    .orderBy(desc(sessions.createdAt))
    .limit(1);
  const drafted = lastSession ? await draftedStepsFor(lastSession.id) : [];

  /*
   * The filter that makes the degraded state real on this page. Not a
   * cosmetic hide: `/api/documents/<id>` refuses the bytes of anything not in
   * this list, so a URL kept from before revocation stops working too.
   */
  const visible = access.capabilities.patientFiles
    ? all
    : all.filter((document) => document.uploadedByUserId === actor.userId);

  // 8.7 — provenance as a name rather than a uuid.
  const userIds = [...new Set(visible.map((d) => d.uploadedByUserId).filter(Boolean))] as string[];
  const names = userIds.length
    ? await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const nameOf = new Map(names.map((n) => [n.id, fullName(n.firstName, n.lastName)]));

  const rows = visible.map((document) => ({
    id: document.id,
    ordinal: document.ordinal,
    title: document.title,
    source: document.source,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    extraction: document.extraction,
    documentDate: document.documentDate?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    addedBy: document.uploadedByAccountId
      ? "Added by the patient"
      : document.uploadedByUserId === actor.userId
        ? "Added by you"
        : `Added by ${nameOf.get(document.uploadedByUserId ?? "") ?? "another clinician"}`,
    flags: document.flags,
  }));

  const message = explain(access.state);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-6">
        <Link
          href={`/patients/${id}`}
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {fullName(patient.firstName, patient.lastName)}
        </Link>
      </div>

      <div className="px-4 pt-3 pb-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Letters, prescriptions, scans and history. These belong to the person, not to one clinic.
        </p>
      </div>

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {message ? (
          <AccessBanner
            patientId={id}
            state={access.state}
            message={message}
            canRequest={access.capabilities.canRequestAccess}
            pendingSince={access.grant?.status === "pending" ? access.grant.requestedAt : null}
          />
        ) : null}

        {/*
          9.1 / 9.2 / 9.4 — the standing profile above the raw documents,
          because it is what a clinician actually reads in the two minutes
          before a session. Conflicts sit above even that.
        */}
        <StandingProfile
          profile={
            profile
              ? {
                  sections: profile.sections,
                  conflicts: profile.conflicts,
                  sessionCount: profile.sessionCount,
                  documentCount: profile.documentCount,
                  generatedAt: profile.generatedAt,
                }
              : null
          }
          timeline={timeline}
          stale={isStale(profile, { sessions: profile?.sessionCount ?? 0, documents: all.length })}
        />

        {personId ? (
          <DocumentPanel
            patientId={id}
            documents={rows}
            watermark={`${fullName(patient.firstName, patient.lastName)} · viewed by ${actor.email ?? actor.userId.slice(0, 8)}`}
            canAdd={access.state !== "revoked"}
          />
        ) : (
          <Card className="px-4 py-6">
            <p className="text-sm text-slate-500">
              This patient has no personal record yet. Adding a document creates one.
            </p>
          </Card>
        )}

        <ClinicianHomework
          patientId={id}
          items={homework.map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.detail,
            status: item.status,
            source: item.source,
            createdAt: item.createdAt.toISOString(),
            completedAt: item.completedAt?.toISOString() ?? null,
            patientNote: item.patientNote,
          }))}
          trend={trend}
          drafted={drafted}
          canAssign={access.state !== "revoked"}
        />

        <DiagnosisList
          patientId={id}
          diagnoses={diagnoses.map((d) => ({
            id: d.id,
            label: d.label,
            code: d.code,
            sourceSentence: d.sourceSentence,
            status: d.status,
            documentTitle: d.documentTitle,
            documentOrdinal: d.documentOrdinal,
            flags: d.flags,
          }))}
          canDecide={access.capabilities.diagnosisChanges}
        />
      </div>
    </div>
  );
}
