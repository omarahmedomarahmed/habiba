import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Card, Face } from "@/components/patient/kit";
import { PatientBack } from "@/components/patient/back";
import { summariesForPerson } from "@/lib/data/summaries";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourClinicalSummary"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The clinical summary tab. PLAN.md 25.10, 26.1, 26.2, C111.
 *
 * ## 🔴 Every version, with its author, forever
 *
 * Not "the latest summary". Therapist A wrote version 1 and therapist B wrote
 * version 2, and both are here with the names on them, because a record that
 * shows only the most recent opinion hides the fact that there was an earlier
 * one and who held it. That is the difference between a record and a status.
 *
 * 26.2: there is no access check on this page beyond being the person it is
 * about. A clinician whose grant was revoked does not un-write what somebody
 * already read, and a product that could retract a version could be made to.
 *
 * ## What is deliberately not here
 *
 * No diagnosis section, no risk language, no impressions. Those are the
 * clinician's document. `summaryProblem` refuses copy that reads like one
 * before it can ever be published, so this page does not have to filter.
 */
export default async function PatientSummaryPage() {
  const actor = await requirePatient();
  const { t, locale } = await getI18n();
  const versions = await summariesForPerson(actor.personId);

  return (
    <main className="mx-auto flex min-h-dvh flex-col w-full max-w-lg gap-4 px-5 pt-4 pb-10">
      <PatientBack />

      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">{t("psummary.title")}</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-navy-400">
          {t("psummary.body")}
        </p>
      </div>

      {versions.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-navy-700">{t("psummary.none")}</p>
          <p className="mt-1 text-sm leading-relaxed text-navy-400">
            {t("psummary.noneBody")}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {versions.map((version) => (
            <li key={version.id}>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Face name={version.approvedByName} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold text-navy-700">{version.approvedByName}</p>
                    {version.approvedByCredentials ? (
                      <p className="truncate text-[13px] text-navy-400">{version.approvedByCredentials}</p>
                    ) : null}
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-navy-700">
                    <ShieldCheck className="h-5 w-5" aria-hidden />
                  </span>
                </div>

                <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-navy-700">
                  {version.body}
                </p>

                <p className="mt-3 text-[13px] text-navy-400">
                  {t("psummary.version", {
                    n: version.version,
                    date: formatDate(version.approvedAt, actor.timezone, locale),
                  })}
                </p>

                {version.approvedByLicenseBody ? (
                  <p className="mt-1 text-xs text-navy-400">
                    {version.approvedByLicenseBody}
                    {version.approvedByLicenseNumber ? ` ${version.approvedByLicenseNumber}` : ""}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
