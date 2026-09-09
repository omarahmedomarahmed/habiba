import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicProfile } from "@/components/radar/public-profile";
import { BookingCalendar } from "@/components/scheduling/booking-calendar";
import { PriceTag } from "@/components/money/price-tag";
import { quoteFor } from "@/lib/billing/fx";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { formatUsd } from "@/lib/billing/plans";
import { publicProfile } from "@/lib/data/radar";
import { reliabilityFor } from "@/lib/data/recovery";
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
    title: `${name}, 24Therapy`,
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
  const [slots, reliability, quote] = await Promise.all([
    openHours(id),
    reliabilityFor(id),
    quoteFor("usd", "egp"),
  ]);
  const egpRate = quote?.rateMicro ?? null;
  // 19.4 — resolved on the server and passed down, exactly like the zone.
  const { locale } = await getI18n();
  const tag = localeTag(locale);

  return (
    <>
      <PublicProfile initial={profile} />

      {/*
        14.7 — the reliability score, where somebody deciding can see it.
        ----------------------------------------------------------------
        🔴 Absent below five sessions rather than shown as a small-sample
        percentage. A clinician who has run three and missed one is not "67%
        reliable"; that number punishes being new far harder than being
        unreliable, and it is the same error C35 refused for straddled turns —
        unknown beats a confident wrong answer.
      */}
      {reliability.rate !== null ? (
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <p className="text-xs text-slate-500">
            Turned up to {Math.round(reliability.rate * 100)}% of{" "}
            {reliability.sessions} booked sessions.
          </p>
        </div>
      ) : null}
      {/*
        16.4 — every price shows USD with a small EGP toggle beside it.
        The rate is quoted on the server and handed down as a number: a
        component that fetched its own would show a figure the checkout does
        not agree with, and C37 refuses a pair we cannot price rather than
        guessing one.
      */}
      {profile.rateCents > 0 ? (
        <div className="mx-auto max-w-2xl px-4 pt-2 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-slate-500">
            One hour
            <PriceTag usdCents={profile.rateCents} rateMicro={egpRate} locale={tag} />
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-2xl px-4 pb-10 sm:px-6">
        <BookingCalendar
          slots={slots.map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString() }))}
          therapistName={profile.firstName}
          therapistTimezone={profile.timezone}
          rateLabel={profile.rateCents > 0 ? formatUsd(profile.rateCents) : "Free"}
        />
      </div>
    </>
  );
}
