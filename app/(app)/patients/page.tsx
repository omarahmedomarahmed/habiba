import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { listPatients } from "@/lib/data/patients";
import { fullName, initials, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Patients", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const actor = await requireUser();
  const patients = await listPatients(actor);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Patients" subtitle={`${patients.length} on your caseload`} />

      <div className="px-4 pb-10 sm:px-6">
        {patients.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="No patients yet"
              body="A patient record is created automatically the first time you start a session with them."
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {patients.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={`/patients/${patient.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-500 text-xs font-semibold text-white">
                    {initials(patient.firstName, patient.lastName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-900">
                      {fullName(patient.firstName, patient.lastName)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {patient.sessionCount} session{patient.sessionCount === 1 ? "" : "s"}
                      {patient.lastSessionAt ? ` · last ${relativeDay(patient.lastSessionAt)}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
