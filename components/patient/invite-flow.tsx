"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { acceptInvite } from "@/app/(patient)/patient/claim/actions";
import { Button, Card } from "@/components/ui";

/**
 * Redeeming a therapist's invite.
 *
 * The invite *is* the verification — a clinician identified this person in the
 * room, which is better evidence than a code sent to an address they may share
 * with a family member. So there is no code step here.
 *
 * Step 7 still applies, and still defaults to off. Being handed a link by your
 * therapist is not consent for that therapist to keep reading your record
 * afterwards; §3 says the patient chooses, and the route they arrived by does
 * not change that.
 */
export function InviteFlow({ token, redactedName }: { token: string; redactedName: string }) {
  const [keepsAccess, setKeepsAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Check className="h-4 w-4 text-teal-600" aria-hidden />
          That record is yours now
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {keepsAccess
            ? "Your therapist can still see your profile. You can change that at any time."
            : "Your therapist keeps the notes they wrote, but can no longer see your live profile."}
        </p>
        <Link href="/patient" className="mt-4 block">
          <Button full>Go to my sessions</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">Take ownership of your record</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your therapist keeps notes under the name{" "}
          <span className="font-mono font-semibold tracking-wider">{redactedName}</span>. Claiming
          it means the record is yours: it travels with you, and you decide who reads it.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={keepsAccess}
            onChange={(e) => setKeepsAccess(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">
              Let this therapist keep seeing my profile
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
              Off by default, even though they sent you this link. If you leave it off they keep
              the notes they already wrote and nothing else. You can change it whenever you like.
            </span>
          </span>
        </label>
      </div>

      {error ? (
        <p role="alert" aria-live="assertive" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button
        full
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await acceptInvite({ token, therapistKeepsAccess: keepsAccess });
            if (r.error) setError(r.error);
            else setDone(true);
          })
        }
      >
        {pending ? "Working…" : "This is me — claim it"}
      </Button>
    </Card>
  );
}
