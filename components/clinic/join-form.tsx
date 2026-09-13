"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { accept } from "@/app/(clinic)/clinic/join/[token]/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * Accepting a practice's invitation. PLAN.md 54.5, 54.6, C261, C267.
 *
 * ## 🔴 C261 — THE SENTENCE IS ABOVE THE BUTTON, NOT ON A LATER PAGE
 *
 * > *A therapist under a clinic has no private patients on that account. It is stated in
 * > the invitation, before they accept, not discovered afterwards.*
 *
 * So the two sentences that decide whether somebody should accept are between the form
 * and the submit: what belongs to the practice, and what to do if you also want private
 * patients. Not a link, not a tooltip, not a checkbox nobody reads. And the server
 * refuses an acceptance on an invitation whose terms were never served, so this is the
 * rule rather than the rendering of it.
 *
 * ## 🔴 AND IT SAYS WHAT THE PRACTICE WILL NEVER SEE
 *
 * A clinician deciding whether to join needs to know the limit as well as the cost. "They
 * see each patient's name and appointment time and never a note" is the honest version of
 * both halves, and it is the same sentence the practice was shown before buying.
 */
export function ClinicJoinForm({
  token,
  clinicName,
  firstName,
  lastName,
}: {
  token: string;
  clinicName: string;
  firstName: string | null;
  lastName: string | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState(accept, {});

  if (state.ok) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("clinic.join.done")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <p className="text-sm leading-relaxed text-slate-600">{t("clinic.join.body")}</p>

        <Field label={t("clinic.firstName")} htmlFor="join-first">
          <Input id="join-first" name="firstName" defaultValue={firstName ?? ""} required />
        </Field>
        <Field label={t("clinic.lastName")} htmlFor="join-last">
          <Input id="join-last" name="lastName" defaultValue={lastName ?? ""} />
        </Field>
        <Field label={t("clinic.password")} htmlFor="join-password">
          <Input
            id="join-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        {/*
          🔴 C261 — SAID BEFORE THEY ACCEPT. Two sentences, above the button:
          what belongs to the practice, and the honest alternative if they want
          private patients too.
        */}
        <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <p>{t("clinic.join.noPrivate", { name: clinicName })}</p>
          <p>{t("clinic.join.keepSolo")}</p>
        </div>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("clinic.join.accept")} />
      </form>
    </Card>
  );
}
