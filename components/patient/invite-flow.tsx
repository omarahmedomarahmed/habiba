"use client";

import { useRouter } from "next/navigation";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { acceptInvite } from "@/app/(patient)/patient/claim/actions";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const router = useRouter();
  const [keepsAccess, setKeepsAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Check className="h-4 w-4 text-teal-600" aria-hidden />
          {t("pclaim.doneTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {keepsAccess
            ? "Your therapist can still see your profile. You can change that at any time."
            : "Your therapist keeps the notes they wrote, but can no longer see your live profile."}
        </p>
        <Link href="/patient" className="mt-4 block">
          <Button full>{t("pclaim.goToSessions")}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">{t("pinvite.takeTitle")}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t("pinvite.takeBody", { masked: redactedName })}
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
              {t("pinvite.keepAccess")}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
              {t("pinvite.keepAccessBody")}
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
            if (r.error) {
              setError(r.error);
              return;
            }
            setDone(true);
            /*
             * 🔴 22R — leave the invite page immediately.
             *
             * The success card below used to appear and be replaced, within
             * the same second, by "This link is no longer valid — it may have
             * been used already": the action revalidates, the page re-runs on
             * the server, and a single-use token that has just been used no
             * longer resolves. Everything worked, and the last thing the
             * patient saw was an error page.
             *
             * Found by claiming a record as the patient and looking at the
             * screen. No verifier could have: the claim, the grant and the
             * audit row were all exactly right.
             */
            router.replace(`/patient?claimed=${keepsAccess ? "kept" : "1"}`);
          })
        }
      >
        {pending ? "Working…" : "This is me, claim it"}
      </Button>
    </Card>
  );
}
