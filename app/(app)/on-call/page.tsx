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
import { ensureRadarProfile, publicProfile, radarSessionHistory } from "@/lib/data/radar";
import { myHours } from "@/lib/data/scheduling";
import { readTimezone } from "@/lib/data/timezone";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { users } from "@/lib/db/schema";
import { feedbackForTherapist } from "@/lib/data/feedback";
import { activeTaxonomy, closedCodes } from "@/lib/data/taxonomy";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/on-call/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.crisisRadar"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function RadarConsolePage() {
  const { locale, t } = await getI18n();
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
    closedCountries,
    settings,
    published,
    needsTransfer,
  ] = await Promise.all([
    ensureRadarProfile(actor),
    db
      .select({
        sessionRateCents: users.sessionRateCents,
        rateCurrency: users.rateCurrency,
        rateEgpMinor: users.rateEgpMinor,
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
    // 50.3 — resolved here, where the taxonomy already is.
    closedCodes("country"),
    getSettings(),
    /* B14: the page the link opens, asked the way /t/:id asks it. */
    publicProfile(actor.userId).then((found) => found !== null),
    /*
     * The same question the earnings and settings pages ask (76.34). B40: in
     * the one round of reads rather than a second one after it; this page is
     * already a dozen queries and each serial step adds a round trip to Neon.
     */
    import("@/lib/billing/manual-entry").then(({ organizationNeedsTransfer }) =>
      organizationNeedsTransfer(actor.organizationId),
    ),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("portal.nav.crisisRadar")}
        subtitle={t("portal.oncall.subtitle")}
      />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <TherapistConsole
          status={profile.status}
          headline={profile.headline}
          photoUrl={profile.photoUrl}
          languages={profile.languages}
          specialties={profile.specialties}
          country={profile.country}
          sessionRateCents={me?.sessionRateCents ?? 0}
          /*
           * 🔴 B11 — the operator's fee and the figure they typed, the same two
           * inputs /settings computes "You keep" from. This card used a fixed 10%
           * on the converted dollars, so one price had two different nets.
           */
          rateEgpMinor={
            me && me.rateCurrency.toLowerCase() === "egp" && me.rateEgpMinor !== null && me.rateEgpMinor > 0
              ? me.rateEgpMinor
              : null
          }
          feeBps={settings.session.platformFeeBps}
          chargesEnabled={me?.chargesEnabled ?? false}
          manualRail={needsTransfer}
          countryClosed={Boolean(profile.country && closedCountries.has(profile.country))}
          languageOptions={languageOptions.map((o) => ({ code: o.code, label: o.label }))}
          specialtyOptions={specialtyOptions.map((o) => ({ code: o.code, label: o.label }))}
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
          {/*
            37L.2 — the sentence is one dictionary row with a {link} slot, not
            two half-sentences either side of an anchor. Arabic does not put
            the clause in the same place English does, and a translator handed
            "See" and "for what a patient sees" separately cannot fix that.
          */}
          {t("portal.oncall.body")
            .split("{link}")
            .flatMap((part, index) =>
              index === 0
                ? [part]
                : [
                    <Link key="link" href="/radar" className="font-medium text-brand-700">
                      {t("portal.oncall.publicRadar")}
                    </Link>,
                    part,
                  ],
            )}{" "}
          {/* 🔴 W2-T07: their own page, as a patient finds it. B14: once there is one. */}
          {published ? (
            <Link href={`/t/${actor.userId}`} className="font-medium text-brand-700">
              {t("tw2.publicPage")}
            </Link>
          ) : (
            t("tw2.publicPageLater")
          )}
        </p>
      </div>
    </div>
  );
}
