import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { TherapistConsole } from "@/components/radar/therapist-console";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { ensureRadarProfile } from "@/lib/data/radar";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { COUNTRY_OPTIONS, RADAR_LANGUAGES, RADAR_SPECIALTIES } from "@/lib/geo";

export const metadata: Metadata = { title: "Crisis Radar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RadarConsolePage() {
  const actor = await requireUser();

  const [profile, [me]] = await Promise.all([
    ensureRadarProfile(actor),
    db
      .select({ rateCents: users.sessionRateCents, chargesEnabled: users.chargesEnabled })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Crisis Radar"
        subtitle="Fill a free half hour with someone who needs one now."
      />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <TherapistConsole
          status={profile.status}
          headline={profile.headline}
          photoUrl={profile.photoUrl}
          languages={profile.languages}
          specialties={profile.specialties}
          country={profile.country}
          rateCents={me?.rateCents ?? 0}
          chargesEnabled={me?.chargesEnabled ?? false}
          languageOptions={RADAR_LANGUAGES}
          specialtyOptions={RADAR_SPECIALTIES}
          countryOptions={COUNTRY_OPTIONS}
        />

        <p className="text-xs leading-relaxed text-slate-500">
          Radar sessions work exactly like any other: they are transcribed, they produce a note you
          approve, and they open a copilot thread for that patient. See{" "}
          <Link href="/radar" className="font-medium text-brand-600">
            the public radar
          </Link>{" "}
          for what a patient sees.
        </p>
      </div>
    </div>
  );
}
