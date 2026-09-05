import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicProfile } from "@/components/radar/public-profile";
import { BookingCalendar } from "@/components/scheduling/booking-calendar";
import { formatUsd } from "@/lib/billing/plans";
import { publicProfile } from "@/lib/data/radar";
import { openHours } from "@/lib/data/scheduling";
import { fullName } from "@/lib/utils";

/**
 * A clinician's shareable page.
 *
 * `/t/:id` rather than a slug: a slug derived from a name changes when the
 * name does, and this is a URL people are asked to put in a bio and hand to
 * patients. It has to keep working.
 *
 * Never cached, for the same reason the radar is not — the availability line
 * is the point, and a cached one is worse than none.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await publicProfile(id);
  if (!profile) return { title: "Clinician not found" };

  const name = fullName(profile.firstName, profile.lastName, "Clinician");
  return {
    title: `${name} — 24Therapy`,
    description:
      profile.headline ??
      `${name}${profile.credentials ? `, ${profile.credentials}` : ""} takes sessions on 24Therapy.`,
    // A profile is a person's page, and search engines are welcome to it.
    // Nothing here is private: it is exactly what they published to the radar.
    robots: { index: true },
  };
}

export default async function TherapistProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await publicProfile(id);
  if (!profile) notFound();

  /*
   * 11.3 / 11.4 — the calendar sits under the profile, and it is the escape
   * hatch too: somebody who is *not* in crisis should be able to book an hour
   * rather than pressing the button that pulls a clinician out of their
   * evening. The radar and the calendar answer two different needs and the
   * page now offers both.
   */
  const slots = await openHours(id);

  return (
    <>
      <PublicProfile initial={profile} />
      <div className="mx-auto max-w-2xl px-4 pb-10 sm:px-6">
        <BookingCalendar
          slots={slots.map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString() }))}
          therapistName={profile.firstName}
          rateLabel={profile.rateCents > 0 ? formatUsd(profile.rateCents) : "Free"}
        />
      </div>
    </>
  );
}
