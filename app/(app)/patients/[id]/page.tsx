import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { PatientEditor } from "@/components/patient/patient-editor";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getPatient, getPatientHistory } from "@/lib/data/patients";
import { fullName, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Patient", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  const { id } = await params;

  const patient = await getPatient(actor, id);
  if (!patient) notFound();

  const history = await getPatientHistory(actor, id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-6">
        <Link
          href="/patients"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Patients
        </Link>
      </div>

      <div className="px-4 pt-3 pb-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {fullName(patient.firstName, patient.lastName)}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {history.length} session{history.length === 1 ? "" : "s"}
          {patient.source === "join_link" ? " · joined by link" : ""}
        </p>
      </div>

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <PatientEditor
          patientId={patient.id}
          initial={{
            firstName: patient.firstName,
            lastName: patient.lastName ?? "",
            email: patient.email ?? "",
            phone: patient.phone ?? "",
            diagnoses: patient.clinical?.diagnoses ?? [],
            goals: patient.clinical?.goals ?? [],
          }}
        />

        <Card>
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Session history
          </p>
          {history.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No sessions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {relativeDay(session.endedAt ?? session.createdAt)}
                        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
                      </p>
                      {session.noteSummary?.summary ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {session.noteSummary.summary}
                        </p>
                      ) : null}
                    </div>
                    {session.status !== "completed" ? (
                      <Badge tone="amber">{session.status.replace("_", " ")}</Badge>
                    ) : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
