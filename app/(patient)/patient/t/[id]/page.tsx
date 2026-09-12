import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientBack } from "@/components/patient/back";
import { TherapistPageBody } from "@/components/radar/therapist-page";
import { publicProfile } from "@/lib/data/radar";
import { requirePatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "Therapist", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A clinician, seen from inside the app. PLAN.md 25.2.
 *
 * Identical content to `/t/:id` by construction: the body is one component,
 * so the reliability rule and the price rule cannot drift apart between the
 * two. What differs is everything around it. A patient tapping a name on their
 * home screen stays in the app, keeps the bottom bar and keeps the SOS orb,
 * rather than landing on the page written to sell the product to strangers.
 */
export default async function PatientTherapistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePatient();

  const { id } = await params;
  if (!(await publicProfile(id))) notFound();

  /*
   * 🔴 37R.25 / C185 — a way back.
   *
   * This screen is reached by tapping a name on the home screen or the radar,
   * and until the walkthrough the only way out of it was the bottom bar, which
   * goes somewhere else entirely. The control is above the body rather than
   * inside it because the body is shared with the public page, where there is
   * no app to go back into.
   */
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-6">
      <PatientBack />
      <TherapistPageBody id={id} />
    </div>
  );
}
