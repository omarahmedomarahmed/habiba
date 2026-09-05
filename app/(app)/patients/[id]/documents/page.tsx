import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, inArray } from "drizzle-orm";

import { AccessBanner } from "@/components/patient/access-banner";
import { DiagnosisList } from "@/components/documents/diagnosis-list";
import { DocumentPanel } from "@/components/documents/document-panel";
import { Card } from "@/components/ui";
import { explain } from "@/lib/access/state";
import { requireUser } from "@/lib/auth/guard";
import { listDiagnoses } from "@/lib/data/diagnoses";
import { listDocuments } from "@/lib/data/documents";
import { accessFor } from "@/lib/data/grants";
import { getPatient } from "@/lib/data/patients";
import { personIdForPatient } from "@/lib/data/people";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
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
