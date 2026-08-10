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
      <div className="mb-5">
        <p className="text-xs font-bold tracking-wider text-teal-600 uppercase">
          {context.sessionDate.toLocaleDateString(undefined, { dateStyle: "long" })}
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
          {context.done ? "Your session" : "One minute, and your summary is yours"}
        </h1>
        {!context.done ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Rate the session and tell us where to send the summary. It is the only thing we ask,
            and it is what keeps the good therapists visible to the next person.
          </p>
        ) : null}
      </div>

      <RatingForm
        token={token}
        therapistFirstName={context.therapistFirstName}
        brief={context.brief}
        briefLanguage={context.briefLanguage}
        notePending={context.notePending}
        alreadyDone={context.done}
        paid={context.paidCents > 0}
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
