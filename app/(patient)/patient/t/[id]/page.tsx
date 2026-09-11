import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

  return <TherapistPageBody id={id} />;
}
