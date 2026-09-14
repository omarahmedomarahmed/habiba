import type { Metadata } from "next";
import Link from "next/link";

import { ExportRecord } from "@/components/patient/export-record";
import { PatientBack } from "@/components/patient/back";
import { Card } from "@/components/ui";
import {
  clinicVisibilityFor,
  markClinicVisibilityShown,
} from "@/lib/data/clinic-visibility";
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

  /*
   * 🔴 63.13 / C327 / C354 — THE FULL DISCLOSURE LIVES HERE, ALWAYS AVAILABLE.
   *
   * Not a wall, not a dialog, not a step in front of anything: a section on the
   * page a patient already comes to when they want to know what exists about them.
   * The ruling is explicit that a disclosure wall in front of somebody in crisis is
   * the wrong trade, so this informs rather than interrogates.
   *
   * Rendering it is what stamps `clinic_visibility_shown_at`, in the same shape
   * `resolveInvitation` stamps `terms_shown_at`: proof we said it, in a column an
   * auditor can read, rather than proof anybody read it.
   */
  const visibility = await clinicVisibilityFor(actor.personId);
  if (visibility.practices.length > 0) await markClinicVisibilityShown(actor.personId);

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

      {visibility.practices.length > 0 ? (
        <Card className="p-5">
          <h2 className="text-sm font-bold tracking-tight text-slate-900">
            {t("pclinic.title")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {t("pclinic.body", { practice: visibility.practices.join(", ") })}
          </p>

          {/*
            🔴 THEIR OWN NAME, AS THE PRACTICE READS IT, and not a description of
            the rule. "They see: Sarah M." is something somebody can check. "We
            show your first name and last initial" is a policy they have to trust.
          */}
          <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-500">{t("pclinic.theySee")}</dt>
              <dd className="font-semibold text-slate-900">{visibility.asTheySeeIt}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-500">{t("pclinic.andWhen")}</dt>
              <dd className="font-semibold text-slate-900">{t("pclinic.andWhenValue")}</dd>
            </div>
          </dl>

          {/* 🔴 What they will NEVER see, in the same breath and the same size. */}
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t("pclinic.never")}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{t("pclinic.why")}</p>
        </Card>
      ) : null}
    </main>
  );
}
