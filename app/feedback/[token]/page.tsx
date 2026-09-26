import type { Metadata } from "next";
import Link from "next/link";

import { RatingForm } from "@/components/feedback/rating-form";
import { Card } from "@/components/patient/kit";
import { feedbackContext } from "@/lib/data/feedback";
import { Logo } from "@/components/brand/logo";
import { getI18n } from "@/lib/i18n/server";
import { optionalPatient } from "@/lib/patient-auth/guard";
import { crisisCountryFor } from "@/lib/crisis/line";
import { SosOrbServer } from "@/components/patient/sos-orb-server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourSession"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Where a patient lands after a session.
 *
 * Outside the portal shell and outside the marketing site: no navigation, no
 * sign-up prompt, no footer full of links. One question, one summary, and a
 * way to tell us if something went wrong.
 */
export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { locale, t } = await getI18n();
  /* 🔴 75.4 — a guest has no phone, so the language they chose is the signal. */
  const sosCountry = crisisCountryFor({ locale });
  const { token } = await params;
  const [context, signedIn] = await Promise.all([
    feedbackContext(token),
    optionalPatient().then((patient) => patient !== null),
  ]);

  if (!context) {
    return (
      <Shell country={sosCountry}>
        <Card className="p-6 text-center">
          <p className="text-base font-semibold text-navy-700">{t("feedback.expired")}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-navy-400">
            {t("feedback.expiredBody")}
          </p>
          {/*
            🔴 W2-P16: the link expires; a signed-in patient's summary does not.
            It is on their own summary page, so that is where this goes.
          */}
          {signedIn ? (
            <Link
              href="/patient/summary"
              className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600"
            >
              {t("home.summary")}
            </Link>
          ) : null}
          <Link href="/" className="mt-4 flex items-center justify-center">
            <Logo ink="navy" height={22} />
          </Link>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell country={sosCountry}>
      {/*
        The heading lives inside the form, not above it.
        -----------------------------------------------
        It was here, rendered on the server from `context.done`, which meant
        that submitting the form left "One minute, and your summary is yours"
        sitting directly above the word "Thank you". The state that decides the
        heading is client state now, so the heading has to be too.
      */}
      <RatingForm
        sessionDateIso={context.sessionDate.toISOString()}
        therapistTimezone={context.therapistTimezone}
        token={token}
        therapistFirstName={context.therapistFirstName}
        signer={[context.therapistName, context.therapistCredentials].filter(Boolean).join(", ")}
        brief={context.brief}
        briefSteps={context.briefSteps}
        briefNext={context.briefNext}
        briefLanguage={context.briefLanguage}
        briefAddenda={context.briefAddenda}
        notePending={context.notePending}
        emailed={context.emailed}
        alreadyDone={context.done}
        paid={context.paidCents > 0}
        ratedApp={context.ratedApp}
      />

      {/*
        🔴 25.13 / C130 — the guest is asked to sign in, honestly.

        The sentence everybody writes here is "create an account to save your
        notes", and it is false. The clinician holds this record either way;
        nothing is about to be lost, and implying it is uses a person's fear of
        losing their own therapy to close a signup. What an account actually
        changes is who can READ it, which is worth saying plainly and is also
        the whole argument of this product.

        Shown only to somebody who is not already signed in, because asking a
        patient to create the account they already have is how a product tells
        you it is not paying attention.
      */}
      {signedIn ? null : (
        <Card className="mt-6 p-5">
          <p className="text-sm font-semibold text-navy-700">{t("feedback.seeTitle")}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-400">{t("feedback.seeBody")}</p>
          <Link
            href="/patient/signup"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600"
          >
            {t("feedback.makeMine")}
          </Link>
        </Card>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-navy-400">
        {t("urgent.footer")}
      </p>
    </Shell>
  );
}

function Shell({ children, country }: { children: React.ReactNode; country: string | null }) {
  return (
    <div className="min-h-dvh bg-navy-50">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">{children}</div>
      {/*
        🔴 51.4 — in the Shell rather than in either branch.

        This page has two returns: the feedback form, and the expired-link
        card. A person who has just been told their link is dead is exactly
        the person who should still have the orb, and putting it on the happy
        path only is how "every patient screen" quietly becomes "most".
      */}
      <SosOrbServer country={country} />
    </div>
  );
}
