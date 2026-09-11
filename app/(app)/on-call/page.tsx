import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { FeedbackCard } from "@/components/radar/feedback-card";
import { PracticeForm } from "@/components/radar/practice-form";
import { AvailabilityEditor } from "@/components/scheduling/availability-editor";
import { SessionHistory } from "@/components/radar/session-history";
import { TherapistConsole } from "@/components/radar/therapist-console";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { ensureRadarProfile, radarSessionHistory } from "@/lib/data/radar";
import { myHours } from "@/lib/data/scheduling";
import { readTimezone } from "@/lib/data/timezone";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { users } from "@/lib/db/schema";
import { feedbackForTherapist } from "@/lib/data/feedback";
import { activeTaxonomy } from "@/lib/data/taxonomy";
import { getI18n } from "@/lib/i18n/server";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/on-call/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const metadata: Metadata = { title: "Crisis Radar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RadarConsolePage() {
  const { locale } = await getI18n();
  const actor = await requireUser();

  const [
    profile,
    [me],
    countryOptions,
    languageOptions,
    specialtyOptions,
    feedback,
    history,
    slots,
    timezone,
  ] = await Promise.all([
    ensureRadarProfile(actor),
    db
      .select({
        rateCents: users.sessionRateCents,
        chargesEnabled: users.chargesEnabled,
        profile: users.profile,
      })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1),
    activeTaxonomy("country"),
    activeTaxonomy("language"),
    activeTaxonomy("specialty"),
    feedbackForTherapist(actor.userId),
    radarSessionHistory(actor),
    myHours(actor),
    readTimezone(actor.userId),
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
          languageOptions={languageOptions.map((o) => o.label)}
          specialtyOptions={specialtyOptions.map((o) => o.label)}
          countryOptions={countryOptions.map((o) => ({
            code: o.code,
            name: o.label,
            flag: o.flag,
          }))}
          alertOnView={me?.profile?.alertOnView ?? true}
          alertOnBooking={me?.profile?.alertOnBooking ?? true}
        />

        {/*
          11.1 / 11.4 — above the history, because it is a thing to *do* and
          the history is a thing to read. It is also the radar's escape hatch:
          the calendar is what a patient uses when they are not in crisis.
        */}
        <AvailabilityEditor
          timezone={timezone}
          slots={slots.map((slot) => ({
            id: slot.id,
            startsAt: slot.startsAt.toISOString(),
            status: slot.status,
            note: slot.note,
          }))}
        />

        <SessionHistory
        locale={locale} rows={history} zone={actor.timezone} />

        <FeedbackCard
          zone={actor.timezone}
          therapistAverage={feedback.therapistAverage}
          serviceAverage={feedback.serviceAverage}
          total={feedback.total}
          recent={feedback.recent}
        />

        <PracticeForm
          practiceName={profile.practiceName}
          address={profile.practiceAddress}
          lat={profile.practiceLat}
          lon={profile.practiceLon}
          country={profile.country}
          region={profile.region}
          city={profile.city}
          acceptsWalkIns={profile.acceptsWalkIns}
          confirmed={Boolean(profile.practiceConfirmedAt)}
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
