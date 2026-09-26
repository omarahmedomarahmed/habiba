import type { Metadata } from "next";
import Link from "next/link";

import { ResidencyNotice } from "@/components/patient/residency-notice";
import { PatientBack } from "@/components/patient/back";
import { regionLabel } from "@/lib/db/region";
import { residencyFor } from "@/lib/data/residency";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.whereYourRecordIsKept"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Where your record is kept. PLAN.md 30.3, C118.
 *
 * 🔴 A page rather than a one-time modal. The fact is permanent and so is the
 * screen: a person can come back and check where their therapy records are,
 * which is the difference between a consent flow and a disclosure.
 */
export default async function ResidencyPage() {
  const actor = await requirePatient();
  const { locale } = await getI18n();
  const state = await residencyFor(actor.personId, locale);
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh flex-col w-full max-w-lg gap-4 px-5 pt-4 pb-10">
      <PatientBack />

      <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">
        {t("residency.title")}
      </h1>

      <ResidencyNotice
        crosses={state.crosses}
        agreedAt={state.agreedAt ? formatDate(state.agreedAt, actor.timezone, locale) : null}
        wording={state.wording}
        homeLabel={regionLabel(state.homeRegion, locale)}
        servingLabel={regionLabel(state.servingRegion, locale)}
      />
    </main>
  );
}
