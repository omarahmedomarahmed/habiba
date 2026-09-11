import type { Metadata } from "next";
import Link from "next/link";

import { PatientSteps } from "@/components/homework/patient-steps";
import { PatientBack } from "@/components/patient/back";
import { openStepsFor } from "@/lib/data/homework";
import { requirePatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "What to try", robots: { index: false } };
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
  const steps = await openStepsFor(actor.personId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">What to try</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Small things you and your therapist agreed on. Do them when you can. Nobody is counting.
        </p>
      </div>

      <PatientSteps
        steps={steps.map((step) => ({ id: step.id, title: step.title, detail: step.detail }))}
      />
    </main>
  );
}
