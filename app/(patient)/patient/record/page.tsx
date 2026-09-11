import type { Metadata } from "next";
import Link from "next/link";

import { ExportRecord } from "@/components/patient/export-record";
import { PatientBack } from "@/components/patient/back";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "A copy of your record", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where a patient gets the whole thing. PLAN.md 26.9, 26.10.
 */
export default async function RecordExportPage() {
  const actor = await requirePatient();
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <PatientBack />

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("precord.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("precord.body")}
        </p>
      </div>

      <ExportRecord email={actor.email} />
    </main>
  );
}
