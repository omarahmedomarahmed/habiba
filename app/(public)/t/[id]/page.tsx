import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicProfile } from "@/components/radar/public-profile";
import { publicProfile } from "@/lib/data/radar";
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

  return <PublicProfile initial={profile} />;
}
