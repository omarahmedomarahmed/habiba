"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

import { confirmClaim, declineClaim, sendClaimCode } from "@/app/(patient)/patient/claim/actions";
import type { ClaimSuggestion } from "@/lib/data/claims";
import { Button, Card, Field, Input } from "@/components/ui";

/**
 * §3's eight steps, one at a time.
 *
 * ## Step 7 is the one that matters
 *
 * "We ask whether the therapist keeps access. **Default is OFF. The patient
 * chooses.**" So the checkbox starts unchecked, the copy explains what each
 * answer means before they answer, and nothing is submitted until they press
 * the button. There is no pre-ticked box anywhere in this component.
 *
 * ## What is not said out loud
 *
 * The clinician's name never appears. The person confirming has matched on
 * their own contact details and nothing more; telling them *who* holds a record
 * before they have proved they are the person would turn a signup form into a
 * way of finding out who is in therapy.
 */
export function ClaimFlow({ suggestions }: { suggestions: ClaimSuggestion[] }) {
  const [step, setStep] = useState<"list" | "code" | "done">("list");
  const [active, setActive] = useState<ClaimSuggestion | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // Step 7: OFF until they say otherwise.
  const [keepsAccess, setKeepsAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (suggestions.length === 0 && step === "list") {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">Nothing to claim yet</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          We could not find a record under your email or phone number. That is completely normal —
          most therapists write a name down and nothing else.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          If you know your therapist keeps notes about you, ask them for an invite link. It takes
          them one tap and it connects that exact record to this account.
        </p>
        <Link href="/patient" className="mt-4 block">
          <Button full variant="secondary">
            Skip for now
          </Button>
        </Link>
      </Card>
    );
  }

  if (step === "done") {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Check className="h-4 w-4 text-teal-600" aria-hidden />
          That record is yours now
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {keepsAccess
            ? "Your therapist can still see your profile. You can change that at any time."
            : "Your therapist keeps the notes they wrote, but can no longer see your live profile. You can give access back whenever you want to."}
        </p>
        <Link href="/patient" className="mt-4 block">
          <Button full>Go to my sessions</Button>
        </Link>
      </Card>
    );
  }

  if (step === "code" && active) {
    return (
      <Card className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Check your email</p>
          <p className="mt-1 text-sm text-slate-600">
            We sent a six-digit code. It expires in thirty minutes.
          </p>
        </div>

        <Field label="Your code" htmlFor="claim-code">
          <Input
            id="claim-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
          />
        </Field>

        {/*
          Step 7. Unchecked, and the consequence of each answer is stated before
          they choose — not after, and not in a tooltip.
        */}
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
                If you leave this off, they keep the notes they already wrote and nothing else — no
                new sessions, no live profile. You can turn it on later, and off again, whenever you
                like.
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
          disabled={pending || code.trim().length < 6}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await confirmClaim({
                claimId: claimId!,
                code,
                therapistKeepsAccess: keepsAccess,
              });
              if (r.error) setError(r.error);
              else setStep("done");
            })
          }
        >
          {pending ? "Checking…" : "Claim this record"}
        </Button>

        <button
          type="button"
          className="w-full text-center text-xs text-slate-500 hover:text-slate-800"
          onClick={() =>
            startTransition(async () => {
              if (claimId) await declineClaim(claimId);
              setStep("list");
              setActive(null);
            })
          }
        >
          This is not me
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <Card key={s.personId} className="p-4">
          <p className="text-sm text-slate-600">
            A therapist keeps notes for someone with your{" "}
            {s.matchedOn === "email" ? "email address" : "phone number"}, under the name:
          </p>
          {/*
            The redacted name — §3 step 4. Shown rather than the real one
            because they have proved nothing yet: a full name would tell whoever
            typed an address exactly who it belongs to in our records.
          */}
          <p className="mt-2 font-mono text-lg font-semibold tracking-wider text-slate-900">
            {s.redactedName}
          </p>
          <p className="mt-2 text-xs text-slate-500">Is that you?</p>

          {error ? (
            <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <Button
              full
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await sendClaimCode(s.personId, "email");
                  if (r.error) setError(r.error);
                  else {
                    setActive(s);
                    setClaimId(r.claimId ?? null);
                    setStep("code");
                  }
                })
              }
            >
              Yes, send me a code
            </Button>
          </div>
        </Card>
      ))}

      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
        We only show initials until you have confirmed the code. Nobody learns anything about you
        from this screen that you did not already tell us.
      </p>
    </div>
  );
}
