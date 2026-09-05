import type { Metadata } from "next";
import Link from "next/link";

import { InviteFlow } from "@/components/patient/invite-flow";
import { resolveInvite } from "@/lib/data/claims";
import { optionalPatient } from "@/lib/patient-auth/guard";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Your record", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The third claim route. C19 / PLAN.md 6.10.
 *
 * A link the therapist handed over in person. **This is the only route that
 * works for most of this book**: 56 of 66 patients have no email and none has a
 * phone number, so matching finds nothing for them and always will.
 *
 * No name-confirmation step, unlike the matching route. The clinician already
 * did the identifying — they were in the room — and asking somebody holding a
 * link the therapist gave them to confirm initials adds a hurdle without adding
 * evidence.
 *
 * The name is still shown redacted. Whoever is holding this link has not proved
 * they are the person, and a link forwarded in a WhatsApp thread must not
 * disclose a full name to whoever scrolls past it.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite, patient] = await Promise.all([resolveInvite(token), optionalPatient()]);

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-8">
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">This link is no longer valid</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            It may have been used already, expired, or been taken back. Ask your therapist for a
            new one.
          </p>
        </Card>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-8">
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">Your therapist sent you this</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            It connects the notes they keep — under the name{" "}
            <span className="font-mono font-semibold tracking-wider">{invite.redactedName}</span> —
            to an account of your own.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Create an account or sign in, then open this link again.
          </p>
          <div className="mt-4 space-y-2">
            <Link
              href={`/patient/signup?next=/patient/invite/${token}`}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-white"
            >
              Create an account
            </Link>
            <Link
              href={`/patient/login?next=/patient/invite/${token}`}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700"
            >
              Sign in
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <InviteFlow token={token} redactedName={invite.redactedName} />
    </main>
  );
}
