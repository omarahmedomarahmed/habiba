import type { Metadata } from "next";

import { ImportPatients } from "@/components/patients/import-patients";
import { PageHeader } from "@/components/clinician/kit";
import { requireUser } from "@/lib/auth/guard";
import { getI18n } from "@/lib/i18n/server";
import { countryFromLocale } from "@/lib/phone/e164";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.import"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 55.11 / 42.8 — the caseload importer. *A clinician leaving another platform is the sales
 * motion; make the migration a button.*
 *
 * 🔴 IT IS A CLINICIAN'S SCREEN, NOT A PARTNER'S, and that is the whole reason it sits in
 * `(app)` under `/patients` rather than anywhere in the partner plane. The list being uploaded
 * is the uploader's own caseload: every person on it already has a clinical relationship with
 * the clinician doing the upload, which is exactly what makes this different from the clinic
 * roster CSV that 54.4 refuses.
 *
 * `requireUser`, so the organisation and the therapist come from the session and an import can
 * only ever land on the importer's own list.
 */
export default async function ImportPatientsPage() {
  await requireUser();
  const { t, locale } = await getI18n();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("import.title")} subtitle={t("import.body")} />

      <div className="px-4 pb-10 sm:px-6">
        {/*
         * 🔴 The country is GUESSED for the default and still asked. C64: a national number
         * expanded to the wrong country reaches a stranger, so the selector is shown even
         * when the locale answers it.
         */}
        <ImportPatients defaultCountry={countryFromLocale(locale) ?? "EG"} />
      </div>
    </div>
  );
}
