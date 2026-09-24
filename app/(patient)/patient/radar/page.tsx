import type { Metadata } from "next";

import { RadarConsole, RadarSafetyLine } from "@/components/radar/radar-console";
import { listRadar } from "@/lib/data/radar";
import { firstOpenHours } from "@/lib/data/scheduling";
import { requirePatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "Find someone now", robots: { index: false } };

/**
 * The radar, inside the app. PLAN.md 25.3, 25.2.
 *
 * ## 🔴 Why there are two radar pages and not one
 *
 * `/radar` is the public one. It is the front door of the whole product, it is
 * rendered for anybody, and its HTML must never carry a signed-in patient's
 * name, id or session. This page is the same console for somebody who is
 * already a patient, rendered inside the app chrome so that tapping the globe
 * from the bottom bar does not drop them onto the marketing site's top nav in
 * the middle of the worst hour of their week.
 *
 * The console itself is a client component reading `/api/radar`, so the two
 * pages share every pixel of the thing that matters and differ only in what
 * surrounds them. The public page therefore stays free of user data by
 * construction rather than by review: the only difference is the `<div>`.
 */
export const dynamic = "force-dynamic";

export default async function PatientRadarPage() {
  await requirePatient();

  /* 🔴 W2-P12: what to book when nobody is on shift, so an empty radar is not a dead end. */
  const [therapists, firstHours] = await Promise.all([listRadar(), firstOpenHours()]);

  return (
    <div className="bg-[#04101f]">
      <RadarConsole initial={therapists} firstHours={firstHours} />
      <RadarSafetyLine />
    </div>
  );
}
