import type { Metadata } from "next";
import Link from "next/link";

import { RatingForm } from "@/components/feedback/rating-form";
import { Card } from "@/components/ui";
import { feedbackContext } from "@/lib/data/feedback";

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
  const { token } = await params;
  const context = await feedbackContext(token);

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
        sessionDate={context.sessionDate.toLocaleDateString(undefined, { dateStyle: "long" })}
        token={token}
        therapistFirstName={context.therapistFirstName}
        brief={context.brief}
        briefLanguage={context.briefLanguage}
        notePending={context.notePending}
        alreadyDone={context.done}
        paid={context.paidCents > 0}
        ratedApp={context.ratedApp}
      />

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        If you are in immediate danger, call your local emergency number. In the US, call or text
        988.
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
