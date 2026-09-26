import { PublicProfile } from "@/components/radar/public-profile";
import { BookingCalendar } from "@/components/scheduling/booking-calendar";
import { PriceTag } from "@/components/money/price-tag";
import { egpRateMicro } from "@/lib/billing/manual";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { regulatorNameFor } from "@/lib/regulators";
import { getCountries } from "@/lib/settings";
import { formatMonthYear } from "@/lib/utils";
import { publicProfile } from "@/lib/data/radar";
import { reliabilityFor } from "@/lib/data/recovery";
import { openHours, practiceFor } from "@/lib/data/scheduling";
import { SessionPrice } from "@/components/money/session-price";

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
export async function TherapistPageBody({
  id,
  booker = null,
}: {
  id: string;
  /** The signed-in patient, from the patient app's page; null on the public one. */
  booker?: { firstName: string; email: string | null; phone: string | null } | null;
}) {
  const profile = await publicProfile(id);
  if (!profile) return null;

  /*
   * 🔴 76.46 — THE OPERATOR'S RATE, not `quoteFor`.
   *
   * This is a patient in Cairo looking at what a session costs before they book
   * it. `quoteFor` refuses a static rate in production (C37) and no rate
   * provider is configured, so it returned null here on every render and the
   * pounds toggle never appeared for the people this market is for.
   *
   * Showing a price settles nothing. The rate is the one an operator sets on
   * `/admin/settings` and the one the payment screen will show them at the end
   * of this same journey, so the two agree by construction.
   */
  const [slots, reliability, egpRate, practice] = await Promise.all([
    openHours(id),
    reliabilityFor(id),
    egpRateMicro(),
    /* 🔴 Ruling 5c: where an in-person hour is held, shown when one is picked. */
    practiceFor(id),
  ]);
  const { locale, t } = await getI18n();
  const tag = localeTag(locale);

  /*
   * 🔴 51.9 — a MONTH and a year, never a day.
   *
   * The date is evidence that a person looked, not an audit trail for a
   * stranger. To the day it invites "why was mine three weeks after theirs",
   * which is a question about our queue and none of a reader's business.
   *
   * An approved row with no `reviewed_at` is possible, so the fallback is the
   * one honest word rather than an empty gap in the middle of a sentence.
   */
  const approvedOn = profile.verifiedOn
    ? formatMonthYear(profile.verifiedOn, profile.timezone, locale)
    : t("radar.verifiedNoDate");

  /*
   * 🔴 Board 364 (B50): the body's name in the reader's language. An Arabic
   * reader with no Arabic name for it gets the plain line rather than an
   * English name inside an Arabic sentence.
   */
  const operatorNames =
    locale === "ar" && profile.verifiedBy
      ? Object.assign({}, ...(await getCountries()).map((c) => c.regulatorNamesAr ?? {}))
      : {};
  const licenceBody = profile.verifiedBy ? regulatorNameFor(profile.verifiedBy, locale, operatorNames) : null;

  return (
    <>
      <PublicProfile initial={profile} />

      {/*
        🔴 51.9 — THE VERIFIED PAGE A CLINICIAN CAN SHOW.

        The verification pipeline has been real since sprint 26: photo ID, a
        licence document, a named regulator, a human approval with a date. None
        of it reached this page, so the product was checking credentials and
        the clinician had nothing to point at.

        What it says is the whole design. `/verify` already separates "24Therapy
        produced this document" from "the diagnosis in it is correct", and this
        is the same cut: we name the regulator we checked and the month a person
        approved it, and the second line says out loud that we did not assess
        their clinical work. A badge reading only "Verified" is heard as the
        sentence we cannot make.

        The licence NUMBER is not here, and that is a decision rather than an
        omission: this page carries `robots: { index: true }` by design, and the
        number is not ours to publish on a clinician's behalf.

        `verifiedBy` is null only for a super admin, whom `isCleared` exempts
        from verification entirely. They get the plain line, which claims the
        identity and licence check without naming a regulator nobody consulted.
      */}
      <div className="mx-auto max-w-2xl px-4 pt-3 sm:px-6">
        <p className="text-sm font-semibold text-slate-800">
          {licenceBody
            ? t("radar.verifiedWith", { body: licenceBody, when: approvedOn })
            : t("radar.verifiedPlain", { when: approvedOn })}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">{t("radar.verifiedMeans")}</p>
        {/*
          🔴 63.13 / C327: the practice that can see an appointment exists, on the
          page as on the radar card. A sentence rather than a dialog (C354), and
          the way out beside it for somebody who would rather no practice did.
        */}
        {profile.clinicName ? (
          <p className="mt-2 text-xs text-slate-600">
            {t("radar.inPractice", { practice: profile.clinicName })} {t("pclinic.orAlone")}
          </p>
        ) : null}
      </div>

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
          <p className="text-xs text-slate-600">
            {t("radar.turnedUp", {
              percent: Math.round(reliability.rate * 100),
              count: reliability.sessions,
            })}
          </p>
        </div>
      ) : null}

      {/*
        16.4: every price shows USD with a small EGP toggle beside it, unless
        the clinician priced in pounds (B10), when their pounds lead. The
        rate is quoted on the server and handed down as a number: a component
        that fetched its own would show a figure the checkout does not agree
        with, and C37 refuses a pair we cannot price rather than guessing one.
      */}
      {profile.sessionRateCents > 0 ? (
        <div className="mx-auto max-w-2xl px-4 pt-2 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            {t("radar.oneHour")}
            {profile.rateEgpMinor !== null ? (
              <span className="font-semibold text-slate-900">
                <SessionPrice sessionRateCents={profile.sessionRateCents} rateEgpMinor={profile.rateEgpMinor} />
              </span>
            ) : (
              <PriceTag usdCents={profile.sessionRateCents} rateMicro={egpRate} locale={tag} />
            )}
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-2xl px-4 pb-10 sm:px-6">
        <BookingCalendar
          slots={slots.map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString(), place: slot.place }))}
          practice={practice}
          therapistName={profile.firstName}
          therapistTimezone={profile.timezone}
          rateLabel={
            profile.sessionRateCents > 0 ? (
              <SessionPrice sessionRateCents={profile.sessionRateCents} rateEgpMinor={profile.rateEgpMinor} />
            ) : (
              t("radar.freeSession")
            )
          }
          booker={booker}
        />
      </div>
    </>
  );
}
