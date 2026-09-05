import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { inArray } from "drizzle-orm";

import { OwnProfilePanel } from "@/components/documents/own-profile-panel";
import { Card } from "@/components/ui";
import { listDiagnoses } from "@/lib/data/diagnoses";
import { listDocuments } from "@/lib/data/documents";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requirePatient } from "@/lib/patient-auth/guard";
import { fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The person's own record. PLAN.md 8.x, from the other side.
 *
 * 🔴 §6: a patient never sees a transcript or a clinical note. Nothing on this
 * page comes from `session_notes` or `transcript_segments` — it reads
 * `person_documents` and `person_diagnoses`, which are the two things that are
 * *theirs*. A clinician's session note is the clinician's record of their own
 * work and is not here.
 *
 * A confirmed diagnosis is shown with the sentence it came from, for the same
 * reason a clinician sees it that way (8.9): the quotation is checkable and
 * the label alone is not.
 */
export default async function OwnProfilePage() {
  const actor = await requirePatient();

  const documents = await listDocuments(actor.personId);
  const diagnoses = await listDiagnoses(actor.personId);

  const userIds = [
    ...new Set(documents.map((d) => d.uploadedByUserId).filter(Boolean)),
  ] as string[];
  const names = userIds.length
    ? await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const nameOf = new Map(names.map((n) => [n.id, fullName(n.firstName, n.lastName)]));

  const rows = documents.map((document) => ({
    id: document.id,
    ordinal: document.ordinal,
    title: document.title,
    source: document.source,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    extraction: document.extraction,
    documentDate: document.documentDate?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    // 8.7 — provenance in the words a patient reads, not a role name.
    addedBy: document.uploadedByAccountId
      ? "You added this"
      : `Added by ${nameOf.get(document.uploadedByUserId ?? "") ?? "your therapist"}`,
    flags: document.flags,
  }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <Link
          href="/patient"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your profile</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Letters, prescriptions, reports and anything you want a therapist to know. It travels with
          you — you decide who reads it.
        </p>
      </div>

      <OwnProfilePanel
        documents={rows}
        watermark={`${actor.firstName} ${actor.lastName ?? ""} · your own record`.trim()}
      />

      {diagnoses.filter((d) => d.status === "confirmed").length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">Diagnoses on your record</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Taken from the documents above, in their own words, and confirmed by a clinician.
          </p>
          <ul className="mt-3 space-y-3">
            {diagnoses
              .filter((d) => d.status === "confirmed")
              .map((diagnosis) => (
                <li key={diagnosis.id}>
                  <p className="text-sm font-medium text-slate-900">
                    {diagnosis.label}
                    {diagnosis.code ? (
                      <span className="ms-1.5 font-mono text-xs text-slate-400">
                        {diagnosis.code}
                      </span>
                    ) : null}
                  </p>
                  <blockquote className="mt-1 border-s-2 border-slate-200 ps-2.5 text-xs leading-relaxed text-slate-600">
                    “{diagnosis.sourceSentence}”
                  </blockquote>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            If any of this is out of date or wrong, flag it on the document it came from. Flagging
            marks it for every clinician who reads it — it does not erase what was written, because
            a medical record has to stay as it was.
          </p>
        </Card>
      ) : null}
    </main>
  );
}
