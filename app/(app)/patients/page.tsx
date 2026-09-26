import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Upload, Users } from "lucide-react";

import { AddPatient } from "@/components/patients/add-patient";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/clinician/kit";
import { requireUser } from "@/lib/auth/guard";
import { listPatients } from "@/lib/data/patients";
import { fullName, initials, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.patients"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const patients = await listPatients(actor);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("portal.patients.title")}
        subtitle={t("portal.patients.subtitle", { count: patients.length })}
        action={
          patients.length > 0 ? (
            <span aria-hidden className="flex -space-x-2 rtl:space-x-reverse">
              {patients.slice(0, 5).map((patient) => (
                <Avatar key={patient.id} name={fullName(patient.firstName, patient.lastName)} size={36} className="ring-2 ring-navy-50" />
              ))}
            </span>
          ) : null
        }
      />

      <div className="space-y-4 px-4 sm:px-6">
        {/* 12.4 — the first screen where a therapist can write somebody down. */}
        <AddPatient />

        {/*
         * 🔴 55.11 / 42.8 — the importer, reached from here rather than from settings.
         *
         * A clinician arriving from another platform comes looking for "where do I add
         * patients", finds one at a time, and types for an hour. The migration has to be a
         * button ON THIS SCREEN, next to the one-at-a-time form it replaces.
         */}
        <Link
          href="/patients/import"
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-navy-200 bg-white/60 px-4 py-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-white"
        >
          <Upload className="h-4 w-4" aria-hidden />
          {t("import.link")}
        </Link>

        {patients.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-6 w-6" aria-hidden />}
              title={t("portal.patients.none")}
              body={t("portal.patients.noneBody")}
            />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {patients.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={`/patients/${patient.id}`}
                  className="group flex items-center gap-3 rounded-3xl border border-navy-100/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,35,66,0.04)] transition-shadow hover:shadow-[0_12px_32px_-12px_rgba(10,35,66,0.2)]"
                >
                  <Avatar name={fullName(patient.firstName, patient.lastName) || initials(patient.firstName, patient.lastName)} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold text-navy-700">
                      {fullName(patient.firstName, patient.lastName)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-navy-400">
                      <span className="inline-flex items-center rounded-full bg-navy-50 px-2 py-0.5 font-semibold text-navy-600 tabular-nums">
                        {patient.sessionCount} session{patient.sessionCount === 1 ? "" : "s"}
                      </span>
                      {patient.lastSessionAt ? <span>{`last ${relativeDay(patient.lastSessionAt, actor.timezone, locale, t)}`}</span> : null}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
