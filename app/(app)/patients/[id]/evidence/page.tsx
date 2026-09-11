import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EvidencePanel, type PanelFact } from "@/components/clinical/evidence-panel";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/data/grants";
import { contestedFields, evidenceFor, factsFor } from "@/lib/data/facts";
import { getPatient } from "@/lib/data/patients";
import { personIdForPatient } from "@/lib/data/people";
import { explain } from "@/lib/access/state";
import { formatDate, fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Evidence", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Why the system believes what it believes. PLAN.md 33.6.
 *
 * ## The accept criterion of sprint 33, on a screen
 *
 * *Every clinical fact the system holds can be traced to the exact sentence
 * that produced it, and a clinician can disagree with it in place.* This page
 * is where both halves are true at once: every row carries its quote, and
 * every row has a button that records disagreement without editing a word of
 * the record.
 *
 * ## 🔴 Historical and unsupported rows are shown HERE and nowhere else
 *
 * `factsFor(..., { all: true })`. Everything that summarises the patient reads
 * the default view, which is active facts only, so a superseded diagnosis and
 * a fact whose document was deleted never reach a note or a copilot answer.
 * They reach this page, because this is the page whose job is to explain the
 * reasoning, and "we believed this until March, for this reason" is the part
 * of the reasoning that is normally lost.
 */
export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  const { id } = await params;

  const patient = await getPatient(actor, id);
  if (!patient) notFound();

  const personId = await personIdForPatient(id);
  const access = await accessFor(actor, id);

  /*
   * A revoked clinician sees the banner and no facts.
   *
   * Deliberately not "the page does not exist": §3 says the degraded state is
   * explained rather than hidden, and hiding this one would suggest the record
   * holds nothing, which is a different and false claim.
   */
  if (!personId || access.state === "revoked") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Back id={id} />
        <Card className="mt-4 p-6">
          <p className="text-sm text-slate-600">
            {personId
              ? (explain(access.state, access.gated) ??
                "This person has not granted you access to their record.")
              : "This patient record has no person attached yet, so nothing has been recorded about them."}
          </p>
        </Card>
      </div>
    );
  }

  const all = await factsFor(personId, { all: true });
  const contested = contestedFields(all.filter((fact) => fact.status === "active"));

  const contradictionsFor = (factId: string) =>
    contested
      .filter((row) => row.winner.id === factId)
      .flatMap((row) =>
        row.contradicts.map((other) => ({
          value: other.value,
          sourceType: other.sourceType,
          ageLabel: other.ageLabel,
        })),
      );

  const facts: PanelFact[] = await Promise.all(
    all.map(async (fact): Promise<PanelFact> => {
      const evidence = await evidenceFor(fact);

      return {
        id: fact.id,
        domain: fact.domain,
        field: fact.field,
        value: fact.value,
        sourceType: fact.sourceType,
        confidence: fact.confidence,
        status: fact.status,
        verified: fact.verifiedAt !== null,
        ageLabel: fact.ageLabel,
        current: fact.current,
        quote: evidence.quote,
        evidenceKind: evidence.kind,
        evidenceWhere: whereFrom(evidence, actor.timezone),
        context: evidence.kind === "segment" ? evidence.context : [],
        contradicts: contradictionsFor(fact.id),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Back id={id} />
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        What we believe about {fullName(patient.firstName, patient.lastName, "this patient")}
      </h1>
      <p className="mt-1 max-w-prose text-sm text-slate-500">
        Every line here came from somewhere, and the sentence it came from is underneath it. If
        one of them is wrong, say so: nothing is deleted, and the next clinician sees that you
        disagreed.
      </p>

      <div className="mt-8">
        <EvidencePanel patientId={id} facts={facts} />
      </div>
    </div>
  );
}

function Back({ id }: { id: string }) {
  return (
    <Link
      href={`/patients/${id}`}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to the patient
    </Link>
  );
}

/** One line saying where the quote came from, in words a clinician reads. */
function whereFrom(
  evidence: Awaited<ReturnType<typeof evidenceFor>>,
  /* 12.3 / C84 — the zone is a PARAMETER, never read from the runtime. */
  zone: string | null,
): string {
  switch (evidence.kind) {
    case "segment":
      return "From the session transcript";
    case "chunk":
      return `From ${evidence.documentName}`;
    case "journal":
      return `From the patient's journal, ${formatDate(evidence.writtenAt, zone)}`;
    case "clinician":
      return `Entered by ${evidence.name}`;
    case "gone":
      return evidence.reason;
  }
}
