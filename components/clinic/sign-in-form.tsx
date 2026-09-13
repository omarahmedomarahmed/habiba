"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInClinic } from "@/app/(clinic)/clinic/sign-in/actions";
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
 * The clinic manager's sign-in. PLAN.md 54.2.
 *
 * 🔴 No sign-up link beside it. A manager account is created by an admin after a call
 * (54.3), so a practice arriving here without one is sent to the enquiry form rather
 * than offered an account that would then have to be held.
 *
 * 🔴 And no "are you a clinician?" link either. A clinician invited by this practice
 * signs in at the CLINICIAN door, because that is what they are: C267 means their
 * account is an ordinary clinician's account and the clinic merely pays for it.
 */
export function ClinicSignInForm() {
  const t = useT();
  const [state, formAction] = useActionState(signInClinic, {});

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <Field label={t("clinic.email")} htmlFor="clinic-email">
          <Input
            id="clinic-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
          />
        </Field>

        <Field label={t("clinic.password")} htmlFor="clinic-password">
          <Input
            id="clinic-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("clinic.signIn")} />
      </form>
    </Card>
  );
}
