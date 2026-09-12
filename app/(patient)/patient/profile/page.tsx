import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";

import { OwnProfilePanel } from "@/components/documents/own-profile-panel";
import { Card } from "@/components/ui";
import { PatientBack } from "@/components/patient/back";
import { listDiagnoses } from "@/lib/data/diagnoses";
import { listDocuments } from "@/lib/data/documents";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { users } from "@/lib/db/schema";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { fullName } from "@/lib/utils";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/profile/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  const { t } = await getI18n();

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
        <PatientBack />
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pprofile.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("pprofile.body")}
        </p>
      </div>

      <OwnProfilePanel
        documents={rows}
        watermark={`${actor.firstName} ${actor.lastName ?? ""} · your own record`.trim()}
      />

      {diagnoses.filter((d) => d.status === "confirmed").length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">{t("pprofile.diagnoses")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {t("pprofile.diagnosesBody")}
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
            {t("pprofile.flagNote")}
          </p>
        </Card>
      ) : null}
    </main>
  );
}
