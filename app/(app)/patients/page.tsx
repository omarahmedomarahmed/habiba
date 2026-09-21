import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

import { AddPatient } from "@/components/patients/add-patient";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { listPatients } from "@/lib/data/patients";
import { fullName, initials, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Patients", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const patients = await listPatients(actor);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("portal.patients.title")}
        subtitle={t("portal.patients.subtitle", { count: patients.length })}
      />

      <div className="space-y-3 px-4 pb-10 sm:px-6">
        {/* 12.4 — the first screen where a therapist can write somebody down. */}
        <AddPatient />

        {/*
         * 🔴 55.11 / 42.8 — the importer, reached from here rather than from settings.
         *
         * A clinician arriving from another platform comes looking for "where do I add
         * patients", finds one at a time, and types for an hour. The migration has to be a
         * button ON THIS SCREEN, next to the one-at-a-time form it replaces.
         */}
        <p className="text-center">
          <Link
            href="/patients/import"
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            {t("import.link")}
          </Link>
        </p>

        {patients.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title={t("portal.patients.none")}
              body={t("portal.patients.noneBody")}
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
                      {patient.lastSessionAt ? ` · last ${relativeDay(patient.lastSessionAt, actor.timezone, locale, t)}` : ""}
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
