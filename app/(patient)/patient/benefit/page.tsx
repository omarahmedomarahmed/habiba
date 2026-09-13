import type { Metadata } from "next";

import { BenefitForm } from "@/components/patient/benefit-form";
import { PatientBack } from "@/components/patient/back";
import { myBenefits } from "@/lib/data/enrolment";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

/** 🔴 53.2 — a benefit title, never a therapy one. Even in the browser tab. */
export const metadata: Metadata = { title: "Your benefit", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The patient's own benefit screen. PLAN.md 53.18, 53.19d, C121, C249.
 *
 * 🔴 Signed in only, and nothing is pre-filled for anybody who is not (C121).
 * The confirm step shows the name and phone we already hold, which is the whole
 * reason this cannot be an anonymous flow reached from a QR by a stranger.
 *
 * 🔴 This is the patient's OWN view of their enrolments, so it may say
 * everything: which organisations, which one pays, whether it is paused. The
 * sponsor's view of the same rows is `lib/data/sponsors.ts` and is deliberately
 * narrower. Two queries over one table, with opposite select lists, is what the
 * wall is made of.
 */
export default async function BenefitPage() {
  const actor = await requirePatient();
  const { t } = await getI18n();

  const benefits = await myBenefits(actor.personId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("benefit.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("benefit.body")}</p>
      </div>

      <BenefitForm
        benefits={benefits.map((benefit) => ({
          enrolmentId: benefit.enrolmentId,
          sponsorName: benefit.sponsorName,
          isPrimary: benefit.isPrimary,
          paused: benefit.pausedAt !== null,
        }))}
      />
    </main>
  );
}
