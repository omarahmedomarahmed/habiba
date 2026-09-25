import type { Metadata } from "next";
import Link from "next/link";

import { ExportRecord } from "@/components/patient/export-record";
import { PatientBack } from "@/components/patient/back";
import { Card } from "@/components/patient/kit";
import { SeesWhat } from "@/components/visual/primitives";
import {
  clinicVisibilityFor,
  markClinicVisibilityShown,
} from "@/lib/data/clinic-visibility";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.aCopyOfYourRecord"), robots: { index: false } };
}
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
    <main className="mx-auto flex flex-col min-h-dvh w-full max-w-lg gap-4 px-5 pt-16 pb-10">
      <PatientBack />

      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">{t("precord.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">
          {t("precord.body")}
        </p>
      </div>

      {/* 🔴 W2-P03: a whole record goes only to an address the patient has proved. */}
      <ExportRecord email={actor.emailVerified ? actor.email : null} />

      {visibility.practices.length > 0 ? (
        <Card className="p-5">
          {/*
            🔴 65.5 / 65.11 / C327 — THE PRACTICE'S REACH, AS TWO COLUMNS.

            This card carried three paragraphs, 100 words, around one small table. The
            longest of them was the list of things the practice never sees, written as a
            sentence with seven commas in it, which is the format a reader's eye slides
            off exactly when it matters most.

            🔴 THE "NEVER" COLUMN IS THE SAME SIZE AS THE "CAN" COLUMN, which is
            `SeesWhat`'s whole reason to exist and was the one thing the old card got
            right: what they never see was already in the same breath and the same size.

            🔴 AND THEIR NAME AS THE PRACTICE READS IT STAYS, because it is the one item
            here somebody can check rather than trust. "They see: Sarah M." beats any
            sentence describing the rule that produced it.
          */}
          <h2 className="text-sm font-bold tracking-tight text-navy-700">
            {t("pclinic.title", { practice: visibility.practices.join(", ") })}
          </h2>

          <div className="mt-3">
            <SeesWhat
              who={visibility.practices.join(", ")}
              can={[
                `${t("pclinic.theySee")} ${visibility.asTheySeeIt}`,
                t("pclinic.andWhenValue"),
                t("pclinic.theyPay"),
              ]}
              cannot={[
                t("pclinic.notNotes"),
                t("pclinic.notJournal"),
                t("pclinic.notDiagnosis"),
                t("pclinic.notSaid"),
              ]}
            />
          </div>

          {/*
            🔴 65.23 — TWO SENTENCES SURVIVE, BECAUSE NEITHER IS A DESCRIPTION.

            "Not a setting: it is not built" is a claim about the product's construction
            and is the reason the column above can be believed. The second is the
            patient's alternative, and a disclosure that names no alternative is a
            notification rather than a choice.
          */}
          <p className="mt-3 text-sm font-medium text-navy-700">{t("pclinic.notBuilt")}</p>
          <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("pclinic.orAlone")}</p>
        </Card>
      ) : null}
    </main>
  );
}
