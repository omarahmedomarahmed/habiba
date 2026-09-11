import type { Metadata } from "next";
import Link from "next/link";

import { RatingForm } from "@/components/feedback/rating-form";
import { Card } from "@/components/ui";
import { feedbackContext } from "@/lib/data/feedback";
import { getI18n } from "@/lib/i18n/server";
import { optionalPatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = { title: "Your session", robots: { index: false } };
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
  const { t } = await getI18n();
  const { token } = await params;
  const [context, signedIn] = await Promise.all([
    feedbackContext(token),
    optionalPatient().then((patient) => patient !== null),
  ]);

  if (!context) {
    return (
      <Shell>
        <Card className="p-6 text-center">
          <p className="text-base font-semibold text-slate-900">This link has expired</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
            Session links stay open for three days. If you still need your summary, ask your
            therapist to send it again.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand-600">
            24Therapy
          </Link>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
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
        brief={context.brief}
        briefSteps={context.briefSteps}
        briefNext={context.briefNext}
        briefLanguage={context.briefLanguage}
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
          <p className="text-sm font-semibold text-slate-900">Do you want to see this yourself?</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Your therapist keeps this record whether or not you make an account. Nothing here is
            about to disappear. What an account changes is that <strong>you</strong> can read your
            own sessions, and that the record travels with you if you ever see somebody else.
          </p>
          <Link
            href="/patient/signup"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
          >
            Make it mine
          </Link>
        </Card>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        {t("urgent.footer")}
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">{children}</div>
    </div>
  );
}
