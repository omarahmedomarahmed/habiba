import type { Metadata } from "next";
import Link from "next/link";

import { PatientBack } from "@/components/patient/back";
import { Card } from "@/components/patient/kit";
import { getI18n } from "@/lib/i18n/server";
import { patientConsentPreview } from "@/lib/partner/patient-consent";
import { requirePatient } from "@/lib/patient-auth/guard";

import { answerPartnerConsent } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pconsent.metaTitle"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 F6: A PLATFORM ASKS TO RECORD ONE SESSION, AND THE PATIENT ANSWERS HERE.
 *
 * Shown to the signed-in patient only (middleware sends anybody else to sign in
 * and back). A partner's own "they agreed" records nothing; this answer, given
 * by the person in their own account, is the only yes that opens a recording.
 * The page says exactly where recording would start, so the yes is to that.
 */
export default async function PartnerConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ token }, { done }] = await Promise.all([params, searchParams]);
  const [actor, preview, { t }] = await Promise.all([requirePatient(), patientConsentPreview(token), getI18n()]);

  const theirs = preview && (preview.linkedPersonId === null || preview.linkedPersonId === actor.personId);
  const minutes = preview ? Math.floor(preview.offsetSeconds / 60) : 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 pt-16 pb-10">
      <PatientBack />
      <Card className="p-5">
        {!preview || !theirs || done === "dead" ? (
          <>
            <p className="text-sm font-semibold text-navy-700">{t("pinvite.usedTitle")}</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("pconsent.dead")}</p>
            <Link
              href="/patient"
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-navy-50 text-sm font-semibold text-navy-600"
            >
              {t("tab.home")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-navy-700">{t("pconsent.title", { name: preview.partnerName })}</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("pconsent.body")}</p>
            <p className="mt-2 text-sm leading-relaxed text-navy-600">
              {preview.offsetSeconds === 0 ? t("pconsent.fromStart") : t("pconsent.fromMinute", { minutes })}
            </p>
            {done === "yes" ? (
              <p className="mt-4 text-sm font-semibold text-brand-700">{t("pconsent.doneYes")}</p>
            ) : done === "no" ? (
              <p className="mt-4 text-sm font-semibold text-navy-600">{t("pconsent.doneNo")}</p>
            ) : null}
            <div className="mt-4 space-y-2">
              <form action={answerPartnerConsent.bind(null, token, "given")}>
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-navy-600"
                >
                  {t("pconsent.yes")}
                </button>
              </form>
              <form action={answerPartnerConsent.bind(null, token, "withdrawn")}>
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-navy-50 text-sm font-semibold text-navy-600"
                >
                  {t("pconsent.no")}
                </button>
              </form>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
