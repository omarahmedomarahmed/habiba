import type { Metadata } from "next";
import Link from "next/link";

import { PatientSteps } from "@/components/homework/patient-steps";
import { PatientBack } from "@/components/patient/back";
import { openAssignmentsForPerson } from "@/lib/data/assessments";
import { openStepsFor } from "@/lib/data/homework";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.whatToTry"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The patient's homework. PLAN.md 9.5.
 *
 * Reads `openStepsFor`, which returns open items and nothing else. Not a
 * filtered view of the full list — a different query, with no counts and no
 * closed rows in it, so there is no completion rate on this page for the same
 * reason there is no weather forecast: it was never fetched.
 */
export default async function HomeworkPage() {
  const actor = await requirePatient();
  const { t } = await getI18n();
  const [steps, openAssessments] = await Promise.all([
    openStepsFor(actor.personId),
    openAssignmentsForPerson(actor.personId),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh flex-col w-full max-w-lg gap-4 px-5 pt-4 pb-10">
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">{t("homework.title")}</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-navy-400">
          {t("homework.body")}
        </p>
      </div>

      <PatientSteps
        steps={steps.map((step) => ({ id: step.id, title: step.title, detail: step.detail }))}
      />

      {/*
        56.6 — a set of questions is the other thing a therapist asks for
        between sessions, so it is one link from here rather than a tab
        somebody has to find. Rendered only when there is something waiting:
        a permanent link to an empty page is a small lie about having work.
      */}
      {openAssessments.length > 0 ? (
        <Link
          href="/patient/assessments"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {t("passess.title")}
        </Link>
      ) : null}
    </main>
  );
}
