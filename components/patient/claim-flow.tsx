"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

import { confirmClaim, declineClaim, sendClaimCode } from "@/app/(patient)/patient/claim/actions";
import type { ClaimSuggestion } from "@/lib/data/claims";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

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
  /**
   * 11R.11 — which channel the code actually went by, and whether that was
   * what they asked for.
   *
   * Held here and rendered below, because C68 was exactly this being written
   * to a server log instead. Somebody who chose WhatsApp and then watches
   * WhatsApp for thirty minutes has been failed by a product that knew.
   */
  const [sentBy, setSentBy] = useState<{ channel: string | null; fellBack: boolean } | null>(null);
  const [code, setCode] = useState("");
  // Step 7: OFF until they say otherwise.
  const [keepsAccess, setKeepsAccess] = useState(false);
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (suggestions.length === 0 && step === "list") {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("pclaim.noneTitle")}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("pclaim.noneBody")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {t("pclaim.noneAsk")}
        </p>
        <Link href="/patient" className="mt-4 block">
          <Button full variant="secondary">
            {t("pclaim.skip")}
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
          {t("pclaim.doneTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {keepsAccess ? t("pclaim.doneKept") : t("pclaim.doneDropped")}
        </p>
        <Link href="/patient" className="mt-4 block">
          <Button full>{t("pclaim.goToSessions")}</Button>
        </Link>
      </Card>
    );
  }

  if (step === "code" && active) {
    return (
      <Card className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {sentBy?.channel === "whatsapp" ? t("pclaim.checkWhatsapp") : t("pclaim.checkEmail")}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {t("pclaim.codeSent")}
          </p>
          {sentBy?.fellBack ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {t("pclaim.fellBack")}
            </p>
          ) : null}
        </div>

        <Field label={t("pclaim.yourCode")} htmlFor="claim-code">
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
                {t("pclaim.keepAccess")}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                {t("pclaim.keepAccessBody")}
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
          {t("pclaim.notMe")}
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <Card key={s.personId} className="p-4">
          <p className="text-sm text-slate-600">
            {s.matchedOn === "email" ? t("pclaim.matchedEmail") : t("pclaim.matchedPhone")}
          </p>
          {/*
            The redacted name — §3 step 4. Shown rather than the real one
            because they have proved nothing yet: a full name would tell whoever
            typed an address exactly who it belongs to in our records.
          */}
          <p className="mt-2 font-mono text-lg font-semibold tracking-wider text-slate-900">
            {s.redactedName}
          </p>
          <p className="mt-2 text-xs text-slate-500">{t("pclaim.isThatYou")}</p>

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
                  if (r.sent) setSentBy({ channel: r.channel ?? null, fellBack: Boolean(r.fellBack) });
                  if (r.error) setError(r.error);
                  else {
                    setActive(s);
                    setClaimId(r.claimId ?? null);
                    setStep("code");
                  }
                })
              }
            >
              {t("pclaim.yesSendCode")}
            </Button>
          </div>
        </Card>
      ))}

      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
        {t("pclaim.initialsOnly")}
      </p>
    </div>
  );
}
