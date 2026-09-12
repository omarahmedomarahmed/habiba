import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientQuestionnaire } from "@/components/assessments/patient-questionnaire";
import { PatientBack } from "@/components/patient/back";
import { assignmentForAnswering } from "@/lib/data/assessments";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "A few questions", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Answering one assignment. PLAN.md 56.3.
 *
 * 🔴 `assignmentForAnswering` is person-scoped, so an id belonging to somebody
 * else is a 404 rather than a form. The same check runs again inside
 * `recordAnswer` on every single answer: a page-level check protects the READ,
 * and there is no version of this where a posted answer is trusted because the
 * page that rendered the form once looked right.
 *
 * It returns no score and no band. The patient's own reading of their answers
 * lives on the list page, after they are finished, as a number and a date.
 */
export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePatient();
  const { id } = await params;
  const { t } = await getI18n();

  const assignment = await assignmentForAnswering(id, actor.personId);
  if (!assignment) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <PatientBack fallback="/patient/assessments" />
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("passess.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("passess.body")}</p>
      </div>

      <PatientQuestionnaire
        assignmentId={assignment.id}
        name={assignment.name}
        attribution={assignment.attribution}
        questions={assignment.questions}
        answers={assignment.answers}
      />
    </main>
  );
}
