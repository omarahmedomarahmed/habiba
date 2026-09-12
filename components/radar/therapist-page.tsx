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

/**
 * A clinician's page, body only. PLAN.md 11.3, 11.4, 14.7, 16.4, 25.2.
 *
 * ## 🔴 Why this was pulled out of the route
 *
 * It is reached from two places that must not look the same. `/t/:id` is the
 * public, indexable, shareable page and it sits under the marketing site's top
 * nav. `/patient/t/:id` is the same clinician seen from *inside* the app, by
 * somebody who is already a patient, and dropping them onto the marketing
 * header there is the exact failure 25.2 names.
 *
 * The alternative was a second copy of the page. A second copy is where the
 * reliability rule quietly stops applying to one of them.
 */
export async function TherapistPageBody({ id }: { id: string }) {
  const profile = await publicProfile(id);
  if (!profile) return null;

  const [slots, reliability, quote] = await Promise.all([
    openHours(id),
    reliabilityFor(id),
    quoteFor("usd", "egp"),
  ]);
  const egpRate = quote?.rateMicro ?? null;
  const { locale, t } = await getI18n();
  const tag = localeTag(locale);

  return (
    <>
      <PublicProfile initial={profile} />

      {/*
        14.7 — the reliability score, where somebody deciding can see it.

        🔴 Absent below five sessions rather than shown as a small-sample
        percentage. A clinician who has run three and missed one is not "67%
        reliable"; that number punishes being new far harder than being
        unreliable, and it is the same error C35 refused for straddled turns:
        unknown beats a confident wrong answer.
      */}
      {reliability.rate !== null ? (
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <p className="text-xs text-slate-500">
            Turned up to {Math.round(reliability.rate * 100)}% of {reliability.sessions} booked
            sessions.
          </p>
        </div>
      ) : null}

      {/*
        16.4 — every price shows USD with a small EGP toggle beside it. The
        rate is quoted on the server and handed down as a number: a component
        that fetched its own would show a figure the checkout does not agree
        with, and C37 refuses a pair we cannot price rather than guessing one.
      */}
      {profile.sessionRateCents > 0 ? (
        <div className="mx-auto max-w-2xl px-4 pt-2 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-slate-500">
            {t("radar.oneHour")}
            <PriceTag usdCents={profile.sessionRateCents} rateMicro={egpRate} locale={tag} />
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-2xl px-4 pb-10 sm:px-6">
        <BookingCalendar
          slots={slots.map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString() }))}
          therapistName={profile.firstName}
          therapistTimezone={profile.timezone}
          rateLabel={profile.sessionRateCents > 0 ? formatUsd(profile.sessionRateCents) : "Free"}
        />
      </div>
    </>
  );
}
